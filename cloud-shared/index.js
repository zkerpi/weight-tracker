// 云函数共享模块（单一事实来源）。由 scripts/sync-shared.js 同步到各函数 shared/ 目录。
// 注意：此目录在 cloudfunctions/ 之外，不会被开发者工具当作云函数部署。
// cloud.database() 必须惰性获取（在 cloud.init 之后调用），不能在模块顶层捕获。
const cloud = require('wx-server-sdk')

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

// 根据 records 重新计算用户统计快照（不写库）
async function computeStats(openId) {
  const db = cloud.database()
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

  return {
    firstWeight: first ? first.weight : null,
    firstDate: first ? first.date : null,
    currentWeight: recent.length > 0 ? recent[0].weight : null,
    latestDate: recent.length > 0 ? recent[0].date : null,
    totalDays: countRes.total,
    streak
  }
}

// 计算统计并写回 users.stats
async function refreshUserStats(openId) {
  const db = cloud.database()
  const userRes = await db.collection('users').where({ openId }).get()
  if (userRes.data.length === 0) return null

  const user = userRes.data[0]
  const stats = await computeStats(openId)
  await db.collection('users').doc(user._id).update({ data: { stats } })
  return stats
}

const AVATAR_TTL = 2 * 60 * 60 * 1000 // 2小时

// 判断用户文档里的头像临时 URL 缓存是否未过期
function avatarCacheFresh(user) {
  return !!(user && user.avatarTempUrl && user.avatarTempUrlExpire && Date.now() < user.avatarTempUrlExpire)
}

// 微信临时链接的真实有效期内置在 URL 的 t 参数里（秒），按它缓存，避免下发已过期链接返回 403
function parseTempUrlExpiry(tempUrl) {
  const m = tempUrl && tempUrl.match(/[?&]t=(\d+)/)
  return m ? Number(m[1]) * 1000 : Date.now() + AVATAR_TTL
}

// 解析 cloud:// 头像为临时 URL；非 cloud:// 返回 null
async function resolveAvatarTempUrl(fileId) {
  if (!fileId || !fileId.startsWith('cloud://')) return null
  const res = await cloud.getTempFileURL({ fileList: [fileId] })
  const item = res.fileList && res.fileList[0]
  if (!item || !item.tempFileURL) return null
  return { tempUrl: item.tempFileURL, expireAt: parseTempUrlExpiry(item.tempFileURL) }
}

// 批量把 cloud:// 文件 ID 换为临时 URL，返回 { fileId: tempUrl } 映射（每批最多50个）
async function resolveAvatarTempUrls(fileIds) {
  const urlMap = {}
  const MAX_BATCH = 50
  for (let i = 0; i < fileIds.length; i += MAX_BATCH) {
    const batch = fileIds.slice(i, i + MAX_BATCH)
    try {
      const res = await cloud.getTempFileURL({ fileList: batch })
      res.fileList.forEach(item => {
        if (item.tempFileURL) urlMap[item.fileID] = item.tempFileURL
      })
    } catch (e) {}
  }
  return urlMap
}

module.exports = {
  getToday,
  getYesterday,
  computeStats,
  refreshUserStats,
  avatarCacheFresh,
  parseTempUrlExpiry,
  resolveAvatarTempUrl,
  resolveAvatarTempUrls,
  AVATAR_TTL
}
