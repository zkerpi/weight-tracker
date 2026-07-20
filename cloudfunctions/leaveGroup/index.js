const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }

  try {
    const userRes = await db.collection('users').where({ openId: OPENID }).get()
    if (userRes.data.length === 0) return { code: -1, msg: '用户不存在' }

    const user = userRes.data[0]
    if (!user.groupId) return { code: -1, msg: '你不在任何群组中' }

    const groupId = user.groupId

    // 从群组成员中移除
    const groupRes = await db.collection('groups').doc(groupId).get()
    if (groupRes.data) {
      const members = (groupRes.data.members || []).filter(m => m !== OPENID)
      await db.collection('groups').doc(groupId).update({
        data: { members }
      })
    }

    // 清空用户的 groupId
    await db.collection('users').doc(user._id).update({
      data: { groupId: null }
    })

    return { code: 0, msg: '已退出群组' }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
