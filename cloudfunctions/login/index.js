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

// 根据 records 重新计算用户统计快照并写入 users.stats
async function refreshUserStats(openId) {
  const userRes = await db.collection('users').where({ openId }).get()
  if (userRes.data.length === 0) return null

  const user = userRes.data[0]
  const [countRes, firstRes, recentRes] = await Promise.all([
    db.collection('records').where({ openId }).count(),
    db.collection('records').where({ openId }).orderBy('date', 'asc').limit(1).get(),
    db.collection('records').where({ openId }).orderBy('date', 'desc').limit(400).get()
  ])

  const first = firstRes.data[0] || null
  const recent = recentRes.data || []
  const today = getToday()

  // 连续打卡：从今天往前数连续有记录的天数（今天没记录则 0）
  let streak = 0
  let checkDate = today
  for (let i = 0; i < recent.length; i++) {
    if (recent[i].date === checkDate) {
      streak++
      checkDate = getYesterday(checkDate)
    } else if (recent[i].date < checkDate) {
      break
    }
  }

  const stats = {
    firstWeight: first ? first.weight : null,
    firstDate: first ? first.date : null,
    currentWeight: recent.length > 0 ? recent[0].weight : null,
    latestDate: recent.length > 0 ? recent[0].date : null,
    totalDays: countRes.total,
    streak
  }

  await db.collection('users').doc(user._id).update({
    data: { stats }
  })
  return stats
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { code: -1, msg: '获取用户身份失败' }
  }

  try {
    const userRes = await db.collection('users').where({
      openId: OPENID
    }).get()

    let user
    if (userRes.data.length === 0) {
      // 新用户，创建记录
      const newUser = {
        openId: OPENID,
        nickName: event.nickName || '用户',
        avatarUrl: event.avatarUrl || '',
        setupDone: false,
        goalWeight: null,
        goalType: 'lose',
        groupId: null,
        groupIds: [],
        stats: null,
        createdAt: db.serverDate()
      }
      const res = await db.collection('users').add({ data: newUser })
      user = { ...newUser, _id: res._id }
    } else {
      user = userRes.data[0]
      const updateData = {}

      // 兼容老用户：已有非默认昵称则标记 setupDone
      if (user.setupDone === undefined && user.nickName && user.nickName !== '用户') {
        user.setupDone = true
        updateData.setupDone = true
      }

      // 迁移：老用户的单群 groupId 转成 groupIds 数组，并清理旧字段
      if (user.groupId && !user.groupIds) {
        updateData.groupIds = [user.groupId]
        updateData.groupId = null
      }

      if (Object.keys(updateData).length > 0) {
        await db.collection('users').doc(user._id).update({ data: updateData })
        Object.assign(user, updateData)
      }

      // 更新昵称和头像
      if (event.nickName || event.avatarUrl) {
        const profileUpdate = {}
        if (event.nickName) profileUpdate.nickName = event.nickName
        if (event.avatarUrl) profileUpdate.avatarUrl = event.avatarUrl
        await db.collection('users').doc(user._id).update({ data: profileUpdate })
        Object.assign(user, profileUpdate)
      }

      // 回填统计快照（首次登录后所有活跃用户自动补齐）
      if (!user.stats) {
        user.stats = await refreshUserStats(OPENID)
      }
    }

    return { code: 0, data: user }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
