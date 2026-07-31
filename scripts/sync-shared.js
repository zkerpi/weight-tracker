// 把 cloud-shared/index.js 同步到各云函数的 shared/ 目录
// 用法：node scripts/sync-shared.js
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'cloud-shared', 'index.js')
const targets = ['login', 'recordWeight', 'deleteRecord', 'getRanking', 'updateProfile', 'getGroupMembers']

for (const fn of targets) {
  const destDir = path.join(root, 'cloudfunctions', fn, 'shared')
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(source, path.join(destDir, 'index.js'))
  console.log(`synced -> cloudfunctions/${fn}/shared/index.js`)
}
