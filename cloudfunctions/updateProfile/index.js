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

    if (userRes.data.length === 0) {
      return { code: -1, msg: '用户不存在' }
    }

    const user = userRes.data[0]
    const updateData = {}

    if (event.nickName) {
      updateData.nickName = event.nickName
    }
    if (event.avatarUrl) {
      updateData.avatarUrl = event.avatarUrl
    }
    if (event.goalWeight !== undefined) {
      updateData.goalWeight = event.goalWeight
    }
    if (event.goalType) {
      updateData.goalType = event.goalType
    }
    if (event.initialWeight !== undefined) {
      updateData.initialWeight = event.initialWeight
    }
    if (event.weightUnit) {
      updateData.weightUnit = event.weightUnit
    }
    // 头像变更且为 cloud:// 时同步解析临时 URL 缓存
    if (event.avatarUrl && event.avatarUrl.startsWith('cloud://') && event.avatarUrl !== user.avatarUrl) {
      try {
        const resolved = await shared.resolveAvatarTempUrl(event.avatarUrl)
        if (resolved) {
          updateData.avatarTempUrl = resolved.tempUrl
          updateData.avatarTempUrlExpire = resolved.expireAt
        }
      } catch (e) {}
    }
    updateData.setupDone = true

    await db.collection('users').doc(user._id).update({
      data: updateData
    })

    return {
      code: 0,
      data: {
        ...user,
        ...updateData
      }
    }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
