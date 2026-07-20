const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupName } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!groupName || groupName.trim() === '') return { code: -1, msg: '请输入群组名称' }

  try {
    // 检查用户是否已在群中
    const userRes = await db.collection('users').where({ openId: OPENID }).get()
    if (userRes.data.length === 0) return { code: -1, msg: '用户不存在' }

    const user = userRes.data[0]
    if (user.groupId) return { code: -1, msg: '你已在群组中，请先退出再加入' }

    // 生成不重复的邀请码
    let inviteCode
    let attempts = 0
    while (attempts < 20) {
      inviteCode = generateCode()
      const exist = await db.collection('groups').where({ inviteCode }).get()
      if (exist.data.length === 0) break
      attempts++
    }

    if (attempts >= 20) return { code: -1, msg: '生成邀请码失败，请重试' }

    // 创建群组
    const groupData = {
      groupName: groupName.trim(),
      inviteCode,
      creator: OPENID,
      members: [OPENID],
      createdAt: db.serverDate()
    }
    const groupRes = await db.collection('groups').add({ data: groupData })

    // 更新用户的 groupId
    await db.collection('users').doc(user._id).update({
      data: { groupId: groupRes._id }
    })

    return {
      code: 0,
      data: { ...groupData, _id: groupRes._id }
    }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
