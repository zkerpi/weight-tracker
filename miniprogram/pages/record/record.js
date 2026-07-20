const util = require('../../utils/util')

Page({
  data: {
    weight: '',
    currentDate: util.getToday(),
    isUpdate: false,
    existingWeight: null,
    lastWeight: null,
    quickWeights: [],
    userInfo: null,
    showCompare: false,
    weightUp: false,
    weightDown: false,
    diffFormatted: ''
  },

  onLoad() {
    this.loadUserStatus()
  },

  async loadUserStatus() {
    util.showLoading()
    try {
      const app = getApp()
      const user = app.globalData.userInfo

      if (!user) {
        const res = await wx.cloud.callFunction({ name: 'login', data: {} })
        if (res.result.code === 0) {
          app.setUserInfo(res.result.data)
        }
      }

      const finalUser = app.globalData.userInfo
      if (!finalUser) {
        util.showError('获取用户信息失败')
        return
      }

      this.setData({ userInfo: finalUser })

      // 查询已有记录
      const db = wx.cloud.database()
      const recordsRes = await db.collection('records')
        .where({ openId: finalUser.openId })
        .orderBy('date', 'desc')
        .limit(3)
        .get()

      const records = recordsRes.data
      const today = util.getToday()

      // 检查今天是否已打卡
      const todayRecord = records.find(r => r.date === today)
      // 获取最后一次体重（非今天的）
      const lastRecord = records.find(r => r.date !== today)
      const lastWeight = lastRecord ? lastRecord.weight : null

      // 生成快捷体重选项
      const goalWeight = finalUser.goalWeight
      let quickWeights = []
      if (lastWeight) {
        quickWeights = [
          (lastWeight - 0.5).toFixed(1),
          lastWeight.toFixed(1),
          (lastWeight + 0.5).toFixed(1)
        ]
      } else if (goalWeight) {
        quickWeights = [
          (goalWeight + 2).toFixed(1),
          (goalWeight + 5).toFixed(1),
          (goalWeight + 8).toFixed(1)
        ]
      } else {
        quickWeights = ['70.0', '75.0', '80.0']
      }

      this.setData({
        currentDate: today,
        isUpdate: !!todayRecord,
        existingWeight: todayRecord ? todayRecord.weight : null,
        weight: todayRecord ? String(todayRecord.weight) : '',
        lastWeight: lastWeight,
        showCompare: false,
        weightUp: false,
        weightDown: false,
        diffFormatted: '',
        quickWeights
      })

      // 修改模式下初始化对比
      if (todayRecord && lastWeight) {
        const diff = parseFloat((todayRecord.weight - lastWeight).toFixed(1))
        if (diff > 0) {
          this.setData({ showCompare: true, weightUp: true, weightDown: false, diffFormatted: diff.toFixed(1) })
        } else if (diff < 0) {
          this.setData({ showCompare: true, weightUp: false, weightDown: true, diffFormatted: diff.toFixed(1) })
        }
      }
    } catch (err) {
      console.error(err)
      util.showError('加载失败')
    } finally {
      util.hideLoading()
    }
  },

  onWeightInput(e) {
    const val = e.detail.value
    this.setData({ weight: val })

    const parsed = parseFloat(val)
    const lw = this.data.lastWeight
    if (parsed && lw && this.data.isUpdate) {
      const diff = parseFloat((parsed - lw).toFixed(1))
      if (diff > 0) {
        this.setData({ showCompare: true, weightUp: true, weightDown: false, diffFormatted: diff.toFixed(1) })
      } else if (diff < 0) {
        this.setData({ showCompare: true, weightUp: false, weightDown: true, diffFormatted: diff.toFixed(1) })
      } else {
        this.setData({ showCompare: true, weightUp: false, weightDown: false, diffFormatted: '0.0' })
      }
    } else {
      this.setData({ showCompare: false })
    }
  },

  selectQuickWeight(e) {
    this.setData({ weight: e.currentTarget.dataset.weight })
  },

  async submitRecord() {
    const weight = parseFloat(this.data.weight)
    if (!weight || weight <= 0 || weight > 300) {
      util.showToast('请输入有效的体重值')
      return
    }

    util.showLoading('提交中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'recordWeight',
        data: {
          weight: Math.round(weight * 10) / 10,
          date: this.data.currentDate
        }
      })

      if (res.result.code === 0) {
        util.showSuccess(res.result.msg)
        setTimeout(() => {
          wx.navigateBack()
        }, 800)
      } else {
        util.showError(res.result.msg || '提交失败')
      }
    } catch (err) {
      console.error(err)
      util.showError('网络错误，请重试')
    } finally {
      util.hideLoading()
    }
  }
})
