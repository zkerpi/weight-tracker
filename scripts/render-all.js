/*
 * 一次渲染多个页面，并排成一张长图，用于横向比对字号 / 比例是否统一。
 * 与 render.js 共用解析器，所以图上看到的永远就是 wxss 里写的值。
 *
 * 用法：node scripts/render-all.js index rank goal unit history profile groups
 * 输出：preview/_all.html
 */
const fs = require('fs')
const path = require('path')
const { ROOT, MP, rpx, parse, renderChildren } = require('./render')

// rpx -> px，并把 page 选择器换成 .screen（每列一个独立屏幕）
// 注意必须按行首匹配：app.wxss 的 page 规则紧跟注释块，用「前一个字符是 }」匹配不到，
// 换不掉就等于整站的 CSS 变量全部失效。
function wxssFor(file) {
  let css = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  css = css.replace(/^\s*page\s*\{/gm, '.screen {')
  return rpx(css)
}

const NAV = { 今天: '', 小组: '', 排行: '返回', 目标: '返回', 单位: '返回', 趋势: '返回', 我的小组: '返回' }

const TABS = [
  { text: '今天', icon: 'tab-today', active: 'tab-today-active' },
  { text: '小组', icon: 'tab-group', active: 'tab-group-active' },
  { text: '我', icon: 'tab-me', active: 'tab-me-active' }
]

function phone(name, data, mock, activeTab, variant) {
  const page = `pages/${name}/${name}`
  const wxml = fs.readFileSync(path.join(MP, page + '.wxml'), 'utf8')
  const body = renderChildren(parse(wxml).children, data)
  const pageCss = wxssFor(path.join(MP, page + '.wxss'))
  const isTab = activeTab != null
  const title = data.__title || ''
  return `
<div class="col">
  <div class="col-tag">${name}${variant ? ' · ' + variant : ''}</div>
  <div class="screen ${isTab ? 'has-tab' : ''}">
    <div class="statusbar"><span>9:41</span><span class="sb-right">●●●  ▮</span></div>
    <div class="navbar">${isTab ? '' : '<span class="back">‹</span>'}<span class="navtitle">${title}</span></div>
    ${body}
    ${isTab ? `<div class="tabbar">${TABS.map((t, i) => `
      <div class="tab ${i === activeTab ? 'on' : ''}">
        <img src="${path.join(MP, 'images', (i === activeTab ? t.active : t.icon) + '.png').replace(/\\/g, '/')}">
        <span>${t.text}</span>
      </div>`).join('')}</div>` : ''}
  </div>
  <style>${pageCss}</style>
</div>`
}

function main() {
  const names = process.argv.slice(2)
  const list = names.length ? names : ['index', 'rank', 'goal', 'unit', 'history', 'profile']

  const columns = list.map(spec => {
    // 支持 "index:night" 这种变体，用来比对昼夜两套圆环
    const [name, variant] = spec.split(':')
    let data = {}
    const mockFile = path.join(ROOT, 'preview', 'mock', name + '.js')
    if (fs.existsSync(mockFile)) data = require(mockFile)
    if (variant === 'night') data = Object.assign({}, data, { isDay: false })
    const tabIndex = { index: 0, group: 1, profile: 2 }[name]
    return phone(name, data, mockFile, tabIndex, variant)
  })

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>pages</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#8a8f88; display:flex; align-items:flex-start; gap:20px; padding:20px;
         -webkit-font-smoothing:antialiased; }
  .col { width:375px; flex:0 0 375px; }
  .col-tag { margin-bottom:8px; color:#fff; font:600 13px/1 -apple-system, "PingFang SC", sans-serif; letter-spacing:1px; }
  .screen { position:relative; width:375px; min-height:812px; overflow:hidden; background:#f0ede4; }
  .statusbar {
    display:flex; height:28px; padding:0 18px; align-items:center; justify-content:space-between;
    background:#f0ede4; color:#1c241e; font:600 12px/1 -apple-system, "PingFang SC", sans-serif;
  }
  .sb-right { letter-spacing:1px; }
  .navbar { display:flex; height:44px; padding:0 14px; align-items:center; justify-content:center; position:relative; }
  .back { position:absolute; left:12px; top:2px; color:#1c241e; font-size:30px; line-height:1; font-weight:300; }
  .navtitle { color:#1c241e; font:600 16px/1 -apple-system, "PingFang SC", sans-serif; }
  .tabbar {
    position:absolute; left:0; right:0; bottom:0; display:flex; height:56px; padding-bottom:6px;
    align-items:center; background:#fbf9f3; border-top:1px solid #e7e3d7;
  }
  .tab { display:flex; flex:1; flex-direction:column; align-items:center; justify-content:center; gap:2px;
         color:#8a9086; font:11px/1 -apple-system, "PingFang SC", sans-serif; }
  .tab img { width:22px; height:22px; }
  .tab.on { color:#2f4b39; }
  span { display:inline; }
  button { border:none; background:none; font:inherit; color:inherit; }
  img { display:block; }
  .__component { display:flex; align-items:center; justify-content:center; color:#a9afa4; font-size:11px;
                 background:#f2efe5; border-radius:8px; }
${wxssFor(path.join(MP, 'app.wxss'))}
</style></head>
<body>
${columns.join('\n')}
<pre id="__m" style="display:none"></pre>
<script>
(function(){
  var out = {};
  function box(el){ if(!el) return null; var r = el.getBoundingClientRect();
    return {x:Math.round(r.x), y:Math.round(r.y), w:+r.width.toFixed(1), h:+r.height.toFixed(1)}; }
  function ink(el){ if(!el) return null; var r=document.createRange(); r.selectNodeContents(el);
    var b=r.getBoundingClientRect();
    return {w:+b.width.toFixed(1), h:+b.height.toFixed(1)}; }
  // 同名类在多列里都要量：按 .col 分组
  var groups = {};
  Array.prototype.forEach.call(document.querySelectorAll('.col'), function(col, ci){
    var name = col.querySelector('.col-tag').textContent;
    var row = {};
    ['.display-title','.ring-number','.ring-caption','.period-value','.goal-progress-percent',
     '.goal-input','.unit-preview-num','.podium-num','.board-num','.my-bar-num','.history-weight',
     '.unit-sample-num'].forEach(function(sel){
      var el = col.querySelector(sel);
      if (!el) return;
      row[sel] = Object.assign({}, box(el), {ink:ink(el), font:getComputedStyle(el).fontSize,
        weight:getComputedStyle(el).fontWeight});
    });
    row.pageH = +col.querySelector('.screen').getBoundingClientRect().height.toFixed(1);
    groups[name] = row;
  });
  document.getElementById('__m').textContent = JSON.stringify(groups);
  if (location.hash === '#metrics' || location.search.indexOf('metrics') >= 0) {
    var lines = [];
    Object.keys(groups).forEach(function(k){
      lines.push('== ' + k + '  pageH=' + groups[k].pageH);
      Object.keys(groups[k]).forEach(function(s){
        if (s === 'pageH') return;
        var v = groups[k][s];
        lines.push('   ' + s + '  w=' + (v.ink ? v.ink.w : v.w) + ' h=' + (v.ink ? v.ink.h : v.h)
          + ' box=' + v.w + 'x' + v.h + ' font=' + v.font + ' w' + v.weight);
      });
    });
    document.body.innerHTML = '<pre style="font-size:13px;line-height:1.55;white-space:pre;padding:12px;color:#111;background:#fff">'
      + lines.join('\n') + '</pre>';
    document.body.style.background = '#fff';
    document.body.style.width = 'auto';
  }
})();
</script>
</body></html>`

  const out = path.join(ROOT, 'preview', '_all.html')
  fs.writeFileSync(out, html, 'utf8')
  console.log('wrote', out, list.join(','))
}

main()
