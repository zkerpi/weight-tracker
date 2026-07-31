const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const shared = require('./shared/index')

exports.main = async (event, context) => {
  const { groupId } = event
  if (!groupId) return { code: -1, msg: '缺少群组ID' }

  try {
    // 获取群组信息
    const groupRes = await db.collection('groups').doc(groupId).get()
    const group = groupRes.data
    if (!group) return { code: -1, msg: '群组不存在' }

    // 获取成员详细信息
    const openIds = group.members || []
    let members = []
    if (openIds.length > 0) {
      const MAX_BATCH = 50
      for (let i = 0; i < openIds.length; i += MAX_BATCH) {
        const batch = openIds.slice(i, i + MAX_BATCH)
        const userRes = await db.collection('users')
          .where({ openId: db.command.in(batch) })
          .field({ _id: true, openId: true, nickName: true, avatarUrl: true, avatarTempUrl: true, avatarTempUrlExpire: true })
          .get()
        members = members.concat(userRes.data)
      }
      // 按原 members 顺序排列
      const memberMap = {}
      members.forEach(m => { memberMap[m.openId] = m })
      members = openIds.map(id => memberMap[id]).filter(Boolean)
    }

    // 头像：新鲜缓存直接替换为临时 URL（仅 cloud:// 源，其余待批量转换）
    members.forEach(m => {
      if (m.avatarUrl && m.avatarUrl.startsWith('cloud://') && shared.avatarCacheFresh(m)) {
        m.avatarUrl = m.avatarTempUrl
      }
    })

    // 转换 cloud:// 头像（过期缓存不新鲜，会重新走这里换取）
    const cloudFileIds = members
      .filter(m => m.avatarUrl && m.avatarUrl.startsWith('cloud://'))
      .map(m => m.avatarUrl)
    const urlMap = await shared.resolveAvatarTempUrls(cloudFileIds)
    const avatarWritebacks = []
    members.forEach(m => {
      if (m.avatarUrl && m.avatarUrl.startsWith('cloud://')) {
        const tempUrl = urlMap[m.avatarUrl] || ''
        m.avatarUrl = tempUrl
        // 写回新鲜临时链接+真实有效期，让缓存自洽（否则清理后每次拉成员都重复换取）
        if (tempUrl && m._id) {
          avatarWritebacks.push({ uid: m._id, tempUrl, expireAt: shared.parseTempUrlExpiry(tempUrl) })
        }
      }
    })
    if (avatarWritebacks.length > 0) {
      await Promise.all(avatarWritebacks.map(w =>
        db.collection('users').doc(w.uid).update({
          data: { avatarTempUrl: w.tempUrl, avatarTempUrlExpire: w.expireAt }
        }).catch(() => {})
      ))
    }

    return { code: 0, data: { group, members } }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
