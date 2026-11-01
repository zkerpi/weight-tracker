const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const shared = require('./shared/index')

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { weight, date, note } = event

  if (!OPENID) return { code: -1, msg: '获取用户身份失败' }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 300) return { code: -1, msg: '体重数据无效' }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > shared.getToday()) return { code: -1, msg: '请选择有效日期，不能记录未来日期' }
  if (note != null && (typeof note !== 'string' || note.length > 30)) return { code: -1, msg: '备注最多30字' }

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
          note: note || '',
          updatedAt: db.serverDate()
        }
      })
      await shared.refreshUserStats(OPENID)
      return { code: 0, msg: '已更新', data: { ...record, weight } }
    } else {
      // 新增记录
      const newRecord = {
        openId: OPENID,
        weight: weight,
        date: date,
        note: note || '',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      const res = await db.collection('records').add({ data: newRecord })
      await shared.refreshUserStats(OPENID)
      return { code: 0, msg: '打卡成功', data: { ...newRecord, _id: res._id } }
    }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
