const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!groupId) return { code: -1, msg: '参数缺失' }

  try {
    const userRes = await db.collection('users').where({ openId: OPENID }).get()
    if (userRes.data.length === 0) return { code: -1, msg: '用户不存在' }

    const user = userRes.data[0]
    if (!(user.groupIds || []).includes(groupId)) return { code: -1, msg: '你不在该群组中' }

    // 从群组成员中移除
    await db.collection('groups').doc(groupId).update({
      data: {
        members: db.command.pull(OPENID)
      }
    })

    // 从用户的群组列表中移除（兼容老用户清理单值 groupId）
    const updateData = { groupIds: db.command.pull(groupId) }
    if (user.groupId === groupId) updateData.groupId = null
    await db.collection('users').doc(user._id).update({ data: updateData })

    return { code: 0, msg: '已退出群组' }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
