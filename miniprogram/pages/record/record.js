const util = require('../../utils/util')

Page({
  data: {
    weight: '',
    weightW: 200,
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
    note: '',
    showShareBtn: false,
    shareCardPath: '',
    displayedWeight: '',
    shareMsg: '',
    weightUp: false,
    weightDown: false,
    diffFormatted: '',
    submitting: false,
    statusLoading: true,
    loadError: ''
  },

  onLoad(query) {
    if (query && query.date) {
      this.setData({ currentDate: query.date })
    }
    this.loadUserStatus()
  },

  async loadUserStatus() {
    const request = this._statusRequest = (this._statusRequest || 0) + 1
    this.setData({ statusLoading: true, loadError: '' })
    util.showLoading()
    try {
      const app = getApp()
      const user = await app.ensureUser(false)

      if (!user) {
        throw new Error('获取用户信息失败')
      }

      this.setData({ userInfo: user })

      const weightUnit = user.weightUnit || 'kg'
      const unitLabel = util.displayUnit(weightUnit)

      // 查询已有记录：选中日期当天 + 之前最近一条（补签旧日期也能拿到对比）
      const db = wx.cloud.database()
      const currentDate = this.data.currentDate
      const recordsRes = await db.collection('records')
        .where({ openId: user.openId, date: db.command.lte(currentDate) })
        .orderBy('date', 'desc')
        .limit(2)
        .get()

      if (request !== this._statusRequest) return
      const records = recordsRes.data
      // 选中日期当天的记录（若存在）
      const todayRecord = records[0] && records[0].date === currentDate ? records[0] : null
      // 选中日期之前最近的一条
      const lastRecord = todayRecord ? records[1] : records[0]
      const lastWeightKg = lastRecord ? lastRecord.weight : null

      // 生成快捷体重选项（显示单位）
      let quickWeights = []
      if (lastWeightKg) {
        const last = parseFloat(util.displayWeight(lastWeightKg, weightUnit))
        quickWeights = [
          (last - 0.5).toFixed(1),
          last.toFixed(1),
          (last + 0.5).toFixed(1)
        ]
      } else {
        quickWeights = []
      }

      this.setData({
        weightUnit,
        unitLabel,
        currentDate: currentDate,
        isUpdate: !!todayRecord,
        existingWeight: todayRecord ? util.displayWeight(todayRecord.weight, weightUnit) : null,
        weight: todayRecord ? util.displayWeight(todayRecord.weight, weightUnit) : '',
        weightW: util.figureWidth(todayRecord ? util.displayWeight(todayRecord.weight, weightUnit) : '0.0', 88, 200),
        note: todayRecord ? (todayRecord.note || '') : '',
        lastWeight: lastWeightKg,
        showCompare: false,
        weightUp: false,
        weightDown: false,
        diffFormatted: '',
        quickWeights: quickWeights.filter(w => Number(w) > 0)
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
      if (request === this._statusRequest) this.setData({ loadError: '当天记录加载失败' })
    } finally {
      if (request === this._statusRequest) this.setData({ statusLoading: false })
      util.hideLoading()
    }
  },

  onWeightInput(e) {
    const val = e.detail.value
    this.setData({ weight: val, weightW: util.figureWidth(val || '0.0', 88, 200) })
    this._updateComparison(val)
  },

  _updateComparison(weightStr) {
    const parsed = parseFloat(weightStr)
    const lwKg = this.data.lastWeight
    if (parsed && lwKg) {
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

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  selectQuickWeight(e) {
    const val = e.currentTarget.dataset.weight
    this.setData({ weight: val, weightW: util.figureWidth(val || '0.0', 88, 200) })
    this._updateComparison(val)
  },

  async submitRecord() {
    if (this.data.submitting || this.data.statusLoading || this.data.loadError) return
    const weight = parseFloat(this.data.weight)
    if (!/^\d+(\.\d{1,2})?$/.test(this.data.weight) || !Number.isFinite(weight) || weight <= 0 || util.toKg(weight, this.data.weightUnit) > 300) {
      util.showToast('请输入有效的体重值')
      return
    }

    this.setData({ submitting: true })
    util.showLoading('提交中...')
    try {
      const weightKg = Math.round(util.toKg(weight, this.data.weightUnit) * 100) / 100
      const res = await wx.cloud.callFunction({
        name: 'recordWeight',
        data: {
          weight: weightKg,
          date: this.data.currentDate,
          note: this.data.note
        }
      })

      if (res.result.code === 0) {
        // 标记首页和排名页下次需要刷新数据
        getApp().globalData.needsRefresh = true
        getApp().clearPageCaches()

        const displayedWeight = util.displayWeight(weightKg, this.data.weightUnit)
        const msgs = [
          '数字已经记下，接下来好好生活。',
          '谢谢你，今天也在认真照顾自己。',
          '每一笔记录，都让你更了解自己。',
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
      this.setData({ submitting: false })
      util.hideLoading()
    }
  },

  closeShare() {
    this.setData({ showShareBtn: false })
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
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
      grad.addColorStop(0, '#496850')
      grad.addColorStop(1, '#253e35')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // 标题
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '18px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('斤斤轻体重记', w / 2, 60)

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
      ctx.fillText('微信小程序 · 斤斤轻体重记', w / 2, h - 30)

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
