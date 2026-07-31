const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const shared = require('./shared/index')

// 迁移期兜底：老用户还没有 stats 快照，即时计算并回填（仅首次需要）
async function ensureUserStats(user) {
  if (user.stats) return user.stats
  const stats = await shared.computeStats(user.openId)
  await db.collection('users').doc(user._id).update({ data: { stats } })
  return stats
}

exports.main = async (event, context) => {
  const { groupId } = event

  if (!groupId) {
    return { code: 0, data: [] }
  }

  try {
    // 兼容迁移期：老用户还是单值 groupId，新用户是 groupIds 数组
    const userRes = await db.collection('users').where(
      db.command.or([
        { groupIds: groupId },
        { groupId: groupId }
      ])
    ).get()
    const users = userRes.data

    if (users.length === 0) {
      return { code: 0, data: [] }
    }

    const today = shared.getToday()
    const rankingData = []

    for (const user of users) {
      const s = await ensureUserStats(user)

      const firstWeight = s.firstWeight || null
      const currentWeight = s.currentWeight || null
      const totalDays = s.totalDays || 0
      const streak = s.streak || 0
      const checkedInToday = s.latestDate === today

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

      const freshAvatar = shared.avatarCacheFresh(user)
      rankingData.push({
        openId: user.openId,
        nickName: user.nickName || '用户',
        avatarUrl: (freshAvatar ? user.avatarTempUrl : user.avatarUrl) || '',
        goalWeight: user.goalWeight,
        goalType: goalType,
        currentWeight,
        totalChange,
        changePercent,
        totalDays,
        streak,
        checkedInToday,
        firstWeight,
        latestDate: s.latestDate || null
      })
    }

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
