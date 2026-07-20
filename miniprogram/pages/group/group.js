const util = require('../../utils/util')

Page({
  data: {
    groupName: '',
    groupNameValid: false,
    inviteCode: '',
    inviteCodeValid: false,
    myGroup: null
  },

  onShow() {
    this.loadMyGroup()
  },

  async loadMyGroup() {
    try {
      const app = getApp()
      const user = app.globalData.userInfo

      if (user && user.groupId) {
        const db = wx.cloud.database()
        const groupRes = await db.collection('groups').doc(user.groupId).get()
        this.setData({ myGroup: groupRes.data })
      } else {
        this.setData({ myGroup: null })
      }
    } catch (err) {
      console.error(err)
    }
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
        user.groupId = group._id
        app.setUserInfo(user)

        util.showSuccess('群组创建成功！')
        this.setData({
          myGroup: group,
          groupName: ''
        })
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
        user.groupId = group._id
        app.setUserInfo(user)

        util.showSuccess('加入成功！')
        this.setData({
          myGroup: group,
          inviteCode: ''
        })
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

  copyInviteCode() {
    if (this.data.myGroup && this.data.myGroup.inviteCode) {
      wx.setClipboardData({
        data: this.data.myGroup.inviteCode,
        tip: '邀请码已复制'
      })
    }
  },

  onShareAppMessage() {
    const group = this.data.myGroup
    if (group) {
      return {
        title: `加入「${group.groupName}」一起打卡减重吧！邀请码：${group.inviteCode}`,
        path: '/pages/group/group'
      }
    }
    return {
      title: '来轻量级好友一起打卡减重吧！',
      path: '/pages/group/group'
    }
  },

  async leaveGroup() {
    wx.showModal({
      title: '退出群组',
      content: '确定退出当前群组吗？',
      success: async (res) => {
        if (res.confirm) {
          util.showLoading()
          try {
            const res = await wx.cloud.callFunction({ name: 'leaveGroup', data: {} })
            if (res.result.code === 0) {
              const app = getApp()
              const user = app.globalData.userInfo
              user.groupId = null
              app.setUserInfo(user)
              util.showSuccess('已退出')
              this.setData({ myGroup: null })
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
