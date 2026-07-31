const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const shared = require('./shared/index')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { recordId } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!recordId) return { code: -1, msg: '参数缺失' }

  try {
    const record = await db.collection('records').doc(recordId).get()
    if (!record.data || record.data.openId !== OPENID) {
      return { code: -1, msg: '无权删除此记录' }
    }
    const openId = record.data.openId
    await db.collection('records').doc(recordId).remove()
    await shared.refreshUserStats(openId)
    return { code: 0, msg: '已删除' }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
