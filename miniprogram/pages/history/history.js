const util = require('../../utils/util')

Page({
  data: {
    records: [],
    loading: true,
    gaps: []
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    util.showLoading()
    try {
      const app = getApp()
      let user = app.globalData.userInfo
      if (!user) {
        const res = await wx.cloud.callFunction({ name: 'login', data: {} })
        if (res.result.code === 0) {
          user = res.result.data
          app.setUserInfo(user)
        }
      }
      if (!user) {
        util.showError('获取用户信息失败')
        return
      }

      const weightUnit = user.weightUnit || 'kg'
      const unitLabel = util.displayUnit(weightUnit)
      const db = wx.cloud.database()
      const res = await db.collection('records')
        .where({ openId: user.openId })
        .orderBy('date', 'desc')
        .limit(1000)
        .get()

      const records = res.data.map((r, i, arr) => {
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

      // 检测最近7天的补签缺口（最多显示3个）
      const gaps = []
      if (records.length > 0) {
        const today = util.getToday()
        const oldestDate = records[records.length - 1].date
        // 从今天往前倒推7天
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
      }

      this.setData({ records, gaps, loading: false, unitLabel })
    } catch (err) {
      console.error(err)
      util.showError('加载失败')
    } finally {
      util.hideLoading()
    }
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
            this.loadRecords()
          } catch (err) {
            util.showError('删除失败')
          }
        }
      }
    })
  }
})
