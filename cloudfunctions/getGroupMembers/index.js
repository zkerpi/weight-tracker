const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-d9ghzs2af437701c3" })
const db = cloud.database()

exports.main = async (event, context) => {
  const { groupId } = event
  if (!groupId) return { code: -1, msg: '缺少群组ID' }

  try {
    // 获取群组信息
    const groupRes = await db.collection('groups').doc(groupId).get()
    const group = groupRes.data
    if (!group) return { code: -1, msg: '群组不存在' }

    // 获取成员详细信息
    const openIds = group.members || []
    let members = []
    if (openIds.length > 0) {
      const MAX_BATCH = 50
      for (let i = 0; i < openIds.length; i += MAX_BATCH) {
        const batch = openIds.slice(i, i + MAX_BATCH)
        const userRes = await db.collection('users')
          .where({ openId: db.command.in(batch) })
          .field({ openId: true, nickName: true, avatarUrl: true })
          .get()
        members = members.concat(userRes.data)
      }
      // 按原 members 顺序排列
      const memberMap = {}
      members.forEach(m => { memberMap[m.openId] = m })
      members = openIds.map(id => memberMap[id]).filter(Boolean)
    }

    // 转换 cloud:// 头像
    const cloudFileIds = members
      .filter(m => m.avatarUrl && m.avatarUrl.startsWith('cloud://'))
      .map(m => m.avatarUrl)
    if (cloudFileIds.length > 0) {
      try {
        const res = await cloud.getTempFileURL({ fileList: cloudFileIds })
        const urlMap = {}
        res.fileList.forEach(item => {
          if (item.tempFileURL) urlMap[item.fileID] = item.tempFileURL
        })
        members.forEach(m => {
          if (urlMap[m.avatarUrl]) m.avatarUrl = urlMap[m.avatarUrl]
        })
      } catch (e) {}
    }

    return { code: 0, data: { group, members } }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
