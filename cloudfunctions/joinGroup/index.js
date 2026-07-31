const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
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

    // 检查用户是否已是该群成员
    const userRes = await db.collection('users').where({ openId: OPENID }).get()
    if (userRes.data.length === 0) return { code: -1, msg: '用户不存在' }

    const user = userRes.data[0]
    if ((user.groupIds || []).includes(group._id)) return { code: -1, msg: '你已在该群组中' }

    // 添加到群组成员列表
    await db.collection('groups').doc(group._id).update({
      data: {
        members: db.command.push(OPENID)
      }
    })

    // 更新用户的群组列表
    await db.collection('users').doc(user._id).update({
      data: { groupIds: db.command.push(group._id) }
    })

    return { code: 0, data: group }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
