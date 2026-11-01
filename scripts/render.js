/*
 * 把真实的 wxml + wxss 转成 HTML 渲染，用于本地核对布局。
 * 目的：预览图必须由源码生成，不再手写复制，避免「预览与真机不一致」。
 *
 * 用法：node scripts/render.js pages/index/index preview/mock/index.js
 *   第一个参数：页面路径（不含扩展名）
 *   第二个参数：导出 data 的模块（可选）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const MP = path.join(ROOT, 'miniprogram')

// rpx -> px（375 逻辑宽，1rpx = 0.5px）
const rpx = s => s.replace(/(-?\d*\.?\d+)rpx/g, (_, n) => `${(parseFloat(n) / 2).toFixed(2)}px`)

const TAG_MAP = {
  view: 'div', text: 'span', image: 'img', button: 'button',
  'scroll-view': 'div', block: null, navigator: 'a', input: 'input',
  textarea: 'textarea', 'cover-view': 'div', canvas: 'canvas', 'rich-text': 'div'
}

/* ---------- 1. 解析 wxml ---------- */
function parse(src) {
  const root = { tag: 'root', attrs: {}, children: [] }
  const stack = [root]
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*"[^"]*")?)*)\s*(\/?)>/g
  let last = 0
  let m
  while ((m = re.exec(src))) {
    const text = src.slice(last, m.index)
    if (text.trim()) stack[stack.length - 1].children.push({ text })
    last = re.lastIndex
    if (m[0].startsWith('<!--')) continue
    const tag = m[1]
    if (m[0][1] === '/') {
      while (stack.length > 1) {
        const top = stack.pop()
        if (top.tag === tag) break
      }
      continue
    }
    const attrs = {}
    // 属性可能没有值（wx:else / enable-flex 这类），必须一起收，
    // 否则 wx:else 分支会被当成无条件渲染，预览就会同时画出 if 和 else 两支。
    const ar = /([^\s=]+)(?:\s*=\s*"([^"]*)")?/g
    let a
    while ((a = ar.exec(m[2] || ''))) attrs[a[1]] = a[2] === undefined ? '' : a[2]
    const node = { tag, attrs, children: [] }
    stack[stack.length - 1].children.push(node)
    if (!m[3]) stack.push(node)
  }
  const tail = src.slice(last)
  if (tail.trim()) stack[stack.length - 1].children.push({ text: tail })
  return root
}

/* ---------- 2. 求值 {{}} ---------- */
function evalExpr(expr, scope) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('__s', `with(__s){ return (${expr}) }`)(scope)
  } catch (e) {
    return ''
  }
}
function interp(str, scope) {
  if (typeof str !== 'string') return str
  // 整串只有一个 {{}} 才直接返回原值。必须排除捕获组里再出现 }} 的情况，
  // 否则 "{{a}}{{b}}" 会被贪婪地当成一个表达式 "a}}{{b"，求值失败变成空字符串。
  const only = str.match(/^\{\{((?:(?!\}\})[\s\S])*)\}\}$/)
  if (only) return evalExpr(only[1], scope)
  return str.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => {
    const v = evalExpr(e, scope)
    return v == null ? '' : v
  })
}

/* ---------- 3. 渲染 ---------- */
function renderChildren(children, scope) {
  let out = ''
  let taken = false // 上一个 if/elif 分支是否命中
  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (node.text != null) {
      out += interp(node.text, scope)
      taken = false
      continue
    }
    const at = node.attrs
    if (at['wx:if'] != null) {
      taken = !!interp(at['wx:if'], scope)
      if (!taken) continue
    } else if (at['wx:elif'] != null) {
      if (taken) continue
      taken = !!interp(at['wx:elif'], scope)
      if (!taken) continue
    } else if (at['wx:else'] != null) {
      if (taken) continue
      taken = true
    } else {
      taken = false
    }
    if (at['wx:for'] != null) {
      const list = interp(at['wx:for'], scope) || []
      const itemName = at['wx:for-item'] || 'item'
      const idxName = at['wx:for-index'] || 'index'
      const slice = Array.isArray(list) ? list : []
      slice.forEach((item, index) => {
        const s = Object.assign({}, scope, { [itemName]: item, [idxName]: index })
        out += renderNode(node, s, true)
      })
      continue
    }
    out += renderNode(node, scope)
  }
  return out
}

function renderNode(node, scope, insideFor) {
  const at = node.attrs || {}
  if (node.tag === 'block' || node.tag === 'root') return renderChildren(node.children, scope)

  // 自定义组件：用一个等高占位块代替（例如 trend-chart 的 canvas）
  if (!Object.prototype.hasOwnProperty.call(TAG_MAP, node.tag) || TAG_MAP[node.tag] === undefined) {
    const h = parseInt(interp(at.height || '210', scope), 10) / 2
    return `<div class="__component __${node.tag}" style="height:${h}px">${node.tag}</div>`
  }
  const htmlTag = TAG_MAP[node.tag] || 'div'

  const attrs = []
  let cls = at.class ? interp(at.class, scope) : ''
  cls = String(cls).trim() || undefined
  if (cls) attrs.push(`class="${cls}"`)
  const style = at.style ? rpx(String(interp(at.style, scope))) : ''
  if (style) attrs.push(`style="${style}"`)
  if (node.tag === 'image') {
    const src = interp(at.src || '', scope).replace(/^\//, '')
    attrs.push(`src="${path.join(MP, src)}"`)
    if (at.mode === 'aspectFill') attrs.push('data-fit="cover"')
    attrs.push('alt=""')
  }
  const inner = renderChildren(node.children, scope)
  if (node.tag === 'image' || node.tag === 'input') return `<${htmlTag} ${attrs.join(' ')}>`
  return `<${htmlTag} ${attrs.join(' ')}>${inner}</${htmlTag}>`
}

/* ---------- 4. 组装 HTML ---------- */
function wxss(file) {
  let css = fs.readFileSync(file, 'utf8')
  css = css.replace(/^\uFEFF/, '')
  // page 选择器必须换成真实元素，否则 app.wxss 里挂在 page 上的
  // CSS 变量全部失效：按钮透明、绿点变灰，预览会骗人。
  css = css.replace(/^\s*page\s*\{/gm, 'body {')
  return rpx(css)
}

function main() {
  const page = process.argv[2] || 'pages/index/index'
  const dataFile = process.argv[3]
  const data = dataFile ? require(path.resolve(ROOT, dataFile)) : {}

  const wxml = fs.readFileSync(path.join(MP, page + '.wxml'), 'utf8')
  const tree = parse(wxml)
  const body = renderChildren(tree.children, data)

  const appCss = wxss(path.join(MP, 'app.wxss'))
  const pageCss = wxss(path.join(MP, page + '.wxss'))

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #8a8f88; }
  body { width: 375px; margin: 0 auto; min-height: 812px; overflow-x: hidden;
         -webkit-font-smoothing: antialiased; }
  span { display: inline; }
  button { border: none; background: none; font: inherit; color: inherit; }
  img { display: block; }
  #__m { display: none; }
  .__component { display:flex; align-items:center; justify-content:center;
                 color:#a9afa4; font-size:11px; background:#f2efe5; border-radius:8px; }
${appCss}
${pageCss}
</style></head>
<body>
${body}
<pre id="__m" style="position:fixed;left:0;top:0;font-size:9px;color:#000;z-index:9999"></pre>
<script>
(function(){
  var out = {};
  function box(el){ if(!el) return null; var r = el.getBoundingClientRect();
    return {x:+r.x.toFixed(1), y:+r.y.toFixed(1), w:+r.width.toFixed(1), h:+r.height.toFixed(1)}; }
  function ink(el){ if(!el) return null; var r = document.createRange(); r.selectNodeContents(el);
    var b = r.getBoundingClientRect();
    return {x:+b.x.toFixed(1), y:+b.y.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1)}; }
  var ring = document.querySelector('.weight-ring');
  // 复刻 index.js 的运行时自适应：把「数字 + 单位」调整到圆环宽度的 80%
  (function calibrate(){
    var numEl = document.querySelector('.ring-number');
    var unitEl = document.querySelector('.ring-unit');
    if (!ring || !numEl || !unitEl) return;
    var cur = parseFloat(getComputedStyle(numEl).fontSize);
    var wNum = ink(numEl).w, wUnit = ink(unitEl).w;
    if (wNum + wUnit < 1) return;
    var target = ring.getBoundingClientRect().width * 0.68;
    var next = cur * target / (wNum + 4.5 + wUnit);
    numEl.style.fontSize = Math.max(36, Math.min(64, next)).toFixed(1) + 'px';
  })();
  out.ring = box(ring);
  var cap = document.querySelector('.ring-caption');
  var num = document.querySelector('.ring-number');
  var unit = document.querySelector('.ring-unit');
  out.caption = box(cap);
  out.number = box(num);
  out.numberInk = ink(num);
  out.unitInk = ink(unit);
  out.fig = box(document.querySelector('.ring-figure'));
  out.chip = box(document.querySelector('.ring-chip'));
  out.pill = box(document.querySelector('.primary-pill'));
  out.panel1 = box(document.querySelector('.panel'));
  out.pageH = document.body.scrollHeight;
  if (ring && out.numberInk) {
    var R = out.ring;
    out.pct = {
      ringW: R.w,
      numW: +(out.numberInk.w / R.w * 100).toFixed(1),
      inkTop: +((out.numberInk.y - R.y) / R.h * 100).toFixed(1),
      inkBottom: +((out.numberInk.y + out.numberInk.h - R.y) / R.h * 100).toFixed(1),
      capTop: cap ? +((out.caption.y - R.y) / R.h * 100).toFixed(1) : null,
      fontSize: num ? getComputedStyle(num).fontSize : null,
      fontUsed: num ? getComputedStyle(num).fontFamily : null
    };
  }
  document.getElementById('__m').textContent = JSON.stringify(out);
  if (location.href.indexOf('metrics') >= 0) {
    document.body.innerHTML = '<pre style="font-size:12px;line-height:1.5;white-space:pre-wrap;padding:8px;color:#000;background:#fff">'
      + JSON.stringify(out, null, 1) + '</pre>';
    document.body.style.background = '#fff';
  }
})();
</script>
</body></html>`
  const out = path.join(ROOT, 'preview', '_render.html')
  fs.writeFileSync(out, html, 'utf8')
  console.log('wrote', out, html.length, 'bytes')
}

// 作为模块被引用时（render-all.js）只导出工具函数，不执行 CLI
module.exports = { ROOT, MP, rpx, parse, interp, renderChildren, wxss }
if (require.main === module) main()
