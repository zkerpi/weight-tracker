const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId, targetOpenId } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!groupId || !targetOpenId) return { code: -1, msg: '参数缺失' }

  try {
    const groupRes = await db.collection('groups').doc(groupId).get()
    if (!groupRes.data) return { code: -1, msg: '群组不存在' }

    const group = groupRes.data
    if (group.creator !== OPENID) return { code: -1, msg: '只有群主可以踢人' }
    if (targetOpenId === OPENID) return { code: -1, msg: '不能踢自己' }

    // 从群组成员中移除
    await db.collection('groups').doc(groupId).update({
      data: { members: db.command.pull(targetOpenId) }
    })

    // 将被踢用户从该群移除（兼容老用户清理单值 groupId）
    const userRes = await db.collection('users').where({ openId: targetOpenId }).get()
    if (userRes.data.length > 0) {
      const target = userRes.data[0]
      const updateData = { groupIds: db.command.pull(groupId) }
      if (target.groupId === groupId) updateData.groupId = null
      await db.collection('users').doc(target._id).update({ data: updateData })
    }

    return { code: 0, msg: '已踢出' }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
