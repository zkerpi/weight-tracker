const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
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

    // 清除被踢用户的 groupId
    const userRes = await db.collection('users').where({ openId: targetOpenId }).get()
    if (userRes.data.length > 0) {
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: { groupId: null }
      })
    }

    return { code: 0, msg: '已踢出' }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
