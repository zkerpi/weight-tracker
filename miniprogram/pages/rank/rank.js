const util = require('../../utils/util')

const METRICS = [
  { key: 'change', label: '减重' },
  { key: 'percent', label: '完成度' },
  { key: 'streak', label: '坚持' }
]

Page({
  data: {
    metrics: METRICS,
    metric: 'change',
    groups: [],
    currentGroupId: '',
    groupName: '',
    unitLabel: '斤',
    weightUnit: 'kg',
    podium: [],
    rest: [],
    me: null,
    meInPodium: false,
    idleCount: 0,
    totalCount: 0,
    myOpenId: '',
    loading: true,
    error: ''
  },

  onShow() {
    this.load()
  },

  async onPullDownRefresh() {
    try { await this.load(true) } finally { wx.stopPullDownRefresh() }
  },

  async load(force) {
    this.setData({ error: '' })
    const app = getApp()
    let user = null
    try {
      user = await app.ensureUser(force === true)
    } catch (e) {}
    if (!user) {
      this.setData({ loading: false, error: '暂时读不到你的资料，点这里重试' })
      return
    }

    const weightUnit = user.weightUnit || 'kg'
    const unitLabel = util.displayUnit(weightUnit)
    const groupIds = user.groupIds || app.globalData.groupIds || []

    let groups = []
    if (groupIds.length > 0) {
      try {
        const db = wx.cloud.database()
        const res = await db.collection('groups')
          .where({ _id: db.command.in(groupIds) })
          .field({ groupName: true })
          .get()
        groups = res.data || []
      } catch (e) {
        groups = []
      }
    }

    let current = this.data.currentGroupId || app.globalData.currentGroupId
    const ids = groups.map(g => g._id)
    if (!ids.includes(current)) current = ids[0] || ''
    // 只在真正换了小组时才切全局状态，避免每次进页面都触发一次强制刷新
    if (current && app.globalData.currentGroupId !== current) app.switchGroup(current)
    const group = groups.filter(g => g._id === current)[0] || null

    this.setData({
      groups,
      currentGroupId: current,
      groupName: group ? (group.groupName || '我的小组') : '',
      myOpenId: user.openId || app.globalData.openId || '',
      weightUnit,
      unitLabel
    })

    if (!current) {
      this.setData({ podium: [], rest: [], me: null, meInPodium: false, idleCount: 0, totalCount: 0, loading: false })
      return
    }
    await this.loadRanking()
  },

  async loadRanking() {
    const request = this._req = (this._req || 0) + 1
    const app = getApp()
    const groupId = this.data.currentGroupId
    if (!groupId) return

    const cache = app.cacheGet('ranking')
    if (cache && cache.groupId === groupId) {
      this.render(cache.raw)
    } else {
      this.setData({ loading: true })
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'getRanking', data: { groupId } })
      if (request !== this._req) return
      if (!res.result || res.result.code !== 0) throw new Error((res.result && res.result.msg) || '加载失败')
      app.cacheSet('ranking', { groupId, raw: res.result.data }, 60000)
      this.render(res.result.data)
    } catch (e) {
      if (request !== this._req) return
      const stale = this.data.totalCount > 0
      this.setData({ loading: false, error: stale ? '' : '榜单加载失败，点这里重试' })
    }
  },

  // 统一算出每个成员的展示值，再按当前指标排序、分档
  render(raw) {
    const metric = this.data.metric
    const unit = this.data.weightUnit
    const unitLabel = this.data.unitLabel
    const myOpenId = this.data.myOpenId
    const list = Array.isArray(raw) ? raw : []

    const entries = list.map(r => {
      const change = Number(r.totalChange || 0)
      return {
        openId: r.openId,
        nickName: r.nickName || '伙伴',
        avatarUrl: r.avatarUrl || '',
        isMe: r.openId === myOpenId,
        rawChange: change,
        rawPercent: Number(r.changePercent || 0),
        streak: Number(r.streak || 0),
        totalDays: Number(r.totalDays || 0),
        weightText: r.currentWeight ? util.displayWeight(r.currentWeight, unit) : ''
      }
    })

    const idleCount = entries.filter(e => e.totalDays <= 0).length
    const active = entries.filter(e => e.totalDays > 0)

    const sortKey = metric === 'percent' ? 'rawPercent' : metric === 'streak' ? 'streak' : 'rawChange'
    active.sort((a, b) => (b[sortKey] - a[sortKey]) || (b.totalDays - a.totalDays))

    const ranked = active.map((e, i) => {
      const item = Object.assign({}, e, { place: i + 1, key: e.openId })
      if (metric === 'percent') {
        item.metricValue = String(Math.round(e.rawPercent))
        item.metricUnit = '%'
        item.valueDir = e.rawPercent >= 100 ? 'good' : 'flat'
        item.subText = e.rawPercent >= 100
          ? '已经到目标了'
          : (e.weightText ? '当前 ' + e.weightText + ' ' + unitLabel : '目标完成度')
      } else if (metric === 'streak') {
        item.metricValue = String(e.streak)
        item.metricUnit = '天'
        item.valueDir = 'flat'
        item.subText = '累计记录 ' + e.totalDays + ' 天'
      } else {
        item.metricValue = e.rawChange > 0
          ? util.displayWeight(e.rawChange, unit)
          : e.rawChange < 0
            ? '+' + util.displayWeight(-e.rawChange, unit)
            : '0.0'
        item.metricUnit = unitLabel
        item.valueDir = e.rawChange > 0 ? 'good' : e.rawChange < 0 ? 'warn' : 'flat'
        item.subText = e.weightText ? '当前 ' + e.weightText + ' ' + unitLabel : '已上榜'
      }
      return item
    })

    const top3 = ranked.slice(0, 3)
    const slotOrder = [2, 1, 3]
    const podium = slotOrder.map(place => {
      const found = top3[place - 1]
      return found ? found : { empty: true, place, key: 'empty-' + place }
    })
    const me = ranked.filter(e => e.isMe)[0] || null

    this.setData({
      podium,
      rest: ranked.slice(3),
      me,
      meInPodium: !!me && me.place <= 3,
      idleCount,
      totalCount: ranked.length,
      loading: false
    })
  },

  switchMetric(e) {
    const metric = e.currentTarget.dataset.key
    if (metric === this.data.metric) return
    this.setData({ metric })
    const app = getApp()
    const cache = app.cacheGet('ranking')
    if (cache && cache.groupId === this.data.currentGroupId) {
      this.render(cache.raw)
    } else {
      this.loadRanking()
    }
  },

  switchGroup(e) {
    const groupId = e.currentTarget.dataset.id
    if (groupId === this.data.currentGroupId) return
    const app = getApp()
    app.switchGroup(groupId)
    const group = this.data.groups.filter(g => g._id === groupId)[0]
    this.setData({
      currentGroupId: groupId,
      groupName: group ? (group.groupName || '我的小组') : '',
      podium: [], rest: [], me: null, meInPodium: false, totalCount: 0
    })
    this.loadRanking()
  },

  goGroup() { wx.switchTab({ url: '/pages/group/group' }) },
  goRecord() { wx.navigateTo({ url: '/pages/record/record' }) },
  retry() { this.load(true) },

  onShareAppMessage() {
    const name = this.data.groupName || '我的小组'
    return {
      title: '来「' + name + '」，和我一起稳稳变轻',
      path: '/pages/index/index'
    }
  }
})
