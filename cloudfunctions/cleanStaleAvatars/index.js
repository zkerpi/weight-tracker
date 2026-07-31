const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 一次性清理：清掉 users 里旧的头像临时链接缓存（死链接 403 的根源）。
// 下次读排行榜/成员时会用新逻辑重新换取有效临时链接。
exports.main = async () => {
  const MAX = 100
  let updated = 0
  let lastId = ''
  while (true) {
    const res = await db.collection('users')
      .where({
        avatarTempUrl: db.command.neq(''),
        _id: db.command.gt(lastId)
      })
      .orderBy('_id', 'asc')
      .limit(MAX)
      .field({ _id: true })
      .get()
    const docs = res.data
    if (!docs.length) break

    const upd = await db.collection('users')
      .where({ _id: db.command.in(docs.map(d => d._id)) })
      .update({ data: { avatarTempUrl: '', avatarTempUrlExpire: 0 } })
    updated += upd.stats.updated || 0

    lastId = docs[docs.length - 1]._id
    if (docs.length < MAX) break
  }
  return { code: 0, updated }
}
