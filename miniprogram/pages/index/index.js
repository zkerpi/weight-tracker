const util = require('../../utils/util')
const { summarize } = require('../../utils/insights')

// 圆环直径（rpx）。先用字符宽度估一个初值避免首帧溢出，
// 渲染后再用 SelectorQuery 实测「数字 + 单位」的真实宽度反算字号——
// 不同机型/字体（宋体、Didot、Noto Serif）字宽差异可达 20%，只有实测才准。
// RING_FILL 是「数字+单位」占圆环直径的比例：0.68 是实测下来数字最像「称量结果」的比例，
// 再大就会顶到圆环边、单位的斤/公斤被挤到弧线上。
const RING_RPX = 400
const RING_FILL = 0.68
const RING_MIN = 72
const RING_MAX = 128

// 太阳光芒 12 道，30° 一档；星点全部落在夜空的圆盘内部（避开文字区），
// 位置写死，保证每次进页面星星不搬家
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30)
const STARS = [
  { id: 's1', x: 62, y: 58, s: 6, o: .8 },
  { id: 's2', x: 128, y: 88, s: 4, o: .5 },
  { id: 's3', x: 296, y: 62, s: 5, o: .68 },
  { id: 's4', x: 344, y: 120, s: 4, o: .42 },
  { id: 's5', x: 44, y: 156, s: 4, o: .38 },
  { id: 's6', x: 78, y: 322, s: 5, o: .6 },
  { id: 's7', x: 322, y: 316, s: 4, o: .46 }
]

function fitNumberSize(text) {
  const str = String(text == null ? '' : text)
  // 还没有体重数据时（"--"）不给放大，保持小号占位
  if (!/\d/.test(str)) return 96
  let em = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === '.' || ch === ',') em += 0.30
    else if (ch === '-') em += 0.42
    else if (ch === ' ') em += 0.32
    else em += 0.60
  }
  if (!em) return 120
  // 单位（一个汉字 ≈ 0.34 倍字号宽）+ 数字与单位间约 0.05 倍字号的间距
  const total = em + 0.39
  return Math.max(RING_MIN, Math.min(RING_MAX, Math.round((RING_RPX * RING_FILL) / total)))
}

Page({
  data: {
    loading: true, error: '', chartError: '', userInfo: null, todayWeight: null,
    currentWeight: '--', numSize: 100, unitLabel: '公斤', todayDate: util.getToday(), dateLabel: '',
    lastDeltaText: '', lastDeltaDir: '',
    isDay: true, rays: RAYS, stars: STARS,
    greeting: '把自己，照顾好。', totalDays: 0, streak: 0, changeDisplay: '--',
    week: [], chartData: [], trendPointCount: 0,
    insightTitle: '给变化一点时间', insightText: '从今天开始，留下第一个数字。'
  },
  onShow() {
    const hour = new Date().getHours()
    this.setData({ isDay: hour >= 6 && hour < 18 })
    this.loadData()
  },
  onReady() { this.calibrateNumber() },
  // 实测「数字 + 单位」的实际宽度，按目标占比反算字号。缩放是线性的，一次即可收敛。
  calibrateNumber() {
    if (!/\d/.test(this.data.currentWeight || '')) return
    const query = wx.createSelectorQuery()
    query.select('.weight-ring').boundingClientRect()
    query.select('.ring-number').boundingClientRect()
    query.select('.ring-unit').boundingClientRect()
    query.exec(res => {
      const ring = res[0], num = res[1], unit = res[2]
      if (!ring || !num || !unit || !num.width || !ring.width) return
      const gap = 4.5 // 9rpx
      const target = ring.width * RING_FILL
      const total = num.width + gap + unit.width
      if (total < 1) return
      const cur = this.data.numSize
      const next = Math.max(RING_MIN, Math.min(RING_MAX, Math.round(cur * (target / total))))
      if (Math.abs(next - cur) >= 2) this.setData({ numSize: next })
    })
  },
  async onPullDownRefresh() {
    try { await this.loadData(true) } finally { wx.stopPullDownRefresh() }
  },
  async loadData(force) {
    this.setData({ loading: true, error: '' })
    try {
      const app = getApp()
      const user = await app.ensureUser(force === true || app.globalData.needsRefresh)
      if (!user) throw new Error('暂时无法读取记录')
      app.globalData.needsRefresh = false
      this.renderStats(user)
      await this.loadSummary()
    } catch (err) {
      this.setData({ error: '暂时无法读取记录，请检查网络后重试' })
    } finally { this.setData({ loading: false }) }
  },
  renderStats(user) {
    const s = user.stats || {}
    const unit = user.weightUnit || 'kg'
    const baseline = user.initialWeight || s.firstWeight
    const latest = s.currentWeight
    const diff = latest != null && baseline ? latest - baseline : null
    const amount = diff == null ? null : util.displayWeight(Math.abs(diff), unit)
    const changeDisplay = diff == null ? '--' : Number(amount) === 0 ? '0.0' : `${diff > 0 ? '+' : '−'}${amount}`
    const today = util.getToday()
    const week = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()]
    const weightText = latest == null ? '--' : util.displayWeight(latest, unit)
    const numSize = fitNumberSize(weightText)
    this.setData({
      userInfo: user, unitLabel: util.displayUnit(unit), weightUnit: unit,
      todayDate: today, dateLabel: `${util.formatDisplayDate(today)} 周${week}`,
      todayWeight: s.latestDate === today ? util.displayWeight(latest, unit) : null,
      currentWeight: weightText, numSize,
      latestDate: s.latestDate || '', firstWeight: baseline ? util.displayWeight(baseline, unit) : '--',
      totalDays: s.totalDays || 0, streak: s.latestDate >= util.daysAgo(1) ? s.streak || 0 : 0,
      changeDisplay
    }, () => this.calibrateNumber())
  },
  async loadSummary() {
    const user = this.data.userInfo
    if (!user) return
    const request = this._summaryRequest = (this._summaryRequest || 0) + 1
    const dates = util.getDateRange(7)
    this.setData({ chartError: '', chartLoading: true })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('records').where({ openId: user.openId, date: db.command.gte(dates[0]) }).orderBy('date', 'asc').limit(20).get()
      if (request !== this._summaryRequest) return
      const byDate = {}
      res.data.forEach(r => { byDate[r.date] = Number(util.displayWeight(r.weight, user.weightUnit)) })
      const summary = summarize(res.data, user, dates)
      const wd = ['日', '一', '二', '三', '四', '五', '六']
      this.setData({
        ...summary,
        week: (summary.week || []).map(d => ({ ...d, weekday: wd[new Date(d.date).getDay()] })),
        ...this.buildDelta(res.data, user),
        chartData: dates.map(date => ({ date, weight: byDate[date] == null ? null : byDate[date] })),
        trendPointCount: res.data.length
      })
    } catch (err) {
      if (request === this._summaryRequest) this.setData({ chartError: '摘要加载失败', chartData: [], trendPointCount: 0, week: dates.slice(-7).map(date => ({ date, label: date.slice(8), today: date === util.getToday(), done: false })), insightTitle: '趋势暂时不可用', insightText: '' })
    } finally { if (request === this._summaryRequest) this.setData({ chartLoading: false }) }
  },
  // 「较上次」：最近两条记录之差（设计稿口径），不是相较起点
  buildDelta(records, user) {
    if (!records || records.length < 2) return { lastDeltaText: '', lastDeltaDir: '' }
    const prev = records[records.length - 2]
    const last = records[records.length - 1]
    if (!prev || !last || prev.weight == null || last.weight == null) return { lastDeltaText: '', lastDeltaDir: '' }
    const diff = Number((last.weight - prev.weight).toFixed(1))
    if (diff === 0) return { lastDeltaText: '与上次持平', lastDeltaDir: 'flat' }
    const amount = util.displayWeight(Math.abs(diff), user.weightUnit)
    return {
      lastDeltaText: `${diff < 0 ? '↓' : '↑'} 较上次 ${diff < 0 ? '−' : '+'}${amount} ${util.displayUnit(user.weightUnit)}`,
      lastDeltaDir: diff < 0 ? 'down' : 'up'
    }
  },
  goRecord() { wx.navigateTo({ url: '/pages/record/record' }) },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }) },
  goDay(e) { wx.navigateTo({ url: `/pages/record/record?date=${e.currentTarget.dataset.date}` }) },
  onShareAppMessage() { return { title: '把自己照顾好，从一次记录开始。', path: '/pages/index/index' } }
})
