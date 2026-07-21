const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!groupId) return { code: -1, msg: '参数缺失' }

  try {
    const groupRes = await db.collection('groups').doc(groupId).get()
    if (!groupRes.data) return { code: -1, msg: '群组不存在' }

    const group = groupRes.data
    if (group.creator !== OPENID) return { code: -1, msg: '只有群主可以解散群组' }

    // 清除所有成员的 groupId
    const members = group.members || []
    for (const openId of members) {
      const userRes = await db.collection('users').where({ openId }).get()
      if (userRes.data.length > 0) {
        await db.collection('users').doc(userRes.data[0]._id).update({
          data: { groupId: null }
        })
      }
    }

    // 删除群组文档
    await db.collection('groups').doc(groupId).remove()

    return { code: 0, msg: '群组已解散' }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
