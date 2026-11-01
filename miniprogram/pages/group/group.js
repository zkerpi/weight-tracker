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
    showJoinForm: false,
    showManagement: false
  },

  onLoad(query) {
    if (query.inviteCode) {
      this.setData({ inviteCode: query.inviteCode.toUpperCase(), inviteCodeValid: true })
      // 先展示信息，由用户主动加入。
      this.setData({ showJoinForm: true })
    }
  },

  onShow() {
    // 从「我的小组 / 我页」过来时可能要求直接展开创建与加入的表单
    const app = getApp()
    if (app.globalData.openJoinForm) {
      app.globalData.openJoinForm = false
      this.setData({ showJoinForm: true })
    }
    this.loadMyGroups().catch(() => { this.setData({ groupLoading: false }); util.showError('小组加载失败，请重试') })
  },

  async loadMyGroups() {
    const app = getApp()
    const user = await app.ensureUser(false)

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

  // 成员展示字段：体重与「较上次」来自 users.stats 快照，避免逐人查记录
  decorateMembers(members) {
    const today = util.getToday()
    const yesterday = util.daysAgo(1)
    return (members || []).map(m => {
      const s = m.stats || {}
      const unit = m.weightUnit === 'jin' ? 'jin' : 'kg'
      const hasWeight = s.currentWeight != null
      const delta = s.lastDelta
      let timeText = ''
      if (s.latestDate === today) timeText = '今天'
      else if (s.latestDate === yesterday) timeText = '昨天'
      else if (s.latestDate) timeText = util.formatDisplayDate(s.latestDate)
      const hasDelta = delta != null && Number(delta) !== 0
      return {
        openId: m.openId,
        nickName: m.nickName,
        avatarUrl: m.avatarUrl,
        weightText: hasWeight ? util.displayWeight(s.currentWeight, unit) : '',
        unitText: unit === 'jin' ? '斤' : 'kg',
        deltaText: hasDelta ? (delta < 0 ? '▼' : '▲') + ' ' + util.displayWeight(Math.abs(delta), unit) : '',
        deltaDir: hasDelta ? (delta < 0 ? 'down' : 'up') : '',
        timeText,
        statusText: s.latestDate === today ? '记录了体重' : (hasWeight ? '今日还没记' : '还没有记录'),
        doneToday: s.latestDate === today
      }
    })
  },

  async loadGroupDetail(groupId) {
    const request = this._detailRequest = (this._detailRequest || 0) + 1
    const app = getApp()

    // 从缓存读取（瞬间显示）
    const cache = app.cacheGet('group')
    if (cache && cache.groupId === groupId) {
      this.setData({ myGroup: cache.group, members: this.decorateMembers(cache.members), groupLoading: false, myOpenId: app.globalData.openId, isCreator: cache.group.creator === app.globalData.openId })
    } else {
      this.setData({ groupLoading: true, myGroup: null, members: [], isCreator: false })
      util.showLoading()
    }

    // 后台刷新
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGroupMembers',
        data: { groupId }
      })
      util.hideLoading()
      if (request !== this._detailRequest) return
      if (res.result.code === 0) {
        const { group, members } = res.result.data
        const myOpenId = app.globalData.openId || ''
        app.cacheSet('group', { groupId, group, members }, 60000)
        this.setData({ myGroup: group, members: this.decorateMembers(members), groupLoading: false, myOpenId, isCreator: group.creator === myOpenId })
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

  toggleManagement() {
    this.setData({ showManagement: !this.data.showManagement })
  },

  goRanking() {
    wx.navigateTo({ url: '/pages/rank/rank' })
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
    if (this._creating) return
    const ready = await getApp().ensureUser(false)
    if (!ready) { util.showError('请重试'); return }
    const name = this.data.groupName.trim()
    if (!name) {
      util.showToast('请输入群组名称')
      return
    }

    this._creating = true
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
        user.groupIds = Array.from(new Set((user.groupIds || []).concat([group._id])))
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
      this._creating = false
      util.hideLoading()
    }
  },

  async joinGroup() {
    const ready = await getApp().ensureUser(false)
    if (!ready) { util.showError('请重试'); return }
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
        const group = Object.assign({}, this.data.myGroup, { groupName: name })
        this.setData({ myGroup: group, editingName: false })
        getApp().cacheClear(['group', 'groupNames', 'ranking'])
        this.loadMyGroups()
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
              getApp().cacheClear('group')
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
              app.cacheClear('group')
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
              app.cacheClear('group')
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
