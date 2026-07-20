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

module.exports = {
  formatDate,
  getToday,
  formatDisplayDate,
  daysAgo,
  getDateRange,
  showToast,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  debounce
}
