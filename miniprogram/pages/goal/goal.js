const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    unitLabel: '公斤',
    weightUnit: 'kg',
    currentText: '',
    startText: '',
    goalType: 'lose',
    goalText: '',
    inputW: 200,
    hasGoal: false,
    progress: null,
    diffText: '',
    saving: false
  },

  async onShow() {
    const user = await getApp().ensureUser(false)
    if (!user) return
    const unit = user.weightUnit || 'kg'
    const unitLabel = util.displayUnit(unit)
    const s = user.stats || {}
    const start = user.initialWeight || s.firstWeight
    const goalText = user.goalWeight ? util.displayWeight(user.goalWeight, unit) : ''
    this.setData({
      userInfo: user,
      weightUnit: unit,
      unitLabel,
      currentText: s.currentWeight != null ? util.displayWeight(s.currentWeight, unit) : '',
      startText: start ? util.displayWeight(start, unit) : '',
      goalType: user.goalType || 'lose',
      goalText,
      inputW: util.figureWidth(goalText || '0.0', 80, 200),
      hasGoal: !!user.goalWeight,
      progress: this.buildProgress(user)
    })
    this.refreshDiff()
  },

  buildProgress(user) {
    const s = user.stats || {}
    const unit = user.weightUnit || 'kg'
    const start = user.initialWeight || s.firstWeight
    const current = s.currentWeight
    const goal = user.goalWeight
    if (!start || current == null || !goal) return null
    const gain = user.goalType === 'gain'
    const total = gain ? goal - start : start - goal
    if (total <= 0) return null
    const done = gain ? current - start : start - current
    const reached = gain ? current >= goal : current <= goal
    const percent = reached ? 100 : Math.max(0, Math.min(99, Math.round(done / total * 100)))
    return {
      percent,
      start: util.displayWeight(start, unit),
      target: util.displayWeight(goal, unit),
      current: util.displayWeight(current, unit),
      caption: reached
        ? '已经到达目标，接下来只要稳住'
        : '还差 ' + util.displayWeight(Math.abs(current - goal), unit) + ' ' + util.displayUnit(unit)
    }
  },

  // 输入目标时给的即时预览，不参与保存
  refreshDiff() {
    const user = this.data.userInfo || {}
    const unit = user.weightUnit || 'kg'
    const unitLabel = util.displayUnit(unit)
    const s = user.stats || {}
    const start = user.initialWeight || s.firstWeight
    const current = s.currentWeight
    const goalKg = Number(this.data.goalText) > 0 ? util.toKg(Number(this.data.goalText), unit) : null
    const gain = this.data.goalType === 'gain'
    let diffText = ''

    if (!goalKg) {
      diffText = '填一个数字，就知道还差多少'
    } else if (start && current != null) {
      const delta = gain ? goalKg - current : current - goalKg
      diffText = delta > 0
        ? '从现在的 ' + util.displayWeight(current, unit) + ' ' + unitLabel + '，还要' + (gain ? '增' : '减') + ' ' + util.displayWeight(delta, unit) + ' ' + unitLabel
        : (delta === 0 ? '你已经在这个体重上了' : '这个目标比现在更' + (gain ? '轻' : '重') + '，方向和数字不一致')
    } else if (start) {
      const delta = Math.abs(start - goalKg)
      diffText = '从 ' + util.displayWeight(start, unit) + ' ' + unitLabel + ' 出发，需要' + (gain ? '增' : '减') + ' ' + util.displayWeight(delta, unit) + ' ' + unitLabel
    } else {
      diffText = '记录第一笔体重后，会自动作为起点'
    }
    this.setData({ diffText })
  },

  setGoalType(e) {
    const goalType = e.currentTarget.dataset.type
    if (goalType === this.data.goalType) return
    this.setData({ goalType })
    this.refreshDiff()
  },

  onGoalInput(e) {
    const goalText = e.detail.value
    this.setData({ goalText, inputW: util.figureWidth(goalText || '0.0', 80, 200) })
    this.refreshDiff()
  },

  async save() {
    if (this.data.saving) return
    if (!this.data.userInfo) { util.showToast('个人数据还在加载，稍等一下'); return }
    const unit = this.data.weightUnit
    const goal = util.toKg(Number(this.data.goalText), unit)
    if (!Number.isFinite(goal) || goal <= 0 || goal > 300) { util.showToast('请输入有效的目标体重'); return }

    const s = this.data.userInfo.stats || {}
    const baseline = this.data.userInfo.initialWeight || s.firstWeight
    if (baseline && ((this.data.goalType === 'lose' && goal >= baseline) || (this.data.goalType === 'gain' && goal <= baseline))) {
      util.showToast(this.data.goalType === 'lose' ? '目标要比起点轻一些' : '目标要比起点重一些')
      return
    }

    this.setData({ saving: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateProfile',
        data: { goalWeight: Math.round(goal * 100) / 100, goalType: this.data.goalType }
      })
      if (!res.result || res.result.code !== 0) throw new Error((res.result && res.result.msg) || '保存失败')
      const app = getApp()
      app.setUserInfo(res.result.data)
      app.clearPageCaches()
      app.globalData.needsRefresh = true
      util.showSuccess('目标已保存')
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      util.showToast(err.message === '目标体重与方向不一致' ? '目标与方向不一致' : '保存失败，请重试')
    } finally {
      this.setData({ saving: false })
    }
  }
})
