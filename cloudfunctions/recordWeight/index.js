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

// 根据 records 重新计算用户统计快照并写入 users.stats（与 login/getRanking 一致）
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
  const { weight, date, note } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!weight || weight <= 0) return { code: -1, msg: '体重数据无效' }
  if (!date) return { code: -1, msg: '日期缺失' }

  try {
    // 查找当天是否已有记录
    const existRes = await db.collection('records').where({
      openId: OPENID,
      date: date
    }).get()

    if (existRes.data.length > 0) {
      // 更新已有记录
      const record = existRes.data[0]
      await db.collection('records').doc(record._id).update({
        data: {
          weight: weight,
          note: note || '',
          updatedAt: db.serverDate()
        }
      })
      await refreshUserStats(OPENID)
      return { code: 0, msg: '已更新', data: { ...record, weight } }
    } else {
      // 新增记录
      const newRecord = {
        openId: OPENID,
        weight: weight,
        date: date,
        note: note || '',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      const res = await db.collection('records').add({ data: newRecord })
      await refreshUserStats(OPENID)
      return { code: 0, msg: '打卡成功', data: { ...newRecord, _id: res._id } }
    }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
