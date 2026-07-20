const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { weight, date } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (!weight || weight <= 0) return { code: -1, msg: '体重数据无效' }
  if (!date) return { code: -1, msg: '日期缺失' }

  try {
    // 查找当天是否已有记录
    const existRes = await db.collection('records').where({
      openId: OPENID,
      date: date
    }).get()

    if (existRes.data.length > 0) {
      // 更新已有记录
      const record = existRes.data[0]
      await db.collection('records').doc(record._id).update({
        data: {
          weight: weight,
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, msg: '已更新', data: { ...record, weight } }
    } else {
      // 新增记录
      const newRecord = {
        openId: OPENID,
        weight: weight,
        date: date,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      const res = await db.collection('records').add({ data: newRecord })
      return { code: 0, msg: '打卡成功', data: { ...newRecord, _id: res._id } }
    }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
