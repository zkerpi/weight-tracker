# 斤斤轻体重记 (斤斤轻体重记 - Group Weight Tracking)

微信小程序，用于朋友间每日体重打卡与减重排行。

## 功能

- 每日打卡：记录每日体重，支持修改
- 体重趋势图：7/14/30 天趋势可视化
- 个人统计：初始体重、已减重、打卡天数、连续打卡
- 目标管理：设定目标体重，实时追踪进度
- 群组排行：创建/加入群组，多维度排行（减重、百分比、连胜）

## 技术栈

- 微信小程序原生开发 (WXML + WXSS + JS)
- 微信云开发 (Cloud Base)：云函数 + 云数据库

## 前置条件

1. 已注册微信小程序（微信公众平台）
2. 已开通微信云开发（开通后自动获得免费额度）

## 配置步骤

### 1. 修改 AppID

打开 project.config.json，将 YOUR_APPID_HERE 替换为你的小程序 AppID。

### 2. 初始化云环境

打开 miniprogram/app.js，将 YOUR_CLOUD_ENV_ID 替换为你的云环境 ID。

### 3. 创建数据库集合

创建三个集合：users, records, groups
权限设为：所有用户可读，仅创建者可写

### 4. 部署云函数

部署 5 个云函数：login, recordWeight, getRanking, createGroup, joinGroup

### 5. 添加数据库索引

records 集合创建复合索引：openId (升序), date (升序)
