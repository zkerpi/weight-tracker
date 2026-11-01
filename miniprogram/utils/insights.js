const util = require('./util')

function summarize(records, user, dates) {
  const byDate = {}
  records.forEach(r => { if (Number.isFinite(r.weight)) byDate[r.date] = r.weight })
  const unit = user.weightUnit || 'kg'
  const today = util.getToday()
  // 打卡格用自然周（周一 → 周日），和标题「本周」对齐。
  // 原来取的是 dates.slice(-7)，即「最近 7 天」的滚动窗口：周一打开时会看到
  // 上周二到周日的勾还亮着，而本周只有今天一格——标题在说谎。
  // 也正因为是固定 7 格，才读得出「这周过到哪了」。
  const week = util.getWeekDates().map(date => ({
    date,
    label: date.slice(8),
    done: byDate[date] != null,
    today: date === today,
    future: date > today // YYYY-MM-DD 可直接比较
  }))
  const weekCount = week.filter(d => d.done).length
  // 下面的洞察仍然看滚动 7 天：它回答「最近这段的变化」，不是「这周的战绩」
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
  return { week, insightTitle, insightText, weekCount }
}

module.exports = { summarize }
