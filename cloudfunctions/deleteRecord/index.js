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
  const { recordId } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!recordId) return { code: -1, msg: '参数缺失' }

  try {
    const record = await db.collection('records').doc(recordId).get()
    if (!record.data || record.data.openId !== OPENID) {
      return { code: -1, msg: '无权删除此记录' }
    }
    const openId = record.data.openId
    await db.collection('records').doc(recordId).remove()
    await refreshUserStats(openId)
    return { code: 0, msg: '已删除' }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
