const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function getToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getYesterday(dateStr) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

exports.main = async (event, context) => {
  const { groupId } = event

  try {
    // 获取用户列表（按群组筛选或全部）
    let userQuery = {}
    if (groupId) {
      userQuery = { groupId: groupId }
    }
    const userRes = await db.collection('users')
      .where(userQuery)
      .get()
    const users = userRes.data

    if (users.length === 0) {
      return { code: 0, data: [] }
    }

    const openIds = users.map(u => u.openId)
    const MAX_BATCH = 50
    let allRecords = []

    // 分批查询所有用户的记录（最多查100条*批次数）
    for (let i = 0; i < openIds.length; i += MAX_BATCH) {
      const batch = openIds.slice(i, i + MAX_BATCH)
      const res = await db.collection('records')
        .where({ openId: db.command.in(batch) })
        .orderBy('date', 'asc')
        .get()
      allRecords = allRecords.concat(res.data)
    }

    // 按 openId 分组
    const recordsByUser = {}
    for (const r of allRecords) {
      if (!recordsByUser[r.openId]) recordsByUser[r.openId] = []
      recordsByUser[r.openId].push(r)
    }

    const today = getToday()

    const rankingData = users.map(user => {
      const records = recordsByUser[user.openId] || []

      // 基本统计
      let firstWeight = null
      let currentWeight = null
      let totalDays = records.length
      let streak = 0
      let checkedInToday = false
      let latestRecord = null

      if (records.length > 0) {
        firstWeight = records[0].weight
        latestRecord = records[records.length - 1]
        currentWeight = latestRecord.weight
        checkedInToday = latestRecord.date === today

        // 计算连续打卡（从今天往前数）
        let checkDate = today
        for (let i = records.length - 1; i >= 0; i--) {
          if (records[i].date === checkDate) {
            streak++
            checkDate = getYesterday(checkDate)
          } else if (records[i].date < checkDate) {
            break
          }
        }
      }

      // 减重/增重幅度
      const goalType = user.goalType || 'lose'
      let totalChange = 0
      let changePercent = 0

      if (firstWeight && currentWeight && firstWeight !== currentWeight) {
        totalChange = goalType === 'lose'
          ? Math.round((firstWeight - currentWeight) * 100) / 100
          : Math.round((currentWeight - firstWeight) * 100) / 100
        changePercent = firstWeight > 0
          ? Math.round((totalChange / firstWeight) * 10000) / 100
          : 0
      }

      return {
        openId: user.openId,
        nickName: user.nickName || '用户',
        avatarUrl: user.avatarUrl || '',
        goalWeight: user.goalWeight,
        goalType: goalType,
        currentWeight,
        totalChange,
        changePercent,
        totalDays,
        streak,
        checkedInToday,
        firstWeight,
        latestDate: latestRecord ? latestRecord.date : null
      }
    })

    // 按总变化量降序排列
    rankingData.sort((a, b) => b.totalChange - a.totalChange)

    return { code: 0, data: rankingData }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
