const util = require('../../utils/util')

Page({
  data: {
    groupName: '',
    groupNameValid: false,
    inviteCode: '',
    inviteCodeValid: false,
    groups: [],
    currentGroupId: '',
    myGroup: null,
    members: [],
    groupLoading: true,
    myOpenId: '',
    isCreator: false,
    editingName: false,
    editNameValue: '',
    showJoinForm: false
  },

  onLoad(query) {
    if (query.inviteCode) {
      this.setData({ inviteCode: query.inviteCode.toUpperCase(), inviteCodeValid: true })
      // 自动加入群组
      this.joinGroup()
    }
  },

  onShow() {
    this.loadMyGroups()
  },

  async loadMyGroups() {
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
      this.setData({ groups: [], currentGroupId: '', myGroup: null, members: [], groupLoading: false })
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
    if (current) {
      this.loadGroupDetail(current)
    } else {
      this.setData({ myGroup: null, members: [], groupLoading: false })
    }
  },

  async loadGroupDetail(groupId) {
    const app = getApp()

    // 从缓存读取（瞬间显示）
    const cache = app.globalData.groupCache
    if (cache && cache.groupId === groupId) {
      this.setData({ myGroup: cache.group, members: cache.members, groupLoading: false })
    } else {
      this.setData({ groupLoading: true })
      util.showLoading()
    }

    // 后台刷新
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGroupMembers',
        data: { groupId }
      })
      util.hideLoading()
      if (res.result.code === 0) {
        const { group, members } = res.result.data
        const myOpenId = app.globalData.openId || ''
        app.globalData.groupCache = { groupId, group, members }
        this.setData({ myGroup: group, members, groupLoading: false, myOpenId, isCreator: group.creator === myOpenId })
      }
    } catch (err) {
      util.hideLoading()
      console.error(err)
      if (!cache) {
        this.setData({ myGroup: null, members: [], groupLoading: false })
      }
    }
  },

  selectGroup(e) {
    const groupId = e.currentTarget.dataset.id
    if (groupId === this.data.currentGroupId) return
    const app = getApp()
    app.switchGroup(groupId)
    this.setData({ currentGroupId: groupId, showJoinForm: false })
    this.loadGroupDetail(groupId)
  },

  toggleJoinForm() {
    this.setData({ showJoinForm: !this.data.showJoinForm })
  },

  onGroupNameInput(e) {
    const val = e.detail.value
    this.setData({ groupName: val, groupNameValid: val.trim().length > 0 })
  },

  onInviteCodeInput(e) {
    const val = e.detail.value.toUpperCase()
    this.setData({ inviteCode: val, inviteCodeValid: val.length >= 4 })
  },

  async createGroup() {
    const name = this.data.groupName.trim()
    if (!name) {
      util.showToast('请输入群组名称')
      return
    }

    util.showLoading('创建中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'createGroup',
        data: { groupName: name }
      })

      if (res.result.code === 0) {
        const group = res.result.data
        const app = getApp()
        const user = app.globalData.userInfo
        user.groupIds = (user.groupIds || []).concat([group._id])
        app.setUserInfo(user)
        app.switchGroup(group._id)

        util.showSuccess('群组创建成功！')
        this.setData({ groupName: '', showJoinForm: false, currentGroupId: group._id })
        this.loadMyGroups()
      } else {
        util.showError(res.result.msg || '创建失败')
      }
    } catch (err) {
      console.error(err)
      util.showError('网络错误')
    } finally {
      util.hideLoading()
    }
  },

  async joinGroup() {
    const code = this.data.inviteCode.trim().toUpperCase()
    if (code.length < 4) {
      util.showToast('请输入完整的邀请码')
      return
    }

    util.showLoading('加入中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinGroup',
        data: { inviteCode: code }
      })

      if (res.result.code === 0) {
        const group = res.result.data
        const app = getApp()
        const user = app.globalData.userInfo
        user.groupIds = (user.groupIds || []).concat([group._id])
        app.setUserInfo(user)
        app.switchGroup(group._id)

        util.showSuccess('加入成功！')
        this.setData({ inviteCode: '', showJoinForm: false, currentGroupId: group._id })
        this.loadMyGroups()
      } else {
        util.showError(res.result.msg || '加入失败')
      }
    } catch (err) {
      console.error(err)
      util.showError('网络错误')
    } finally {
      util.hideLoading()
    }
  },

  startEditName() {
    this.setData({ editingName: true, editNameValue: this.data.myGroup.groupName })
  },

  onEditNameInput(e) {
    this.setData({ editNameValue: e.detail.value })
  },

  async saveGroupName() {
    const name = this.data.editNameValue.trim()
    if (!name) {
      util.showToast('请输入群组名称')
      return
    }
    util.showLoading()
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateGroupName',
        data: { groupId: this.data.myGroup._id, groupName: name }
      })
      if (res.result.code === 0) {
        const group = { ...this.data.myGroup, groupName: name }
        this.setData({ myGroup: group, editingName: false })
        getApp().globalData.groupCache = null
        util.showSuccess('群名已更新')
      } else {
        util.showError(res.result.msg || '修改失败')
      }
    } catch (err) {
      util.showError('网络错误')
    } finally {
      util.hideLoading()
    }
  },

  cancelEditName() {
    this.setData({ editingName: false })
  },

  kickMember(e) {
    const { openid, name } = e.currentTarget.dataset
    wx.showModal({
      title: '踢出成员',
      content: `确定将 ${name || '该成员'} 踢出群组吗？`,
      success: async (res) => {
        if (res.confirm) {
          util.showLoading()
          try {
            const res = await wx.cloud.callFunction({
              name: 'kickMember',
              data: { groupId: this.data.myGroup._id, targetOpenId: openid }
            })
            if (res.result.code === 0) {
              getApp().globalData.groupCache = null
              util.showSuccess('已踢出')
              this.loadGroupDetail(this.data.currentGroupId)
            } else {
              util.showError(res.result.msg || '操作失败')
            }
          } catch (err) {
            util.showError('网络错误')
          } finally {
            util.hideLoading()
          }
        }
      }
    })
  },

  disbandGroup() {
    const groupId = this.data.myGroup._id
    wx.showModal({
      title: '解散群组',
      content: '确定解散群组？此操作不可撤销，所有成员将被移出。',
      success: async (res) => {
        if (res.confirm) {
          util.showLoading()
          try {
            const res = await wx.cloud.callFunction({
              name: 'disbandGroup',
              data: { groupId }
            })
            if (res.result.code === 0) {
              const app = getApp()
              const user = app.globalData.userInfo
              user.groupIds = (user.groupIds || []).filter(id => id !== groupId)
              app.setUserInfo(user)
              app.globalData.groupCache = null
              util.showSuccess('已解散')
              this.setData({ myGroup: null, members: [] })
              this.loadMyGroups()
            } else {
              util.showError(res.result.msg || '操作失败')
            }
          } catch (err) {
            util.showError('网络错误')
          } finally {
            util.hideLoading()
          }
        }
      }
    })
  },

  copyInviteCode() {
    if (this.data.myGroup && this.data.myGroup.inviteCode) {
      wx.setClipboardData({
        data: this.data.myGroup.inviteCode
      })
      wx.showToast({ title: '邀请码已复制', icon: 'none' })
    }
  },

  onShareAppMessage() {
    const group = this.data.myGroup
    if (group) {
      return {
        title: `加入「${group.groupName}」一起打卡减重吧！`,
        path: `/pages/group/group?inviteCode=${group.inviteCode}`
      }
    }
    return {
      title: '来斤斤轻体重记一起打卡减重吧！',
      path: '/pages/group/group'
    }
  },

  async leaveGroup() {
    const groupId = this.data.myGroup._id
    wx.showModal({
      title: '退出群组',
      content: '确定退出当前群组吗？',
      success: async (res) => {
        if (res.confirm) {
          util.showLoading()
          try {
            const res = await wx.cloud.callFunction({ name: 'leaveGroup', data: { groupId } })
            if (res.result.code === 0) {
              const app = getApp()
              const user = app.globalData.userInfo
              user.groupIds = (user.groupIds || []).filter(id => id !== groupId)
              app.setUserInfo(user)
              app.globalData.groupCache = null
              util.showSuccess('已退出')
              this.setData({ myGroup: null, members: [] })
              this.loadMyGroups()
            } else {
              util.showError(res.result.msg || '操作失败')
            }
          } catch (err) {
            console.error(err)
            util.showError('操作失败')
          } finally {
            util.hideLoading()
          }
        }
      }
    })
  }
})
