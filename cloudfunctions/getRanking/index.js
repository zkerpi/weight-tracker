const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
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

  if (!groupId) {
    return { code: 0, data: [] }
  }

  try {
    // 获取群组成员
    const userQuery = { groupId: groupId }
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

    // 分批查询所有用户的记录（最多查1000条*批次数）
    for (let i = 0; i < openIds.length; i += MAX_BATCH) {
      const batch = openIds.slice(i, i + MAX_BATCH)
      const res = await db.collection('records')
        .where({ openId: db.command.in(batch) })
        .orderBy('date', 'asc')
        .limit(1000)
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
      const baselineWeight = user.initialWeight || firstWeight
      let totalChange = 0
      let changePercent = 0

      if (baselineWeight && currentWeight && baselineWeight !== currentWeight) {
        totalChange = goalType === 'lose'
          ? Math.round((baselineWeight - currentWeight) * 100) / 100
          : Math.round((currentWeight - baselineWeight) * 100) / 100

        // 优先按目标完成度计算百分比
        const goalWeight = user.goalWeight
        if (goalWeight && goalWeight > 0) {
          const goalDiff = goalType === 'lose'
            ? baselineWeight - goalWeight
            : goalWeight - baselineWeight
          if (goalDiff > 0) {
            const raw = Math.round((totalChange / goalDiff) * 10000) / 100
            changePercent = Math.max(0, Math.min(100, raw))
          } else {
            changePercent = 0
          }
        } else {
          // 没有目标体重，回退到按初始体重的百分比
          changePercent = baselineWeight > 0
            ? Math.round((totalChange / baselineWeight) * 10000) / 100
            : 0
        }
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

    // 在服务端转换 cloud:// 头像为临时可访问 URL
    const cloudFileIds = rankingData
      .filter(item => item.avatarUrl && item.avatarUrl.startsWith('cloud://'))
      .map(item => item.avatarUrl)
    if (cloudFileIds.length > 0) {
      try {
        const res = await cloud.getTempFileURL({ fileList: cloudFileIds })
        const urlMap = {}
        res.fileList.forEach(item => {
          if (item.tempFileURL) urlMap[item.fileID] = item.tempFileURL
        })
        rankingData.forEach(item => {
          if (urlMap[item.avatarUrl]) item.avatarUrl = urlMap[item.avatarUrl]
        })
      } catch (e) {}
    }

    return { code: 0, data: rankingData }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
