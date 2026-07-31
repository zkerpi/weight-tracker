App({
  globalData: {
    userInfo: null,
    openId: null,
    groupIds: [],
    currentGroupId: null,
    needsRefresh: false,
    pageCache: {}
  },

  onLaunch() {
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    })
  },

  setUserInfo(user) {
    this.globalData.userInfo = user
    this.globalData.openId = user._openid || user.openId
    const groupIds = user.groupIds || (user.groupId ? [user.groupId] : [])
    this.globalData.groupIds = groupIds
    // 当前群组：优先取上次选择，无效则取第一个
    const saved = wx.getStorageSync('currentGroupId')
    this.globalData.currentGroupId = groupIds.includes(saved) ? saved : (groupIds[0] || null)
  },

  switchGroup(groupId) {
    this.globalData.currentGroupId = groupId
    this.globalData.needsRefresh = true
    wx.setStorageSync('currentGroupId', groupId)
  },

  // 确保 userInfo 可用：有 stats 快照且非强制刷新则直接返回，否则调 login
  async ensureUser(force, loadingTitle) {
    const u = this.globalData.userInfo
    if (!force && u && u.stats) return u
    if (loadingTitle) wx.showLoading({ title: loadingTitle, mask: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'login', data: {} })
      if (res.result && res.result.code === 0) {
        this.setUserInfo(res.result.data)
        return res.result.data
      }
      return null
    } finally {
      if (loadingTitle) wx.hideLoading()
    }
  },

  // 统一页面缓存（带 TTL，ttlMs 缺省表示不过期）
  cacheSet(key, value, ttlMs) {
    this.globalData.pageCache[key] = {
      value,
      expire: ttlMs ? Date.now() + ttlMs : 0
    }
  },

  cacheGet(key) {
    const entry = this.globalData.pageCache[key]
    if (!entry) return null
    if (entry.expire && Date.now() >= entry.expire) {
      delete this.globalData.pageCache[key]
      return null
    }
    return entry.value
  },

  cacheClear(keysOrKey) {
    const keys = Array.isArray(keysOrKey) ? keysOrKey : [keysOrKey]
    keys.forEach(k => delete this.globalData.pageCache[k])
  },

  clearPageCaches() {
    this.globalData.pageCache = {}
  }
})
