const util = require('../../utils/util')

const PAGE_SIZE = 20

// 区间与 chartRanges 一一对应。首页「体重趋势」的「近7天」入口指向这里的第一档，
// 两处必须同步——否则从首页点进去看到的图和标签承诺的不是同一段时间。
const RANGE_DAYS = [7, 14, 30, 90, 365]

Page({
  data: {
    records: [],
    groups: [],
    loading: true,
    hasMore: true,
    loadingMore: false,
    chartData: [],
    chartRanges: ['7天', '14天', '30天', '90天', '1年'],
    chartRangeIndex: 0,
    chartLoading: true,
    chartError: '',
    hasChartData: false,
    goalWeight: null,
    goalType: 'lose'
  },

  async onShow() {
    const app = getApp()
    await app.ensureUser(app.globalData.needsRefresh)
    app.globalData.needsRefresh = false
    this.loadRecords(true)
    this.loadChart()
  },

  async loadChart() {
    const request = this._chartRequest = (this._chartRequest || 0) + 1
    this.setData({ chartLoading: true, chartError: '' })
    try {
      const user = await getApp().ensureUser(false)
      if (!user) throw new Error('无法获取用户')
      const dates = util.getDateRange(RANGE_DAYS[this.data.chartRangeIndex])
      const db = wx.cloud.database()
      const records = []
      let cursor = ''
      while (true) {
        const range = cursor ? db.command.gt(cursor).and(db.command.lte(util.getToday())) : db.command.gte(dates[0]).and(db.command.lte(util.getToday()))
        const res = await db.collection('records').where({ openId: user.openId, date: range }).orderBy('date', 'asc').limit(20).get()
        records.push(...res.data)
        if (res.data.length < 20) break
        cursor = res.data[res.data.length - 1].date
      }
      if (request !== this._chartRequest) return
      const byDate = {}
      records.forEach(r => { byDate[r.date] = Number(util.displayWeight(r.weight, user.weightUnit)) })
      const values = records.map(r => r.weight).filter(Number.isFinite)
      const change = values.length > 1 ? values[values.length - 1] - values[0] : null
      this.setData({
        periodCount: values.length,
        periodAverage: values.length ? util.displayWeight(values.reduce((a, b) => a + b, 0) / values.length, user.weightUnit) : '—',
        periodChange: change == null ? '—' : (change > 0 ? '+' : change < 0 ? '−' : '') + util.displayWeight(Math.abs(change), user.weightUnit),
        chartData: dates.map(date => ({ date, weight: byDate[date] == null ? null : byDate[date] })),
        hasChartData: records.length > 0,
        unitLabel: util.displayUnit(user.weightUnit),
        goalWeight: user.goalWeight ? Number(util.displayWeight(user.goalWeight, user.weightUnit)) : null,
        goalType: user.goalType || 'lose'
      })
    } catch (err) {
      if (request === this._chartRequest) this.setData({ chartError: '趋势加载失败，点击重试', chartData: [], hasChartData: false })
    } finally {
      if (request === this._chartRequest) this.setData({ chartLoading: false })
    }
  },

  onChartRangeChange(e) {
    this.setData({ chartRangeIndex: Number(e.currentTarget.dataset.index) })
    this.loadChart()
  },

  async loadRecords(reset) {
    if (!reset && (this.data.loadingMore || !this.data.hasMore)) return

    if (reset) {
      util.showLoading()
      this.setData({ loading: true, loadingMore: false })
    } else {
      this.setData({ loadingMore: true })
    }

    try {
      const app = getApp()
      const user = await app.ensureUser(false)
      if (!user) {
        throw new Error('获取用户信息失败')
      }

      const weightUnit = user.weightUnit || 'kg'
      const unitLabel = util.displayUnit(weightUnit)
      const db = wx.cloud.database()

      // 首次：取最新一批；加载更多：用日期游标取更早的（删除记录不会错位）
      const where = { openId: user.openId }
      if (!reset && this.data.records.length > 0) {
        where.date = db.command.lt(this.data.records[this.data.records.length - 1].date)
      }
      const res = await db.collection('records')
        .where(where)
        .orderBy('date', 'desc')
        .limit(PAGE_SIZE)
        .get()

      // 合并后用全部记录重算相邻差值
      const rawRecords = reset
        ? res.data
        : this.data.records.map(r => ({ _id: r._id, date: r.date, weight: r.rawWeight, note: r.note })).concat(res.data)
      const records = this._formatRecords(rawRecords, weightUnit)
      const hasMore = res.data.length === PAGE_SIZE

      const patch = { records, groups: this._groupRecords(records), hasMore, loadingMore: false, loading: false, unitLabel }
      patch.error = ''
      this.setData(patch)
    } catch (err) {
      console.error(err)
      this.setData({ loading: false, loadingMore: false, error: '记录加载失败，请重试' })
      if (reset) util.showError('加载失败')
    } finally {
      if (reset) util.hideLoading()
    }
  },

  _formatRecords(rawRecords, weightUnit) {
    const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return rawRecords.map((r, i, arr) => {
      const prev = arr[i + 1]
      const diff = prev ? r.weight - prev.weight : 0
      const displayDiff = weightUnit === 'jin' ? (diff * 2) : diff
      // 最早一条没有可比对象，留空而不是写「起始记录 / 暂无对比」——那串字每行都出现就成噪音。
      // 涨跌符号与小组动态统一用 ▲/▼，全站看到的是同一种语言。
      const formatted = !prev ? '' : diff === 0 ? '持平'
        : (displayDiff > 0 ? '▲ ' : '▼ ') + Math.abs(displayDiff).toFixed(1)
      return {
        _id: r._id,
        date: r.date,
        day: r.date.slice(8),
        week: WEEK[new Date(r.date).getDay()],
        monthKey: r.date.slice(0, 7),
        weight: util.displayWeight(r.weight, weightUnit),
        rawWeight: r.weight,
        note: r.note || '',
        diffFormatted: formatted,
        diffUp: diff > 0,
        diffDown: diff < 0
      }
    })
  },

  // 按月分段，并默认只展开最近一个月：
  // 记录一多，平铺的列表根本没有尽头，滑到哪儿都还是数字。
  // 折叠成月份的目录后，一屏就能看到「一共记了几个月」，想翻哪个月再展开。
  _groupRecords(records) {
    if (!this._openKeys) this._openKeys = new Set()
    const groups = []
    let cur = null
    records.forEach(r => {
      if (!cur || cur.key !== r.monthKey) {
        cur = { key: r.monthKey, label: Number(r.monthKey.slice(5)) + ' 月', items: [], count: 0, open: false }
        groups.push(cur)
      }
      cur.items.push(Object.assign({ first: cur.items.length === 0 }, r))
      cur.count = cur.items.length
    })
    // 首次进入时默认展开最新一个月；之后用户点开/收起过哪些就记住哪些。
    // 用 _didInitOpen 而不是「集合为空」判断——用户把月份全收起来后，
    // 上拉加载更早的记录不该把最新一个月又弹开。
    if (groups.length && !this._didInitOpen) {
      this._didInitOpen = true
      this._openKeys.add(groups[0].key)
    }
    groups.forEach(g => { g.open = this._openKeys.has(g.key) })
    return groups
  },

  toggleMonth(e) {
    const key = e.currentTarget.dataset.key
    const groups = this.data.groups.map(g => (g.key === key ? Object.assign({}, g, { open: !g.open }) : g))
    this._openKeys = new Set(groups.filter(g => g.open).map(g => g.key))
    this.setData({ groups })
  },

  retry() { this.loadRecords(true) },
  goRecord() { wx.navigateTo({ url: '/pages/record/record' }) },
  onReachBottom() {
    this.loadRecords(false)
  },

  goBackfill(e) {
    const { date } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/record/record?date=${date}` })
  },

  onDeleteRecord(e) {
    const { id, date } = e.currentTarget.dataset
    wx.showModal({
      title: '删除记录',
      content: `确定删除 ${date} 的体重记录吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'deleteRecord',
              data: { recordId: id }
            })
            if (!result.result || result.result.code !== 0) throw new Error('删除失败')
            getApp().clearPageCaches()
            getApp().globalData.needsRefresh = true
            util.showSuccess('已删除')
            await getApp().ensureUser(true)
            this.loadRecords(true)
            this.loadChart()
          } catch (err) {
            util.showError('删除失败')
          }
        }
      }
    })
  }
})
