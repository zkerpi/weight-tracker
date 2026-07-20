const util = require('../../utils/util')

Page({
  data: {
    weight: '',
    weightUnit: 'kg',
    unitLabel: 'kg',
    currentDate: util.getToday(),
    todayDate: util.getToday(),
    isUpdate: false,
    existingWeight: null,
    lastWeight: null,
    quickWeights: [],
    userInfo: null,
    showCompare: false,
    showShareBtn: false,
    shareCardPath: '',
    displayedWeight: '',
    shareMsg: '',
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
      let user = app.globalData.userInfo

      if (!user) {
        const res = await wx.cloud.callFunction({ name: 'login', data: {} })
        if (res.result.code === 0) {
          user = res.result.data
          app.setUserInfo(user)
        }
      }

      if (!user) {
        util.showError('获取用户信息失败')
        return
      }

      this.setData({ userInfo: user })

      const weightUnit = user.weightUnit || 'kg'
      const unitLabel = util.displayUnit(weightUnit)

      // 查询已有记录
      const db = wx.cloud.database()
      const recordsRes = await db.collection('records')
        .where({ openId: user.openId })
        .orderBy('date', 'desc')
        .limit(3)
        .get()

      const records = recordsRes.data
      const currentDate = this.data.currentDate

      // 检查选中日期是否已有记录
      const todayRecord = records.find(r => r.date === currentDate)
      // 获取选中日期之前的最后一次体重
      const lastRecord = records.find(r => r.date < currentDate)
      const lastWeightKg = lastRecord ? lastRecord.weight : null

      // 生成快捷体重选项（显示单位）
      const goalWeight = user.goalWeight
      let quickWeights = []
      if (lastWeightKg) {
        const last = parseFloat(util.displayWeight(lastWeightKg, weightUnit))
        quickWeights = [
          (last - 0.5).toFixed(1),
          last.toFixed(1),
          (last + 0.5).toFixed(1)
        ]
      } else if (goalWeight) {
        const goal = parseFloat(util.displayWeight(goalWeight, weightUnit))
        quickWeights = [
          (goal + 2).toFixed(1),
          (goal + 5).toFixed(1),
          (goal + 8).toFixed(1)
        ]
      } else {
        quickWeights = weightUnit === 'jin' ? ['140.0', '150.0', '160.0'] : ['70.0', '75.0', '80.0']
      }

      this.setData({
        weightUnit,
        unitLabel,
        currentDate: currentDate,
        isUpdate: !!todayRecord,
        existingWeight: todayRecord ? util.displayWeight(todayRecord.weight, weightUnit) : null,
        weight: todayRecord ? util.displayWeight(todayRecord.weight, weightUnit) : '',
        lastWeight: lastWeightKg,
        showCompare: false,
        weightUp: false,
        weightDown: false,
        diffFormatted: '',
        quickWeights
      })

      // 修改模式下初始化对比
      if (todayRecord && lastWeightKg) {
        const diff = todayRecord.weight - lastWeightKg
        const displayDiff = weightUnit === 'jin' ? (diff * 2) : diff
        if (displayDiff > 0) {
          this.setData({ showCompare: true, weightUp: true, weightDown: false, diffFormatted: displayDiff.toFixed(1) })
        } else if (displayDiff < 0) {
          this.setData({ showCompare: true, weightUp: false, weightDown: true, diffFormatted: displayDiff.toFixed(1) })
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
    const lwKg = this.data.lastWeight
    if (parsed && lwKg && this.data.isUpdate) {
      const inputKg = util.toKg(parsed, this.data.weightUnit)
      const diff = inputKg - lwKg
      const displayDiff = this.data.weightUnit === 'jin' ? (diff * 2) : diff
      if (displayDiff > 0) {
        this.setData({ showCompare: true, weightUp: true, weightDown: false, diffFormatted: displayDiff.toFixed(1) })
      } else if (displayDiff < 0) {
        this.setData({ showCompare: true, weightUp: false, weightDown: true, diffFormatted: displayDiff.toFixed(1) })
      } else {
        this.setData({ showCompare: true, weightUp: false, weightDown: false, diffFormatted: '0.0' })
      }
    } else {
      this.setData({ showCompare: false })
    }
  },

  onDateChange(e) {
    const date = e.detail.value
    this.setData({ currentDate: date })
    this.loadUserStatus()
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
      const weightKg = Math.round(util.toKg(weight, this.data.weightUnit) * 100) / 100
      const res = await wx.cloud.callFunction({
        name: 'recordWeight',
        data: {
          weight: weightKg,
          date: this.data.currentDate
        }
      })

      if (res.result.code === 0) {
        // 标记首页和排名页下次需要刷新数据
        getApp().globalData.needsRefresh = true
        getApp().globalData.rankingCache = null

        const displayedWeight = util.displayWeight(weightKg, this.data.weightUnit)
        const msgs = [
          '持之以恒，终见成效',
          '每一次打卡都是进步',
          '坚持就是胜利',
          '离目标又近了一步',
          '自律的人最美丽',
          '一步一个脚印',
        ]
        this.setData({
          showShareBtn: true,
          displayedWeight,
          shareMsg: msgs[Math.floor(Math.random() * msgs.length)]
        })
        this.drawShareCard(weightKg).then(path => {
          if (path) this.setData({ shareCardPath: path })
        })
      } else {
        util.showError(res.result.msg || '提交失败')
      }
    } catch (err) {
      console.error(err)
      util.showError('网络错误，请重试')
    } finally {
      util.hideLoading()
    }
  },

  closeShare() {
    this.setData({ showShareBtn: false })
    wx.navigateBack()
  },

  async drawShareCard(weightKg) {
    try {
      const sysInfo = wx.getSystemInfoSync()
      const dpr = sysInfo.pixelRatio
      const unitLabel = this.data.unitLabel
      const dateStr = this.data.currentDate
      const w = 375, h = 500

      const query = this.createSelectorQuery()
      const canvasRes = await new Promise(resolve => {
        query.select('#shareCanvas')
          .fields({ node: true, size: true })
          .exec(res => resolve(res?.[0]))
      })
      if (!canvasRes) return null

      const canvas = canvasRes.node
      const ctx = canvas.getContext('2d')
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      // 背景
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, '#10b981')
      grad.addColorStop(1, '#059669')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // 标题
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '18px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('轻量级好友', w / 2, 60)

      // 日期
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '14px sans-serif'
      ctx.fillText(dateStr, w / 2, 90)

      // 体重数值
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 64px sans-serif'
      const displayVal = util.displayWeight(weightKg, this.data.weightUnit)
      ctx.fillText(displayVal, w / 2, 200)

      ctx.font = '24px sans-serif'
      ctx.fillText(unitLabel, w / 2, 240)

      // 励志语
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '16px sans-serif'
      ctx.fillText(this.data.shareMsg, w / 2, 320)

      // 底部品牌
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '12px sans-serif'
      ctx.fillText('微信小程序 · 轻量级好友', w / 2, h - 30)

      // 导出图片
      let tempFilePath = null
      try {
        const tempRes = await wx.canvasToTempFilePath({
          canvas, x: 0, y: 0, width: w, height: h,
          destWidth: w * 2, destHeight: h * 2,
          fileType: 'png'
        }, this)
        tempFilePath = tempRes.tempFilePath
      } catch (e) {
        console.error('canvasToTempFilePath error:', e)
      }

      return tempFilePath
    } catch (err) {
      console.error('drawShareCard error:', err)
      return null
    }
  },

  onShareAppMessage() {
    const path = this.data.shareCardPath
    const shareData = {
      title: `我今天 ${this.data.displayedWeight}${this.data.unitLabel}，${this.data.shareMsg}！`,
      path: '/pages/index/index'
    }
    if (path) {
      shareData.imageUrl = path
    }
    return shareData
  }
})
