const util = require('../../utils/util')

Page({
  data: {
    ranking: [],
    activeTab: 'loss',
    loading: true,
    groups: [],
    currentGroupId: ''
  },

  onShow() {
    this.loadGroups()
  },

  async loadGroups() {
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
      this.setData({ groups: [], currentGroupId: '', ranking: [], loading: false })
      return
    }

    const groupIds = app.globalData.groupIds
    let groups = []
    if (groupIds.length > 0) {
      const db = wx.cloud.database()
      const res = await db.collection('groups')
        .where({ _id: db.command.in(groupIds) })
        .field({ groupName: true })
        .get()
      groups = res.data
    }

    // 确保 currentGroupId 落在现有群组中，否则切到第一个
    let current = this.data.currentGroupId || app.globalData.currentGroupId
    const ids = groups.map(g => g._id)
    if (!ids.includes(current)) {
      current = ids[0] || ''
      if (current) app.switchGroup(current)
    }

    this.setData({ groups, currentGroupId: current })
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
      const groupId = app.globalData.currentGroupId

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
      const app = getApp()
      if (!app.globalData.rankingCache) {
        this.setData({ ranking: [], loading: false })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  switchGroup(e) {
    const groupId = e.currentTarget.dataset.id
    if (groupId === this.data.currentGroupId) return

    const app = getApp()
    app.switchGroup(groupId)
    this.setData({ currentGroupId: groupId })
    this.loadRanking()
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
