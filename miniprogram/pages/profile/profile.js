const util = require('../../utils/util')

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    avatarTempUrl: '',
    weightUnit: 'kg',
    unitLabel: 'kg',
    goalType: 'lose',
    goalWeightText: '',
    initialWeightText: '',
    currentWeight: null,
    totalDays: 0,
    groupCount: 0,
    groupText: '',
    goalProgress: null,
    hasGoal: false,
    goalTarget: '',
    editingProfile: false,
    editingGoal: false,
    savingProfile: false,
    saving: false,
    userInfo: null
  },

  onShow() {
    this.loadProfile()
  },

  async loadProfile() {
    const app = getApp()
    const forceRefresh = app.globalData.needsRefresh

    // 需要最新数据：强制刷新 / 未登录 / 尚无 stats 快照
    const user = await app.ensureUser(forceRefresh, '加载中')
    if (!user) {
      util.showError('加载个人数据失败')
      return
    }

    // 统计直接读 stats 快照（无记录查询）
    const s = user.stats || {}
    const weightUnit = user.weightUnit || 'kg'
    const unitLabel = util.displayUnit(weightUnit)
    const totalDays = s.totalDays || 0
    const currentWeight = s.currentWeight != null ? util.displayWeight(s.currentWeight, weightUnit) : null

    // 群名列表：groupIds 未变则用缓存（0 查询）
    let myGroups = []
    const groupIds = user.groupIds || (user.groupId ? [user.groupId] : [])
    if (groupIds.length > 0) {
      const gKey = groupIds.slice().sort().join(',')
      const gCache = app.cacheGet('groupNames')
      if (gCache && gCache.key === gKey) {
        myGroups = gCache.groups
      } else {
        try {
          const db = wx.cloud.database()
          const groupResult = await db.collection('groups')
            .where({ _id: db.command.in(groupIds) })
            .field({ groupName: true })
            .get()
          myGroups = groupResult.data || []
          app.cacheSet('groupNames', { key: gKey, groups: myGroups }, 60000)
        } catch (e) {
          console.error(e)
        }
      }
    }
    const groupCount = myGroups.length
    let groupText = '未加入'
    if (groupCount > 0) {
      const firstName = myGroups[0].groupName || ''
      groupText = groupCount === 1 ? firstName : `${firstName} 等 ${groupCount} 个`
    }

    // 头像 cloud:// 转临时 URL：源未变则用缓存
    let displayAvatar = user.avatarUrl || ''
    if (displayAvatar.startsWith('cloud://')) {
      const aCache = app.cacheGet('avatar')
      if (aCache && aCache.source === displayAvatar) {
        displayAvatar = aCache.tempUrl
      } else {
        try {
          const { fileList } = await wx.cloud.getTempFileURL({
            fileList: [displayAvatar]
          })
          if (fileList && fileList[0] && fileList[0].tempFileURL) {
            displayAvatar = fileList[0].tempFileURL
            app.cacheSet('avatar', { source: user.avatarUrl, tempUrl: displayAvatar }, 60000)
          }
        } catch (_) {}
      }
    }

    this.setData({
      nickName: user.nickName || '用户',
      avatarUrl: displayAvatar,
      avatarTempUrl: '',
      weightUnit,
      unitLabel,
      goalType: user.goalType || 'lose',
      goalWeightText: user.goalWeight ? util.displayWeight(user.goalWeight, weightUnit) : '',
      initialWeightText: user.initialWeight ? util.displayWeight(user.initialWeight, weightUnit) : '',
      currentWeight,
      totalDays,
      groupCount,
      groupText,
      goalProgress: this.getGoalProgress(user),
      hasGoal: !!user.goalWeight,
      goalTarget: user.goalWeight ? util.displayWeight(user.goalWeight, weightUnit) : '',
      userInfo: user
    })
  },

  getGoalProgress(user) {
    const current = (user.stats || {}).currentWeight
    const initial = user.initialWeight || (user.stats || {}).firstWeight
    const goal = user.goalWeight
    if (current == null || !initial || !goal) return null
    const gain = user.goalType === 'gain'
    const total = gain ? goal - initial : initial - goal
    if (total <= 0) return null
    const achieved = gain ? current - initial : initial - current
    const reached = gain ? current >= goal : current <= goal
    const percent = reached ? 100 : Math.max(0, Math.min(99, Math.round(achieved / total * 100)))
    const unit = user.weightUnit || 'kg'
    return {
      unitLabel: util.displayUnit(unit),
      percent,
      caption: reached ? '已达到设定目标，继续关注长期变化' : `距目标 ${util.displayWeight(Math.abs(current - goal), unit)} ${util.displayUnit(unit)}`,
      current: util.displayWeight(current, unit),
      start: util.displayWeight(initial, unit),
      target: util.displayWeight(goal, unit)
    }
  },

  startEditProfile() {
    this.setData({ editingProfile: true })
  },

  cancelEditProfile() {
    const user = this.data.userInfo || {}
    this.setData({ editingProfile: false, nickName: user.nickName || '用户' })
  },

  toggleGoalEditor() {
    this.goGoal()
  },

  goGoal() { wx.navigateTo({ url: '/pages/goal/goal' }) },

  goUnit() { wx.navigateTo({ url: '/pages/unit/unit' }) },

  resetGoalDraft() {
    const user = this.data.userInfo || {}
    const unit = user.weightUnit || 'kg'
    const stats = user.stats || {}
    this.setData({
      weightUnit: unit,
      unitLabel: util.displayUnit(unit),
      goalType: user.goalType || 'lose',
      goalWeightText: user.goalWeight ? util.displayWeight(user.goalWeight, unit) : '',
      initialWeightText: user.initialWeight ? util.displayWeight(user.initialWeight, unit) : '',
      currentWeight: stats.currentWeight != null ? util.displayWeight(stats.currentWeight, unit) : null
    })
  },

  setGoalType(e) {
    this.setData({ goalType: e.currentTarget.dataset.type })
  },

  setWeightUnit(e) {
    const oldUnit = this.data.weightUnit
    const newUnit = e.currentTarget.dataset.unit
    if (oldUnit === newUnit || this.data.saving) return
    const convert = value => value ? util.displayWeight(util.toKg(Number(value), oldUnit), newUnit) : value
    this.setData({ weightUnit: newUnit, unitLabel: util.displayUnit(newUnit), goalWeightText: convert(this.data.goalWeightText), initialWeightText: convert(this.data.initialWeightText), currentWeight: convert(this.data.currentWeight) })
  },

  onGoalInput(e) {
    this.setData({ goalWeightText: e.detail.value })
  },

  onInitialWeightInput(e) {
    this.setData({ initialWeightText: e.detail.value })
  },

  async onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return
    this.setData({ avatarUrl })
    // 上传头像到云存储，获取永久链接
    try {
      const tempUrl = this.data.avatarUrl
      const suffix = tempUrl.match(/\.(\w+)$/)?.[1] || 'jpg'
      const cloudPath = `avatars/${Date.now()}.${suffix}`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempUrl
      })
      this.setData({ avatarTempUrl: uploadRes.fileID })
    } catch (err) {
      console.error('头像上传失败', err)
      util.showError('头像上传失败')
      return
    }
    await this.saveProfile()
  },

  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  async saveProfile() {
    if (this.data.savingProfile) return
    const nickName = this.data.nickName
    if (!nickName || nickName.trim() === '') {
      util.showToast('昵称不能为空')
      return
    }

    this.setData({ savingProfile: true })
    try {
      const cloudData = { nickName: nickName.trim() }
      if (this.data.avatarTempUrl) {
        cloudData.avatarUrl = this.data.avatarTempUrl
      }

      const res = await wx.cloud.callFunction({
        name: 'updateProfile',
        data: cloudData
      })

      if (res.result.code !== 0) {
        wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' })
        return
      }

      // 更新全局数据
      const user = res.result.data
      const app = getApp()
      app.setUserInfo(user)
      app.clearPageCaches()
      this.setData({ userInfo: user, avatarTempUrl: '', nickName: user.nickName, editingProfile: false })
      util.showSuccess('资料已保存')
    } catch (err) {
      console.error(err)
      util.showError('保存失败，请重试')
    } finally { this.setData({ savingProfile: false }) }
  },

  async saveGoal() {
    if (this.data.saving) return
    if (!this.data.userInfo) { util.showToast('请等待个人数据加载完成'); return }
    const unit = this.data.weightUnit
    const goal = util.toKg(Number(this.data.goalWeightText), unit)
    const initial = this.data.initialWeightText ? util.toKg(Number(this.data.initialWeightText), unit) : null
    if (!Number.isFinite(goal) || goal <= 0 || goal > 300) { util.showToast('请填写有效的目标体重'); return }
    if (initial !== null && (!Number.isFinite(initial) || initial <= 0 || initial > 300)) { util.showToast('请填写有效的初始体重'); return }
    const baseline = initial || (this.data.userInfo.stats || {}).firstWeight
    if (baseline && ((this.data.goalType === 'lose' && goal >= baseline) || (this.data.goalType === 'gain' && goal <= baseline))) { util.showToast('目标体重与所选方向不一致'); return }
    this.setData({ saving: true })
    try {
      const data = { goalWeight: Math.round(goal * 100) / 100, goalType: this.data.goalType, weightUnit: unit }
      if (initial !== null) data.initialWeight = Math.round(initial * 100) / 100
      const res = await wx.cloud.callFunction({ name: 'updateProfile', data })
      if (!res.result || res.result.code !== 0) throw new Error('保存失败')
      getApp().setUserInfo(res.result.data)
      getApp().clearPageCaches()
      getApp().globalData.needsRefresh = true
      this.setData({
        userInfo: res.result.data,
        goalProgress: this.getGoalProgress(res.result.data),
        hasGoal: true,
        goalTarget: util.displayWeight(res.result.data.goalWeight, res.result.data.weightUnit),
        editingGoal: false
      })
      util.showSuccess('目标已保存')
    } catch (err) { util.showError('保存失败，请重试') }
    finally { this.setData({ saving: false }) }
  },

  goGroup() {
    wx.switchTab({ url: '/pages/group/group' })
  },

  // 「所属小组」不是快捷入口，而是我的小组清单：多小组时先选再进，
  // 免得点进去看到的是上次停留的那个组、和自己想的不是同一个。
  goGroups() {
    if (this.data.groupCount === 0) {
      getApp().globalData.openJoinForm = true
      wx.switchTab({ url: '/pages/group/group' })
      return
    }
    wx.navigateTo({ url: '/pages/groups/groups' })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  }
})
