const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    todayWeight: null,
    firstWeight: null,
    displayGoalWeight: null,
    totalChange: 0,
    changeDisplay: '-',
    totalDays: 0,
    streak: 0,
    todayDate: util.getToday(),
    chartData: [],
    chartRanges: ['近7天', '近14天', '近30天', '近90天', '近1年'],
    chartRangeIndex: 1,
    progressText: '',
    progressClass: '',
    progressPercent: 0
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    let user = app.globalData.userInfo
    const forceRefresh = app.globalData.needsRefresh
    app.globalData.needsRefresh = false

    // 需要最新数据：强制刷新（记录页返回）/ 未登录 / 尚无 stats 快照
    if (forceRefresh || !user || !user.stats) {
      util.showLoading()
      try {
        const loginRes = await wx.cloud.callFunction({ name: 'login', data: {} })
        if (loginRes.result.code !== 0) {
          util.showError('获取用户信息失败')
          return
        }
        user = loginRes.result.data
        app.setUserInfo(user)
      } catch (err) {
        console.error('loadData error:', err)
        util.showError('数据加载失败')
        return
      } finally {
        util.hideLoading()
      }
    }

    this.setData({
      userInfo: user,
      todayDate: util.getToday()
    })

    // 首次使用引导：默认昵称提示去设置
    if (!user.setupDone) {
      wx.showModal({
        title: '欢迎使用 斤斤轻体重记',
        content: '请先设置你的昵称和头像，方便朋友识别',
        confirmText: '去设置',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' })
          }
        }
      })
    }

    // 统计直接读 user.stats 快照（无数据库查询），立即渲染
    const totalDays = this.renderStats(user)

    // 图表：有记录才查，缓存命中立即渲染 + 后台静默刷新
    if (totalDays > 0) {
      const weightUnit = user.weightUnit || 'kg'
      const rangeIndex = this.data.chartRangeIndex
      const cache = app.globalData.homeCache
      const cacheKey = `${user.openId}|${weightUnit}|${rangeIndex}`
      const cacheHit = !forceRefresh && cache && cache.key === cacheKey
      if (cacheHit) {
        this.setData({ chartData: cache.chartData })
      } else {
        util.showLoading()
      }
      try {
        await this.loadChart(rangeIndex, user, forceRefresh)
      } finally {
        if (!cacheHit) util.hideLoading()
      }
    }
  },

  // 用 user.stats 快照渲染统计，返回 totalDays（供图表判断）
  renderStats(user) {
    const s = user.stats || {}
    const weightUnit = user.weightUnit || 'kg'
    const unitLabel = util.displayUnit(weightUnit)
    const today = util.getToday()
    const baselineWeight = user.initialWeight || s.firstWeight || null
    const latestWeight = s.currentWeight != null ? s.currentWeight : null
    const todayWeight = s.latestDate === today ? s.currentWeight : null
    const totalDays = s.totalDays || 0
    const streak = s.streak || 0
    const goalType = user.goalType || 'lose'
    const displayGoalWeight = user.goalWeight ? util.displayWeight(user.goalWeight, weightUnit) : null

    if (totalDays > 0 && latestWeight != null && baselineWeight != null) {
      const totalChange = goalType === 'lose'
        ? Math.round((baselineWeight - latestWeight) * 100) / 100
        : Math.round((latestWeight - baselineWeight) * 100) / 100

      const absChange = Math.abs(totalChange)
      const displayAbs = weightUnit === 'jin' ? (absChange * 2).toFixed(1) : absChange.toFixed(1)
      let changeDisplay
      if (totalChange > 0) {
        changeDisplay = '↓ ' + displayAbs
      } else if (totalChange < 0) {
        changeDisplay = '↑ ' + displayAbs
      } else {
        changeDisplay = '0'
      }

      // 计算进度
      let progressText = ''
      let progressClass = ''
      let progressPercent = 0
      if (user.goalWeight && baselineWeight > 0) {
        const diff = latestWeight - user.goalWeight
        if ((goalType === 'lose' && diff <= 0) || (goalType === 'gain' && diff >= 0)) {
          progressText = '🎉 目标达成！'
          progressClass = ''
          progressPercent = 100
        } else {
          const total = goalType === 'lose'
            ? Math.abs(baselineWeight - user.goalWeight)
            : Math.abs(user.goalWeight - baselineWeight)
          const achieved = goalType === 'lose'
            ? baselineWeight - latestWeight
            : latestWeight - baselineWeight
          if (total > 0) {
            progressPercent = Math.min(99, Math.round(achieved / total * 100))
            progressText = `完成 ${progressPercent}% (目标${displayGoalWeight}${unitLabel})`
          }
        }
      }

      this.setData({
        weightUnit,
        unitLabel,
        todayWeight: todayWeight != null ? util.displayWeight(todayWeight, weightUnit) : null,
        firstWeight: util.displayWeight(baselineWeight, weightUnit),
        totalChange,
        changeDisplay,
        displayGoalWeight,
        totalDays,
        streak,
        progressText,
        progressClass,
        progressPercent,
        goalType
      })
    } else {
      this.setData({
        weightUnit,
        unitLabel,
        todayWeight: null,
        firstWeight: user.initialWeight ? util.displayWeight(user.initialWeight, weightUnit) : null,
        totalChange: 0,
        changeDisplay: '-',
        displayGoalWeight,
        totalDays: 0,
        streak: 0,
        progressText: '',
        progressClass: '',
        progressPercent: 0,
        goalType,
        chartData: []
      })
    }
    return totalDays
  },

  // 按区间只拉图表所需记录（≤365 条），force 时破缓存
  async loadChart(rangeIndex, user, force) {
    const ranges = [7, 14, 30, 90, 365]
    const days = ranges[rangeIndex] || 14
    const weightUnit = user.weightUnit || 'kg'
    const db = wx.cloud.database()
    try {
      const res = await db.collection('records')
        .where({ openId: user.openId, date: db.command.gte(util.daysAgo(days - 1)) })
        .orderBy('date', 'asc')
        .get(force ? { cacheTime: 0 } : {})

      const recordsMap = {}
      for (const r of res.data) {
        recordsMap[r.date] = weightUnit === 'jin' ? r.weight * 2 : r.weight
      }

      const chartData = util.getDateRange(days).map(d => ({
        date: d,
        weight: recordsMap[d] || null
      }))

      this.setData({ chartData })
      getApp().globalData.homeCache = {
        key: `${user.openId}|${weightUnit}|${rangeIndex}`,
        chartData
      }
    } catch (err) {
      console.error('loadChart error:', err)
    }
  },

  onChartRangeChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ chartRangeIndex: idx })

    const user = this.data.userInfo
    if (user) {
      this.loadChart(idx, user, false)
    }
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  goGroup() {
    wx.navigateTo({ url: '/pages/group/group' })
  },

  goRank() {
    wx.switchTab({ url: '/pages/rank/rank' })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  onShareAppMessage() {
    const streak = this.data.streak || 0
    const totalChange = this.data.totalChange
    const unitLabel = this.data.unitLabel
    let changeText = ''
    if (totalChange !== 0) {
      const abs = Math.abs(totalChange)
      const display = this.data.weightUnit === 'jin' ? (abs * 2).toFixed(1) : abs.toFixed(1)
      changeText = totalChange > 0 ? `，已减${display}${unitLabel}` : ''
    }
    return {
      title: streak > 0
        ? `我已连续打卡 ${streak} 天${changeText}，一起加油！`
        : '来斤斤轻体重记一起打卡减重吧！',
      path: '/pages/index/index'
    }
  }
})
