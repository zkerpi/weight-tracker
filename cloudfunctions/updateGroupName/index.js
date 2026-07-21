const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId, groupName } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!groupId || !groupName || groupName.trim() === '') return { code: -1, msg: '参数缺失' }

  try {
    const groupRes = await db.collection('groups').doc(groupId).get()
    if (!groupRes.data) return { code: -1, msg: '群组不存在' }

    const group = groupRes.data
    if (group.creator !== OPENID) return { code: -1, msg: '只有群主可以修改群名' }

    await db.collection('groups').doc(groupId).update({
      data: { groupName: groupName.trim() }
    })

    return { code: 0, msg: '群名已更新', data: { groupName: groupName.trim() } }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
