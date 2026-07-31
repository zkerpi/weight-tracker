const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const shared = require('./shared/index')

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
      // 回填空 stats，保证 login 返回的 user 永远带 stats（空用户也是全 null/0）
      user.stats = await shared.refreshUserStats(OPENID)
    } else {
      user = userRes.data[0]
      const updateData = {}

      // 兼容老用户：已有非默认昵称则标记 setupDone
      if (user.setupDone === undefined && user.nickName && user.nickName !== '用户') {
        user.setupDone = true
        updateData.setupDone = true
      }

      // 迁移：老用户单群 groupId 转成 groupIds 数组（保留 groupId，旧版本客户端仍读它）
      if (user.groupId && !user.groupIds) {
        updateData.groupIds = [user.groupId]
      } else if (!user.groupId && user.groupIds && user.groupIds.length > 0) {
        // 修复：早期迁移曾把 groupId 置空，回填第一个群，避免旧版本客户端读不到群组
        updateData.groupId = user.groupIds[0]
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
        user.stats = await shared.refreshUserStats(OPENID)
      }
    }

    // 头像临时 URL 缓存：cloud:// 头像未缓存/过期则解析并写回
    if (user.avatarUrl && user.avatarUrl.startsWith('cloud://')) {
      try {
        if (!shared.avatarCacheFresh(user)) {
          const resolved = await shared.resolveAvatarTempUrl(user.avatarUrl)
          if (resolved) {
            await db.collection('users').doc(user._id).update({
              data: { avatarTempUrl: resolved.tempUrl, avatarTempUrlExpire: resolved.expireAt }
            })
            user.avatarTempUrl = resolved.tempUrl
            user.avatarTempUrlExpire = resolved.expireAt
          }
        }
      } catch (e) {}
    }

    return { code: 0, data: user }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
