function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getToday() {
  return formatDate(new Date())
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatDate(d)
}

function getDateRange(days) {
  const dates = []
  for (let i = days - 1; i >= 0; i--) {
    dates.push(daysAgo(i))
  }
  return dates
}

// 本周的 7 个日期，周一开头、周日结尾。
// 打卡格必须用自然周：滚动窗口「最近 7 天」的起点是任意周几（周一打开时第一格是上周二），
// 7 个格子读不出「一周」的形状，标题却写着「本周」，两边对不上。
function getWeekDates() {
  const now = new Date()
  const day = now.getDay() // 0 = 周日
  const offset = day === 0 ? 6 : day - 1 // 距本周一几天
  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset + i)
    dates.push(formatDate(d))
  }
  return dates
}

function showToast(title, icon = 'none') {
  wx.showToast({ title, icon, duration: 2000 })
}

function showSuccess(title) {
  showToast(title, 'success')
}

function showError(title) {
  showToast(title, 'error')
}

function showLoading(title = '加载中') {
  wx.showLoading({ title, mask: true })
}

function hideLoading() {
  wx.hideLoading()
}

function debounce(fn, delay = 300) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 单位转换
const UNIT = { KG: 'kg', JIN: 'jin' }

function displayWeight(kg, unit) {
  if (kg === null || kg === undefined || isNaN(kg)) return '-'
  return unit === UNIT.JIN ? (kg * 2).toFixed(1) : kg.toFixed(1)
}

function displayUnit(unit) {
  return unit === UNIT.JIN ? '斤' : '公斤'
}

function toKg(value, unit) {
  return unit === UNIT.JIN ? value / 2 : value
}

// 大数字输入框的宽度（rpx）。
// input 天生是方块，宽度固定的话「120.6」和「斤」之间会空出一大段，看起来像两个东西；
// 按字数算宽度，单位就能紧跟着数字。衬线数字每字符约 0.62em，小数点约 0.32em。
function figureWidth(text, sizeRpx, minRpx) {
  const s = String(text == null ? '' : text)
  let em = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    em += (ch === '.' || ch === ',') ? 0.32 : (ch === ' ') ? 0.30 : 0.62
  }
  const w = Math.round((em + 0.32) * sizeRpx)
  return Math.max(minRpx || 0, Math.min(w, (sizeRpx * 7)))
}

module.exports = {
  formatDate,
  getToday,
  formatDisplayDate,
  daysAgo,
  getDateRange,
  getWeekDates,
  showToast,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  debounce,
  UNIT,
  displayWeight,
  displayUnit,
  toKg,
  figureWidth
}
