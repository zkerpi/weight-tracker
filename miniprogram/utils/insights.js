const util = require('./util')

function summarize(records, user, dates) {
  const byDate = {}
  records.forEach(r => { if (Number.isFinite(r.weight)) byDate[r.date] = r.weight })
  const unit = user.weightUnit || 'kg'
  const week = dates.slice(-7).map(date => ({
    date, label: date.slice(8), done: byDate[date] != null, today: date === util.getToday()
  }))
  const current = dates.slice(-7).filter(d => byDate[d] != null).map(d => byDate[d])
  const previous = dates.slice(-14, -7).filter(d => byDate[d] != null).map(d => byDate[d])
  const average = values => values.reduce((a, b) => a + b, 0) / values.length
  let insightTitle = '给变化一点时间'
  let insightText = '记录会慢慢连成趋势。从今天开始，留下第一个数字。'
  if (current.length) {
    insightTitle = `近 7 天记录了 ${current.length} 天`
    insightText = '单次数字只是一帧。积累更多记录，再一起看长期变化。'
  }
  if (current.length >= 3 && previous.length >= 3) {
    const delta = average(current) - average(previous)
    const amount = util.displayWeight(Math.abs(delta), unit)
    insightTitle = `近 7 天均值 ${util.displayWeight(average(current), unit)} ${util.displayUnit(unit)}`
    insightText = `比前 7 天${Number(amount) === 0 ? '基本持平' : (delta > 0 ? '高 ' : '低 ') + amount + ' ' + util.displayUnit(unit)}。两段分别基于 ${current.length} 和 ${previous.length} 次记录。`
  }
  return { week, insightTitle, insightText, weekCount: current.length }
}

module.exports = { summarize }
