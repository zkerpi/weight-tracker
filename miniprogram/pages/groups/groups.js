const util = require('../../utils/util')

Page({
  data: {
    groups: [],
    currentGroupId: '',
    loading: true,
    error: ''
  },

  onShow() { this.load() },

  async load() {
    const app = getApp()
    const user = await app.ensureUser(false)
    if (!user) {
      this.setData({ loading: false, error: '暂时读不到你的小组' })
      return
    }
    const ids = user.groupIds || (user.groupId ? [user.groupId] : [])
    if (!ids.length) {
      this.setData({ groups: [], currentGroupId: '', loading: false, error: '' })
      return
    }

    const myOpenId = app.globalData.openId || user.openId || ''
    try {
      const db = wx.cloud.database()
      const res = await db.collection('groups')
        .where({ _id: db.command.in(ids) })
        .field({ groupName: true, inviteCode: true, creator: true, members: true })
        .get()
      const byId = {}
      ;(res.data || []).forEach(g => { byId[g._id] = g })
      // 按用户自己的加入顺序排，当前使用的排最前，一眼能看到
      const current = app.globalData.currentGroupId
      const groups = ids.map(id => byId[id]).filter(Boolean).map(g => ({
        _id: g._id,
        groupName: g.groupName || '我的小组',
        inviteCode: g.inviteCode || '',
        memberCount: (g.members || []).length,
        isCreator: g.creator === myOpenId
      }))
      groups.sort((a, b) => (b._id === current) - (a._id === current))
      this.setData({ groups, currentGroupId: current, loading: false, error: '' })
    } catch (err) {
      console.error(err)
      this.setData({ loading: false, error: '小组加载失败，点这里重试' })
    }
  },

  enter(e) {
    const id = e.currentTarget.dataset.id
    const app = getApp()
    if (id !== this.data.currentGroupId) app.switchGroup(id)
    wx.switchTab({ url: '/pages/group/group' })
  },

  goCreate() {
    getApp().globalData.openJoinForm = true
    wx.switchTab({ url: '/pages/group/group' })
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code
    if (!code) return
    wx.setClipboardData({
      data: code,
      success: () => util.showToast('邀请码已复制')
    })
  },

  retry() { this.setData({ loading: true }); this.load() }
})
