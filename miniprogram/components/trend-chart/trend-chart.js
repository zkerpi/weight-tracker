// 图表里的体重数字与页面其它地方同一套衬线；横轴日期、纵轴刻度留在无衬线
const NUM_FONT = '"Songti SC", "Noto Serif CJK SC", Georgia, serif'

Component({
  properties: {
    data: {
      type: Array,
      value: [],
      observer() {
        this._selectedIdx = -1
        this.drawChart()
      }
    },
    goalWeight: {
      type: Number,
      value: null
    },
    unitLabel: {
      type: String,
      value: 'kg'
    },
    goalType: {
      type: String,
      value: 'lose'
    },
    compact: {
      type: Boolean,
      value: false
    },
    // 显式高度（rpx）：不传则沿用 wxss 里的默认高度
    height: {
      type: Number,
      value: 0,
      observer() {
        this._ctx = null
        setTimeout(() => this.drawChart(), 50)
      }
    },
  },

  lifetimes: {
    attached() {
      this._selectedIdx = -1
      this._points = []
      // 等DOM准备好再画
      setTimeout(() => this.drawChart(), 100)
    }
  },

  methods: {
    drawChart() {
      const chartData = this.properties.data || []
      const goalWeight = this.properties.goalWeight

      if (chartData.length === 0) {
        if (this._ctx) this._ctx.clearRect(0, 0, this._canvasWidth, this._canvasHeight)
        this._points = []
        return
      }

      if (this._ctx) {
        this.renderChart(this._ctx, chartData, goalWeight, this._canvasWidth, this._canvasHeight)
        return
      }

      const query = this.createSelectorQuery()
      query.select('#trendCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return
          const canvas = res[0].node
          const dpr = wx.getSystemInfoSync().pixelRatio
          const width = res[0].width
          const height = res[0].height
          canvas.width = width * dpr
          canvas.height = height * dpr
          this._ctx = canvas.getContext('2d')
          this._ctx.scale(dpr, dpr)
          this._canvasWidth = width
          this._canvasHeight = height
          this.renderChart(this._ctx, chartData, goalWeight, width, height)
        })
    },

    renderChart(ctx, data, goalWeight, w, h) {
      ctx.clearRect(0, 0, w, h)
      this._points = []
      const compact = this.properties.compact
      const padding = compact
        ? { top: 18, right: 12, bottom: 16, left: 12 }
        : { top: 20, right: 20, bottom: 40, left: 50 }
      const goalType = this.properties.goalType || 'lose'
      const chartW = w - padding.left - padding.right
      const chartH = h - padding.top - padding.bottom

      // 提取有效数据点（有weight值的）
      const validPoints = data.filter(d => d.weight !== null && d.weight !== undefined)

      if (validPoints.length < 2) {
        // 不足两个有效点，只画一个标记
        if (validPoints.length === 1) {
          const index = data.findIndex(d => d.weight != null)
          const x = padding.left + chartW * index / Math.max(1, data.length - 1)
          const y = padding.top + chartH / 2
          ctx.fillStyle = '#2f4b39'
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#8a9086'
          ctx.font = 'bold 13px ' + NUM_FONT
          ctx.textAlign = 'center'
          ctx.fillText(validPoints[0].weight + ' ' + this.properties.unitLabel, Math.min(w - 45, Math.max(45, x)), y + 30)
        }
        return
      }

      // 计算范围
      const weights = validPoints.map(d => d.weight)
      const minWeight = Math.min(...weights)
      const maxWeight = Math.max(...weights)

      // Y轴范围（加padding，确保视觉舒适）
      let yMin = Math.floor(minWeight - 2)
      let yMax = Math.ceil(maxWeight + 2)
      if (yMin < 0) yMin = 0
      if (yMax <= yMin) yMax = yMin + 5

      const yRange = yMax - yMin

      // 清屏
      ctx.clearRect(0, 0, w, h)

      // 绘制网格线
      ctx.strokeStyle = '#e8e4d7'
      ctx.lineWidth = 1
      const gridLines = (compact || h < 240) ? 2 : 4
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartH / gridLines) * i
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(padding.left + chartW, y)
        ctx.stroke()

        // Y轴标签
        if (!compact) {
          const val = yMax - (yRange / gridLines) * i
          ctx.fillStyle = '#a9afa4'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'right'
          ctx.fillText(val.toFixed(1), padding.left - 8, y + 7)
        }
      }

      // X轴标签（取等间隔的几个点）
      const labelCount = Math.min(5, data.length)
      const labelStep = Math.max(1, Math.floor(data.length / labelCount))
      const xStep = chartW / (data.length - 1 || 1)

      ctx.fillStyle = '#a9afa4'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'

      for (let i = 0; !compact && i < data.length; i += labelStep) {
        const dateStr = data[i].date || ''
        // 设计稿横轴为「4/18」这类短格式
        const parts = dateStr.length >= 10 ? dateStr.slice(5).split('-') : []
        const label = parts.length === 2 ? `${Number(parts[0])}/${Number(parts[1])}` : dateStr
        const x = padding.left + i * xStep
        ctx.fillText(label, x, padding.top + chartH + 28)
      }

      // 绘制目标线
      if (!compact && goalWeight && goalWeight >= yMin && goalWeight <= yMax) {
        const goalY = padding.top + chartH - ((goalWeight - yMin) / yRange) * chartH

        // 增重模式：目标以上的区域用绿色半透明标出"已达标"
        if (goalType === 'gain') {
          ctx.fillStyle = 'rgba(47, 75, 57, 0.07)'
          ctx.fillRect(padding.left, padding.top, chartW, goalY - padding.top)
        }

        ctx.strokeStyle = '#c79064'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(padding.left, goalY)
        ctx.lineTo(padding.left + chartW, goalY)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = '#c79064'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'left'
        const goalLabel = goalType === 'gain' ? '目标增重' : '目标'
        ctx.fillText(goalLabel + ' ' + goalWeight + ' ' + this.properties.unitLabel, padding.left + chartW - 100, goalY - 8)
      }

      // 绘制折线
      const points = data.map((d, i) => {
        const x = padding.left + i * xStep
        let y = null
        if (d.weight !== null && d.weight !== undefined) {
          y = padding.top + chartH - ((d.weight - yMin) / yRange) * chartH
        }
        return { x, y, weight: d.weight }
      })
      // 保存点坐标供点击检测
      this._points = points

      // 连接有效点
      ctx.strokeStyle = '#2f4b39'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()

      let started = false
      for (const p of points) {
        if (p.y !== null) {
          if (!started) {
            ctx.moveTo(p.x, p.y)
            started = true
          } else {
            ctx.lineTo(p.x, p.y)
          }
        }
      }
      ctx.stroke()

      // 绘制数据点
      for (const p of points) {
        if (p.y !== null) {
          // 外圈
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(p.x, p.y, compact ? 4 : 6, 0, Math.PI * 2)
          ctx.fill()

          // 内圈
          ctx.fillStyle = '#2f4b39'
          ctx.beginPath()
          ctx.arc(p.x, p.y, compact ? 2.5 : 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 标注选中点或最新体重
      const selectedIdx = compact ? -1 : this._selectedIdx
      if (selectedIdx >= 0 && selectedIdx < points.length && points[selectedIdx] && points[selectedIdx].y !== null) {
        const sp = points[selectedIdx]

        // 虚线指示线
        ctx.save()
        ctx.strokeStyle = 'rgba(47, 75, 57, 0.22)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(sp.x, sp.y)
        ctx.lineTo(sp.x, padding.top + chartH)
        ctx.stroke()
        ctx.restore()

        // 外圈光晕
        ctx.fillStyle = 'rgba(47, 75, 57, 0.1)'
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 12, 0, Math.PI * 2)
        ctx.fill()

        // 选中圆点
        ctx.fillStyle = '#2f4b39'
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2)
        ctx.fill()

        // 体重标签
        ctx.fillStyle = '#2f4b39'
        ctx.font = 'bold 13px ' + NUM_FONT
        ctx.textAlign = 'center'
        ctx.fillText(sp.weight + ' ' + this.properties.unitLabel, Math.min(w - 42, Math.max(42, sp.x)), sp.y - 22)
      } else {
        const latest = points.filter(p => p.y !== null).slice(-1)[0]
        if (latest && latest.y !== null && !compact) {
          ctx.fillStyle = '#1e293b'
          ctx.font = 'bold 12px ' + NUM_FONT
          ctx.textAlign = 'center'
          ctx.fillText(latest.weight + ' ' + this.properties.unitLabel, Math.min(w - 42, Math.max(42, latest.x)), latest.y - 16)
        }
      }
    },

    onTouchStart(e) {
      if (this.properties.compact) return
      if (!this._points || this._points.length === 0) return
      const query = this.createSelectorQuery()
      query.select('#trendCanvas').boundingClientRect()
      query.exec(res => {
        if (!res || !res[0]) return
        this._canvasRect = res[0]
        this._handleTouch(e)
      })
    },

    onTouchMove(e) {
      if (!this._canvasRect) return
      this._handleTouch(e)
    },

    onTouchEnd() {
      // 保持最后选中的点
    },

    _handleTouch(e) {
      const rect = this._canvasRect
      if (!rect) return
      const touch = e.changedTouches && e.changedTouches[0]
      if (!touch) return
      const tapX = touch.clientX - rect.left

      // 找X轴最近的有效点（手指滑过时按X坐标定位）
      let minDist = Infinity
      let nearestIdx = -1
      for (let i = 0; i < this._points.length; i++) {
        const p = this._points[i]
        if (p.y === null) continue
        const dist = Math.abs(tapX - p.x)
        if (dist < minDist) {
          minDist = dist
          nearestIdx = i
        }
      }

      const newIdx = (nearestIdx >= 0 && minDist <= 200) ? nearestIdx : -1
      if (newIdx !== this._selectedIdx) {
        this._selectedIdx = newIdx
        this.drawChart()
      }
    }
  }
})
