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
    for (const key of ['goalWeight', 'initialWeight']) {
      if (event[key] !== undefined && (typeof event[key] !== 'number' || !Number.isFinite(event[key]) || event[key] <= 0 || event[key] > 300)) return { code: -1, msg: '体重数据无效' }
    }
    if (event.goalType !== undefined && !['lose', 'gain'].includes(event.goalType)) return { code: -1, msg: '目标方向无效' }
    if (event.weightUnit !== undefined && !['kg', 'jin'].includes(event.weightUnit)) return { code: -1, msg: '体重单位无效' }
    if (event.nickName !== undefined && (typeof event.nickName !== 'string' || !event.nickName.trim() || event.nickName.length > 20)) return { code: -1, msg: '昵称需为1至20字' }
    if (event.goalWeight !== undefined || event.initialWeight !== undefined || event.goalType !== undefined) {
      const goal = event.goalWeight === undefined ? user.goalWeight : event.goalWeight
      const initial = event.initialWeight === undefined ? (user.initialWeight || (user.stats || {}).firstWeight) : event.initialWeight
      const direction = event.goalType || user.goalType || 'lose'
      if (goal && initial && (direction === 'lose' ? goal >= initial : goal <= initial)) return { code: -1, msg: '目标体重与方向不一致' }
    }

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
