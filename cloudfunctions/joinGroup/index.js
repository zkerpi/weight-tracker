const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { inviteCode } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!inviteCode || inviteCode.trim() === '') return { code: -1, msg: '请输入邀请码' }

  try {
    // 查找群组
    const groupRes = await db.collection('groups').where({
      inviteCode: inviteCode.trim().toUpperCase()
    }).get()

    if (groupRes.data.length === 0) return { code: -1, msg: '邀请码无效' }

    const group = groupRes.data[0]

    // 检查用户是否已是成员
    const userRes = await db.collection('users').where({ openId: OPENID }).get()
    if (userRes.data.length === 0) return { code: -1, msg: '用户不存在' }

    const user = userRes.data[0]
    if (user.groupId) return { code: -1, msg: '你已在群组中，请先退出' }

    // 添加到群组成员列表
    const members = group.members || []
    if (!members.includes(OPENID)) {
      members.push(OPENID)
      await db.collection('groups').doc(group._id).update({
        data: { members }
      })
    }

    // 更新用户的 groupId
    await db.collection('users').doc(user._id).update({
      data: { groupId: group._id }
    })

    return { code: 0, data: group }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
