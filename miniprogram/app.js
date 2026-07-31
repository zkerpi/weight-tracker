App({
  globalData: {
    userInfo: null,
    openId: null,
    groupIds: [],
    currentGroupId: null,
    needsRefresh: false,
    groupCache: null,
    homeCache: null,
    groupNameCache: null,
    avatarTempCache: null
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-d9ghzs2af437701c3',
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
  }
})
