const util = require('../../utils/util')

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    goalType: 'lose',
    goalWeightText: '',
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
        util.hideLoading()
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

      this.setData({
        nickName: user.nickName || '用户',
        avatarUrl: user.avatarUrl || '',
        goalType: user.goalType || 'lose',
        goalWeightText: user.goalWeight ? String(user.goalWeight) : '',
        currentWeight,
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

  onGoalInput(e) {
    this.setData({ goalWeightText: e.detail.value })
  },

  async saveGoal() {
    const goalWeight = parseFloat(this.data.goalWeightText)
    if (!goalWeight || goalWeight <= 0 || goalWeight > 300) {
      util.showToast('请输入有效的目标体重')
      return
    }

    util.showLoading('保存中...')
    try {
      const db = wx.cloud.database()
      const app = getApp()
      const user = app.globalData.userInfo

      const userRes = await db.collection('users')
        .where({ openId: user.openId })
        .get()

      if (userRes.data.length > 0) {
        await db.collection('users').doc(userRes.data[0]._id).update({
          data: {
            goalWeight: Math.round(goalWeight * 10) / 10,
            goalType: this.data.goalType
          }
        })

        // 更新全局数据
        user.goalWeight = Math.round(goalWeight * 10) / 10
        user.goalType = this.data.goalType
        app.setUserInfo(user)

        util.showSuccess('目标已保存')
      }
    } catch (err) {
      console.error(err)
      util.showError('保存失败')
    } finally {
      util.hideLoading()
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
            const db = wx.cloud.database()
            const app = getApp()
            const user = app.globalData.userInfo

            // 从群组中移除
            if (user.groupId) {
              const groupRes = await db.collection('groups').doc(user.groupId).get()
              if (groupRes.data) {
                const members = (groupRes.data.members || []).filter(m => m !== user.openId)
                await db.collection('groups').doc(user.groupId).update({
                  data: { members }
                })
              }
            }

            const userRes = await db.collection('users')
              .where({ openId: user.openId })
              .get()
            if (userRes.data.length > 0) {
              await db.collection('users').doc(userRes.data[0]._id).update({
                data: { groupId: null }
              })
            }

            user.groupId = null
            app.setUserInfo(user)

            util.showSuccess('已退出群组')
            this.loadProfile()
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
