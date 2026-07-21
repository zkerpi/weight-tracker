const util = require('../../utils/util')

Page({
  data: {
    records: [],
    loading: true
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

      this.setData({ records, loading: false, unitLabel: util.displayUnit(weightUnit) })
    } catch (err) {
      console.error(err)
      util.showError('加载失败')
    } finally {
      util.hideLoading()
    }
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
