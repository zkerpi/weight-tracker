const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    groupName: '',
    todayWeight: null,
    firstWeight: null,
    totalChange: 0,
    changeDisplay: '-',
    totalDays: 0,
    streak: 0,
    todayDate: util.getToday(),
    chartData: [],
    chartRanges: ['近7天', '近14天', '近30天'],
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

      // 获取用户信息
      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      })
      if (loginRes.result.code !== 0) {
        util.showError('获取用户信息失败')
        return
      }

      const user = loginRes.result.data
      app.setUserInfo(user)

      // 获取群组名称
      let groupName = ''
      if (user.groupId) {
        try {
          const db = wx.cloud.database()
          const groupRes = await db.collection('groups').doc(user.groupId).get()
          groupName = groupRes.data.groupName || ''
        } catch (e) {
          // 群组可能已被删除
        }
      }

      this.setData({
        userInfo: user,
        groupName,
        todayDate: util.getToday()
      })

      // 获取用户的打卡记录
      const db = wx.cloud.database()
      const recordsRes = await db.collection('records')
        .where({ openId: user.openId })
        .orderBy('date', 'asc')
        .get()
      const records = recordsRes.data

      if (records.length > 0) {
        const firstWeight = records[0].weight
        const latestRecord = records[records.length - 1]
        const todayWeight = latestRecord.date === util.getToday() ? latestRecord.weight : null

        // 计算连续打卡
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
      const totalChange = goalType === 'lose'
        ? Math.round((firstWeight - latestRecord.weight) * 100) / 100
        : Math.round((latestRecord.weight - firstWeight) * 100) / 100

      const absChange = Math.abs(totalChange)
      const changeDisplay = totalChange > 0
        ? '-' + (absChange > 0 ? absChange.toFixed(1) : '')
        : (absChange > 0 ? absChange.toFixed(1) : '0')

      // 计算进度
        let progressText = ''
        let progressClass = ''
        let progressPercent = 0
        if (user.goalWeight && firstWeight > 0) {
          const diff = latestRecord.weight - user.goalWeight
          if (diff <= 0) {
            progressText = '🎉 目标达成！'
            progressClass = ''
            progressPercent = 100
          } else {
            const total = goalType === 'lose'
              ? Math.abs(firstWeight - user.goalWeight)
              : Math.abs(user.goalWeight - firstWeight)
            const achieved = goalType === 'lose'
              ? firstWeight - latestRecord.weight
              : latestRecord.weight - firstWeight
            if (total > 0) {
              progressPercent = Math.min(99, Math.round(achieved / total * 100))
              progressText = `完成 ${progressPercent}% (目标${user.goalWeight}kg)`
            }
          }
        }

        this.setData({
          todayWeight,
          firstWeight,
          totalChange: Math.abs(totalChange),
          changeDisplay: changeDisplay,
          totalDays: records.length,
          streak,
          progressText,
          progressClass,
          progressPercent
        })

        this.loadChartData(records, this.data.chartRangeIndex)
      } else {
        this.setData({
          todayWeight: null,
          firstWeight: null,
          totalChange: 0,
          totalDays: 0,
          streak: 0,
          chartData: []
        })
      }
    } catch (err) {
      console.error('loadData error:', err)
      util.showError('数据加载失败')
    } finally {
      util.hideLoading()
    }
  },

  loadChartData(records, rangeIndex) {
    const ranges = [7, 14, 30]
    const days = ranges[rangeIndex] || 14

    const dates = util.getDateRange(days)
    const recordsMap = {}
    for (const r of records) {
      recordsMap[r.date] = r.weight
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
        .get()
        .then(res => {
          this.loadChartData(res.data, idx)
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
  }
})
