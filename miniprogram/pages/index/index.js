const util = require('../../utils/util')

const quotes = [
  '坚持就是胜利，今天也要加油！',
  '每一次打卡，都是向目标迈进一步',
  '不要放弃，你的身体会感谢现在的你',
  '减重不是短跑，是一场马拉松',
  '自律即自由，掌控体重从今天开始',
  '小小的坚持，终将带来巨大的改变',
  '汗水是最好的护肤品',
  '你流的每一滴汗，都在塑造更好的自己',
  '没有凭空而来的减重，只有日复一日的坚持',
  '每一步都算数，每一斤都值得',
  '健康是一种责任，对自己负责',
  '别让明天的你，讨厌今天不努力的自己',
  '坚持打卡的人，运气不会太差',
  '体重只是数字，健康才是目的',
  '今天的汗水是明天的笑容',
  '种一棵树最好的时间是十年前，其次是现在',
  '慢慢来，比较快',
  '你的身体是这世上你拥有的最珍贵的东西',
  '不要因为走得慢而放弃，至少你在前进',
  '最好的投资，就是投资自己的健康',
  '没有人能代替你成长，体重也是',
  '当你想要放弃的时候，想想为什么坚持到了现在',
  '每一天都是一个新的开始',
  '你比想象中更强大',
  '成功的路上并不拥挤，因为坚持的人不多',
  '自律的顶端是自由',
  '现在流的汗，是以后你流的泪的反面',
  '所有的伟大，都源于一个勇敢的开始',
  '不要在最该奋斗的年纪选择安逸',
  '坚持不是一种选择，而是一种习惯',
  '你的努力，时间看得见',
  '减重是一场和自己的对话',
  '每一次控制住食欲，都是对自己的一次胜利',
  '身体不会骗你，付出多少就回报多少',
  '不是为了变瘦而运动，而是为了变强',
  '最好的整容不是动刀，而是运动',
  '运动是唯一一件付出就有回报的事',
  '当你觉得累的时候，说明你在走上坡路',
  '不要等待机会，而要创造机会',
  '将来的你，一定会感谢现在拼命的自己',
  '忍耐和坚持虽是痛苦的事情，却会带来好处',
  '世上没有白走的路，每一步都算数',
  '你的身体是一座神殿，请善待它',
  '今天的坚持是为了明天的自由',
  '控制体重就是掌控人生',
  '别让体重成为你人生的负担',
  '每一个瘦子都是潜在的胖子，每一个胖子都是潜力股',
  '不是因为看到希望才坚持，而是坚持了才看到希望',
  '习惯决定命运，坚持决定成败',
  '你的健康是你最贵的奢侈品',
  '运动不是惩罚，而是对身体的爱护',
  '做一个自律的人，从每天的打卡开始',
  '健康的生活方式是最好的长寿药',
  '当你自律，人生无敌',
  '跑步的人不会抑郁，流汗的人不会流泪',
  '没有太晚的开始，只有不开始的借口',
  '每天进步一点点，坚持带来大改变',
  '减重的路上，你并不是一个人在战斗',
  '汗水不会背叛你',
  '真正的自由，来自于对欲望的掌控',
  '每一天都是一次重生的机会',
  '健康是人生最大的财富',
  '坚持就是胜利，放弃才是失败',
  '你的努力不会被辜负',
  '做自己的英雄，从今天开始',
  '身体和灵魂，总有一个要在路上',
  '不是因为有结果才坚持，而是坚持了才有结果',
  '每一次打卡，都是对自己的承诺',
  '你值得拥有一个更健康的身体',
  '自律的人生不需要解释',
  '运动是最好的抗衰老药',
  '今天的状态决定明天的身材',
  '用心对待身体，身体会用心回报你',
  '减重不是剥夺，而是选择更好的',
  '你的身体会因为你的坚持而改变',
  '不要抱怨生活，去改变它',
  '每一个今天都是余生最年轻的一天',
  '善待身体，身体才会善待你',
  '战胜自己才是最大的胜利',
  '你的潜力远比你想象的更大',
  '没有付出就没有收获，减重也是如此',
  '每天都是一个新的起跑线',
  '坚持不是一天的事，而是一辈子的事',
  '真正的强者不是没有眼泪，而是含着泪奔跑',
  '你的坚持终将美好',
  '现在开始永远不晚',
  '健康是幸福生活的基础',
  '对自己狠一点，离目标近一点',
  '运动改变的不只是身材，还有心态',
  '每一次打卡都是一次自我突破',
  '不要给自己找借口，去行动',
  '成功就是简单的事情反复做',
  '你的身体会记住每一次努力',
  '减重是一场修行，修的是心',
  '世界上最快的捷径就是脚踏实地',
  '控制饮食不是虐待自己，而是爱护自己',
  '你和理想身材之间，只差坚持二字',
  '没有奇迹，只有你努力的轨迹',
  '今天多一分坚持，明天少一分遗憾',
  '健康饮食是最好的护肤品',
  '运动是最便宜的奢侈品',
  '你的努力会变成你身上的光芒',
  '坚持是一种品格，自律是一种修养',
  '给自己一个变好的机会',
]

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + c
    hash |= 0
  }
  return Math.abs(hash)
}

function getDailyQuote() {
  const today = util.getToday()
  const idx = hashCode(today) % quotes.length
  return quotes[idx]
}

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
    dailyQuote: '',
    chartRanges: ['近7天', '近14天', '近30天', '近90天', '近1年'],
    chartRangeIndex: 1,
    progressText: '',
    progressClass: '',
    progressPercent: 0
  },

  onShow() {
    this.setData({ dailyQuote: getDailyQuote() })
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

        // 计算周/月统计
        const now = new Date()
        const weekAgo = util.formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
        const monthAgo = util.formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
        const weekRecords = records.filter(r => r.date >= weekAgo)
        const monthRecords = records.filter(r => r.date >= monthAgo)

        const calcStats = (recs, unit) => {
          if (recs.length < 2) return { avg: null, change: null, isUp: false, isDown: false, label: '-' }
          const weights = recs.map(r => r.weight)
          const avg = weights.reduce((a, b) => a + b, 0) / weights.length
          const change = weights[weights.length - 1] - weights[0]
          const displayAvg = unit === 'jin' ? (avg * 2) : avg
          const displayChange = unit === 'jin' ? Math.abs(change * 2) : Math.abs(change)
          return {
            avg: displayAvg.toFixed(1),
            change: change === 0 ? '持平' : (change > 0 ? '+' : '') + displayChange.toFixed(1),
            isUp: change > 0,
            isDown: change < 0
          }
        }
        const weekStats = calcStats(weekRecords, weightUnit)
        const monthStats = calcStats(monthRecords, weightUnit)

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
          goalType,
          weekStats,
          monthStats
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
