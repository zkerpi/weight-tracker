const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { code: -1, msg: '获取用户身份失败' }
  }

  try {
    const userRes = await db.collection('users').where({
      openId: OPENID
    }).get()

    let user
    if (userRes.data.length === 0) {
      // 新用户，创建记录
      const newUser = {
        openId: OPENID,
        nickName: event.nickName || '用户',
        avatarUrl: event.avatarUrl || '',
        goalWeight: null,
        goalType: 'lose',
        groupId: null,
        createdAt: db.serverDate()
      }
      const res = await db.collection('users').add({ data: newUser })
      user = { ...newUser, _id: res._id }
    } else {
      user = userRes.data[0]
      // 更新昵称和头像
      if (event.nickName || event.avatarUrl) {
        const updateData = {}
        if (event.nickName) updateData.nickName = event.nickName
        if (event.avatarUrl) updateData.avatarUrl = event.avatarUrl
        await db.collection('users').doc(user._id).update({ data: updateData })
        Object.assign(user, updateData)
      }
    }

    return { code: 0, data: user }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
