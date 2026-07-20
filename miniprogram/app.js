App({
  globalData: {
    userInfo: null,
    openId: null,
    groupId: null,
    needsRefresh: false,
    groupCache: null
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
    this.globalData.groupId = user.groupId || null
  }
})
