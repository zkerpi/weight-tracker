const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    groupName: '',
    todayWeight: null,
    firstWeight: null,
    displayGoalWeight: null,
    totalChange: 0,
    changeDisplay: '-',
    totalDays: 0,
    streak: 0,
    todayDate: util.getToday(),
    chartData: [],
    motivationText: '',
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
    util.showLoading()
    try {
      const app = getApp()

      // 使用缓存的用户信息，避免重复调用login云函数
      let user = app.globalData.userInfo
      if (!user) {
        const loginRes = await wx.cloud.callFunction({
          name: 'login',
          data: {}
        })
        if (loginRes.result.code !== 0) {
          util.showError('获取用户信息失败')
          return
        }
        user = loginRes.result.data
        app.setUserInfo(user)
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

      // 判断是否需要强制刷新（从记录页修改后返回时）
      const forceRefresh = app.globalData.needsRefresh
      app.globalData.needsRefresh = false
      const cacheOpt = forceRefresh ? { cacheTime: 0 } : {}

      // 并行查询：群组名称、所有记录、今日体重
      const db = wx.cloud.database()
      const [groupNameResult, recordsRes, todayRes] = await Promise.all([
        user.groupId
          ? db.collection('groups').doc(user.groupId).get().catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
        db.collection('records')
          .where({ openId: user.openId })
          .orderBy('date', 'asc')
          .limit(1000)
          .get(cacheOpt),
        db.collection('records')
          .where({ openId: user.openId, date: util.getToday() })
          .limit(1)
          .get(cacheOpt)
      ])

      const groupName = groupNameResult.data ? groupNameResult.data.groupName || '' : ''
      const records = recordsRes.data
      const todayWeight = todayRes.data.length > 0 ? todayRes.data[0].weight : null
      this.setData({ groupName })

      const weightUnit = user.weightUnit || 'kg'
      const unitLabel = util.displayUnit(weightUnit)

      if (records.length > 0) {
        const baselineWeight = user.initialWeight || records[0].weight
        const latestRecord = records[records.length - 1]

        console.log('[debug] initialWeight:', user.initialWeight, 'baseline:', baselineWeight, 'latest:', latestRecord.weight)
        let streak = 0
        let checkDate = util.getToday()
        for (let i = records.length - 1; i >= 0; i--) {
          if (records[i].date === checkDate) {
            streak++
            const d = new Date(checkDate)
            d.setDate(d.getDate() - 1)
            checkDate = util.formatDate(d)
          } else if (records[i].date < checkDate) {
            break
          }
        }

      const goalType = user.goalType || 'lose'
      // 优先用独立查询的今日体重（避免缓存问题），无今日记录时回退到 records
      const latestWeight = todayWeight !== null ? todayWeight : latestRecord.weight
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
              const displayGoal = user.goalWeight ? util.displayWeight(user.goalWeight, weightUnit) : null
              progressText = `完成 ${progressPercent}% (目标${displayGoal}${unitLabel})`
            }
          }
        }

        const displayToday = todayWeight !== null ? util.displayWeight(todayWeight, weightUnit) : null
        const displayBaseline = util.displayWeight(baselineWeight, weightUnit)
        const displayGoalWeight = user.goalWeight ? util.displayWeight(user.goalWeight, weightUnit) : null

        // 生成数据驱动的激励文案
        let motivationText = ''
        if (progressPercent >= 100) {
          motivationText = '🎉 目标已达成！继续保持'
        } else if (totalChange > 0) {
          const action = goalType === 'gain' ? '已增' : '已减'
          motivationText = `相比开始${action} ${displayAbs}${unitLabel}`
        } else if (records.length > 0) {
          if (streak >= 7) {
            motivationText = `已连续打卡 ${streak} 天，坚持就是胜利`
          } else {
            motivationText = '波动是正常的，坚持记录就能看到变化'
          }
        } else {
          motivationText = '开始记录你的体重吧'
        }

        this.setData({
          weightUnit,
          unitLabel,
          todayWeight: displayToday,
          firstWeight: displayBaseline,
          totalChange: totalChange,
          changeDisplay: changeDisplay,
          displayGoalWeight,
          totalDays: records.length,
          streak,
          progressText,
          progressClass,
          progressPercent,
          motivationText,
          goalType
        })

        this.loadChartData(records, this.data.chartRangeIndex, weightUnit)
      } else {
        this.setData({
          weightUnit,
          unitLabel,
          todayWeight: null,
          firstWeight: user.initialWeight ? util.displayWeight(user.initialWeight, weightUnit) : null,
          totalChange: 0,
          changeDisplay: '-',
          totalDays: 0,
          streak: 0,
          chartData: [],
          motivationText: '开始记录你的体重吧'
        })
      }
    } catch (err) {
      console.error('loadData error:', err)
      util.showError('数据加载失败')
    } finally {
      util.hideLoading()
    }
  },

  loadChartData(records, rangeIndex, weightUnit) {
    const ranges = [7, 14, 30, 90, 365]
    const days = ranges[rangeIndex] || 14

    const dates = util.getDateRange(days)
    const recordsMap = {}
    for (const r of records) {
      recordsMap[r.date] = weightUnit === 'jin' ? r.weight * 2 : r.weight
    }

    const chartData = []
    for (const d of dates) {
      chartData.push({
        date: d,
        weight: recordsMap[d] || null
      })
    }

    this.setData({ chartData })
  },

  onChartRangeChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({ chartRangeIndex: idx })

    const db = wx.cloud.database()
    const user = this.data.userInfo
    if (user) {
      db.collection('records')
        .where({ openId: user.openId })
        .orderBy('date', 'asc')
        .limit(1000)
        .get({ cacheTime: 0 })
        .then(res => {
          this.loadChartData(res.data, idx, this.data.weightUnit)
        })
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
