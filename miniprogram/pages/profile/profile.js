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
    userInfo: null
  },

  onShow() {
    this.loadProfile()
  },

  async loadProfile() {
    const app = getApp()
    const forceRefresh = app.globalData.needsRefresh
    app.globalData.needsRefresh = false

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
      userInfo: user
    })
  },

  setGoalType(e) {
    this.setData({ goalType: e.currentTarget.dataset.type })
  },

  async setWeightUnit(e) {
    const oldUnit = this.data.weightUnit
    const newUnit = e.currentTarget.dataset.unit
    if (oldUnit === newUnit) return

    const convertValue = (text) => {
      const v = parseFloat(text)
      if (!v || v <= 0) return text
      if (oldUnit === 'kg' && newUnit === 'jin') return (v * 2).toFixed(1)
      if (oldUnit === 'jin' && newUnit === 'kg') return (v / 2).toFixed(1)
      return text
    }

    this.setData({
      weightUnit: newUnit,
      unitLabel: util.displayUnit(newUnit),
      goalWeightText: convertValue(this.data.goalWeightText),
      initialWeightText: convertValue(this.data.initialWeightText),
      currentWeight: convertValue(this.data.currentWeight)
    })

    // 同步更新全局缓存单位并标记刷新（await 之前），避免切页太快时首页读到旧单位
    const app = getApp()
    if (app.globalData.userInfo) {
      app.globalData.userInfo.weightUnit = newUnit
    }
    app.globalData.needsRefresh = true

    // 持久化到云端
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateProfile',
        data: { weightUnit: newUnit }
      })
      if (res.result.code === 0) {
        app.setUserInfo(res.result.data)
      }
    } catch (err) {
      console.error('单位保存失败', err)
    }
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

  async onNicknameBlur() {
    if (this.data.nickName && this.data.nickName.trim() !== '') {
      await this.saveProfile()
    }
  },

  async saveProfile() {
    const nickName = this.data.nickName
    if (!nickName || nickName.trim() === '') {
      return
    }

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
      this.loadProfile()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '保存失败: ' + err.message, icon: 'none' })
    }
  },

  async saveGoal() {
    const goalWeight = parseFloat(this.data.goalWeightText)
    if (!goalWeight || goalWeight <= 0 || goalWeight > 300) {
      util.showToast('请输入有效的目标体重')
      return
    }

    util.showLoading('保存中...')
    try {
      const cloudData = {
        goalWeight: Math.round(util.toKg(goalWeight, this.data.weightUnit) * 100) / 100,
        goalType: this.data.goalType,
        weightUnit: this.data.weightUnit
      }
      const initialWeight = parseFloat(this.data.initialWeightText)
      if (initialWeight > 0 && initialWeight <= 300) {
        cloudData.initialWeight = Math.round(util.toKg(initialWeight, this.data.weightUnit) * 100) / 100
      }

      const res = await wx.cloud.callFunction({
        name: 'updateProfile',
        data: cloudData
      })

      if (res.result.code !== 0) {
        util.showError(res.result.msg || '保存失败')
        return
      }

      // 更新全局数据
      const user = res.result.data
      const app = getApp()
      app.setUserInfo(user)

      util.showSuccess('目标已保存')
      util.hideLoading()
      this.loadProfile()
    } catch (err) {
      console.error(err)
      util.showError('保存失败')
    }
  },

  goGroup() {
    wx.navigateTo({ url: '/pages/group/group' })
  },
})
