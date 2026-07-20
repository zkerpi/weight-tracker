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
    groupId: null,
    groupName: '',
    userInfo: null
  },

  onShow() {
    this.loadProfile()
  },

  async loadProfile() {
    util.showLoading()
    try {
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
        return
      }

      // 获取群组名称
      let groupName = ''
      if (user.groupId) {
        try {
          const db = wx.cloud.database()
          const groupRes = await db.collection('groups').doc(user.groupId).get()
          groupName = groupRes.data.groupName || ''
        } catch (e) {}
      }

      // 获取打卡统计
      const db = wx.cloud.database()
      const countRes = await db.collection('records')
        .where({ openId: user.openId })
        .count()
      const totalDays = countRes.total

      const lastRes = await db.collection('records')
        .where({ openId: user.openId })
        .orderBy('date', 'desc')
        .limit(1)
        .get()
      const currentWeight = lastRes.data.length > 0 ? lastRes.data[0].weight : null
      const weightUnit = user.weightUnit || 'kg'
      const unitLabel = util.displayUnit(weightUnit)

      this.setData({
        nickName: user.nickName || '用户',
        avatarUrl: user.avatarUrl || '',
        avatarTempUrl: '',
        weightUnit,
        unitLabel,
        goalType: user.goalType || 'lose',
        goalType: user.goalType || 'lose',
        goalWeightText: user.goalWeight ? util.displayWeight(user.goalWeight, weightUnit) : '',
        initialWeightText: user.initialWeight ? util.displayWeight(user.initialWeight, weightUnit) : '',
        currentWeight: currentWeight !== null ? util.displayWeight(currentWeight, weightUnit) : null,
        totalDays,
        groupId: user.groupId,
        groupName,
        userInfo: user
      })
    } catch (err) {
      console.error(err)
      util.showError('加载个人数据失败')
    } finally {
      util.hideLoading()
    }
  },

  setGoalType(e) {
    this.setData({ goalType: e.currentTarget.dataset.type })
  },

  setWeightUnit(e) {
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
      initialWeightText: convertValue(this.data.initialWeightText)
    })
  },

  onGoalInput(e) {
    this.setData({ goalWeightText: e.detail.value })
  },

  onInitialWeightInput(e) {
    this.setData({ initialWeightText: e.detail.value })
  },

 async onChooseAvatar() {
    try {
      const media = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      const tempUrl = media.tempFiles[0].tempFilePath
      this.setData({ avatarUrl: tempUrl })
    } catch (_) {
      return  // 用户取消了选择
    }
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
      // 即使上传失败也继续保存，至少保存昵称和 setupDone
      this.setData({ avatarTempUrl: tempUrl })
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
        goalWeight: Math.round(util.toKg(goalWeight, this.data.weightUnit) * 10) / 10,
        goalType: this.data.goalType,
        weightUnit: this.data.weightUnit
      }
      const initialWeight = parseFloat(this.data.initialWeightText)
      if (initialWeight > 0 && initialWeight <= 300) {
        cloudData.initialWeight = Math.round(util.toKg(initialWeight, this.data.weightUnit) * 10) / 10
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

  async leaveGroup() {
    wx.showModal({
      title: '提示',
      content: '确定退出当前群组吗？退出后排行榜将不再显示你的数据。',
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
              util.showSuccess('已退出群组')
              this.loadProfile()
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
  },
})
