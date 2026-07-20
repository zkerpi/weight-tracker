const util = require('../../utils/util')

Page({
  data: {
    ranking: [],
    activeTab: 'loss',
    loading: true
  },

  onShow() {
    this.loadRanking()
  },

  async loadRanking() {
    this.setData({ loading: true })
    try {
      const app = getApp()
      const groupId = app.globalData.groupId

      const res = await wx.cloud.callFunction({
        name: 'getRanking',
        data: { groupId }
      })

      if (res.result.code === 0) {
        let ranking = res.result.data

        // 根据当前tab排序
        if (this.data.activeTab === 'percent') {
          ranking.sort((a, b) => b.changePercent - a.changePercent)
        } else if (this.data.activeTab === 'streak') {
          ranking.sort((a, b) => b.streak - a.streak)
        }

        // 过滤：只显示有记录的用户
        ranking = ranking.filter(r => r.totalDays > 0)

        this.setData({ ranking, loading: false })
      } else {
        util.showError('获取排行失败')
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error(err)
      util.showError('网络错误')
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab })
    this.loadRanking()
  }
})
