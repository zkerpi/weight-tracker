const util = require('../../utils/util')

const PAGE_SIZE = 50

Page({
  data: {
    records: [],
    loading: true,
    gaps: [],
    hasMore: true,
    loadingMore: false
  },

  onShow() {
    this.loadRecords(true)
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
        util.showError('获取用户信息失败')
        return
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

      const patch = { records, hasMore, loadingMore: false, loading: false, unitLabel }
      if (reset) patch.gaps = this._computeGaps(records)
      this.setData(patch)
    } catch (err) {
      console.error(err)
      this.setData({ loading: false, loadingMore: false })
      if (reset) util.showError('加载失败')
    } finally {
      if (reset) util.hideLoading()
    }
  },

  _formatRecords(rawRecords, weightUnit) {
    return rawRecords.map((r, i, arr) => {
      const prev = arr[i + 1]
      const diff = prev ? r.weight - prev.weight : 0
      const displayDiff = weightUnit === 'jin' ? (diff * 2) : diff
      return {
        _id: r._id,
        date: r.date,
        weight: util.displayWeight(r.weight, weightUnit),
        rawWeight: r.weight,
        note: r.note || '',
        diffFormatted: diff === 0 ? '持平' : (displayDiff > 0 ? '+' + displayDiff.toFixed(1) : displayDiff.toFixed(1)),
        diffUp: diff > 0,
        diffDown: diff < 0
      }
    })
  },

  // 最近7天补签缺口（最多3个），仅首屏计算
  _computeGaps(records) {
    const gaps = []
    if (records.length === 0) return gaps
    const today = util.getToday()
    const oldestDate = records[records.length - 1].date
    for (let i = 1; i <= 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = util.formatDate(d)
      if (dateStr < oldestDate) break // 不要超出最早记录
      if (dateStr >= today) continue // 今天不补
      const exists = records.some(r => r.date === dateStr)
      if (!exists) {
        gaps.push(dateStr)
        if (gaps.length >= 3) break
      }
    }
    return gaps
  },

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
            await wx.cloud.callFunction({
              name: 'deleteRecord',
              data: { recordId: id }
            })
            getApp().globalData.needsRefresh = true
            util.showSuccess('已删除')
            this.loadRecords(true)
          } catch (err) {
            util.showError('删除失败')
          }
        }
      }
    })
  }
})
