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

  _processRanking(raw, activeTab, weightUnit) {
    // 根据当前tab排序
    if (activeTab === 'percent') {
      raw.sort((a, b) => b.changePercent - a.changePercent)
    } else if (activeTab === 'streak') {
      raw.sort((a, b) => b.streak - a.streak)
    }

    // 按显示单位转换
    const unitLabel = util.displayUnit(weightUnit)
    const ranking = raw.map(r => {
      const rawChange = r.totalChange || 0
      const absDisplay = weightUnit === 'jin' ? Math.abs(rawChange * 2).toFixed(1) : Math.abs(rawChange).toFixed(1)
      return {
        ...r,
        currentWeight: r.currentWeight ? util.displayWeight(r.currentWeight, weightUnit) : null,
        totalChange: rawChange,
        changeDisplay: absDisplay
      }
    }).filter(r => r.totalDays > 0)

    this.setData({ ranking, unitLabel, loading: false })
  },

  async loadRanking() {
    try {
      const app = getApp()
      const groupId = app.globalData.groupId

      if (!groupId) {
        this.setData({ ranking: [], loading: false })
        return
      }

      const weightUnit = (app.globalData.userInfo && app.globalData.userInfo.weightUnit) || 'kg'
      const activeTab = this.data.activeTab

      // 有缓存且不需要刷新 → 直接显示
      const cache = app.globalData.rankingCache
      if (cache && cache.groupId === groupId && !app.globalData.needsRefresh) {
        this._processRanking([...cache.raw], activeTab, weightUnit)
      } else {
        this.setData({ loading: true })
      }

      // 后台拉取最新数据
      const res = await wx.cloud.callFunction({
        name: 'getRanking',
        data: { groupId }
      })

      if (res.result.code === 0) {
        app.globalData.rankingCache = { groupId, raw: res.result.data }
        this._processRanking(res.result.data, activeTab, weightUnit)
      }
    } catch (err) {
      console.error(err)
      if (!app.globalData.rankingCache) {
        this.setData({ ranking: [], loading: false })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab })

    // 走缓存重新排序，不请求云函数
    const app = getApp()
    const cache = app.globalData.rankingCache
    if (cache) {
      const weightUnit = (app.globalData.userInfo && app.globalData.userInfo.weightUnit) || 'kg'
      this._processRanking([...cache.raw], tab, weightUnit)
    } else {
      this.loadRanking()
    }
  }
})
