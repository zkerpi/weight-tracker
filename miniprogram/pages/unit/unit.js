const util = require('../../utils/util')

Page({
  data: {
    unit: 'kg',
    unitLabel: '公斤',
    currentText: '',
    hasData: false,
    options: [],
    saving: false,
    savingUnit: ''
  },

  onLoad() {
    this.load()
  },

  async load() {
    const user = await getApp().ensureUser(false)
    if (!user) {
      this.setData({ hasData: false, options: this.buildOptions('kg', null) })
      return
    }
    const unit = user.weightUnit || 'kg'
    const kg = (user.stats || {}).currentWeight
    this.setData({
      unit,
      unitLabel: util.displayUnit(unit),
      currentText: kg == null ? '' : util.displayWeight(kg, unit),
      hasData: kg != null,
      options: this.buildOptions(unit, kg)
    })
  },

  buildOptions(unit, kg) {
    return [
      {
        key: 'kg',
        label: '公斤',
        code: 'kg',
        sample: kg == null ? '—' : util.displayWeight(kg, 'kg'),
        desc: '多数体重秤的刻度，适合对照设备读数'
      },
      {
        key: 'jin',
        label: '斤',
        code: '市斤',
        sample: kg == null ? '—' : util.displayWeight(kg, 'jin'),
        desc: '生活里更常用的说法，数字看起来更宽松'
      }
    ]
  },

  async choose(e) {
    const unit = e.currentTarget.dataset.unit
    if (unit === this.data.unit || this.data.saving) return
    this.setData({ saving: true, savingUnit: unit })
    try {
      const res = await wx.cloud.callFunction({ name: 'updateProfile', data: { weightUnit: unit } })
      if (!res.result || res.result.code !== 0) throw new Error((res.result && res.result.msg) || '失败')
      const app = getApp()
      app.setUserInfo(res.result.data)
      app.clearPageCaches()
      app.globalData.needsRefresh = true
      this.setData({ unit, unitLabel: util.displayUnit(unit), saving: false, savingUnit: '' })
      util.showSuccess('已切换为' + util.displayUnit(unit))
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      this.setData({ saving: false, savingUnit: '' })
      util.showError('切换失败，请重试')
    }
  }
})
