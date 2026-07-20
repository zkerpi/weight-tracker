Component({
  properties: {
    data: {
      type: Array,
      value: [],
      observer() {
        this.drawChart()
      }
    },
    goalWeight: {
      type: Number,
      value: null
    }
  },

  lifetimes: {
    attached() {
      // 等DOM准备好再画
      setTimeout(() => this.drawChart(), 100)
    }
  },

  methods: {
    drawChart() {
      const chartData = this.properties.data || []
      const goalWeight = this.properties.goalWeight

      if (chartData.length === 0) return

      const query = this.createSelectorQuery()
      query.select('#trendCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          const dpr = wx.getSystemInfoSync().pixelRatio
          const width = res[0].width
          const height = res[0].height

          canvas.width = width * dpr
          canvas.height = height * dpr
          ctx.scale(dpr, dpr)

          this.renderChart(ctx, chartData, goalWeight, width, height)
        })
    },

    renderChart(ctx, data, goalWeight, w, h) {
      const padding = { top: 20, right: 20, bottom: 40, left: 50 }
      const chartW = w - padding.left - padding.right
      const chartH = h - padding.top - padding.bottom

      // 提取有效数据点（有weight值的）
      const validPoints = data.filter(d => d.weight !== null && d.weight !== undefined)

      if (validPoints.length < 2) {
        // 不足两个有效点，只画一个标记
        if (validPoints.length === 1) {
          const x = padding.left + chartW / 2
          const y = padding.top + chartH / 2
          ctx.fillStyle = '#10b981'
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#64748b'
          ctx.font = '24rpx sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(validPoints[0].weight + ' kg', x, y + 30)
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
      ctx.strokeStyle = '#f1f5f9'
      ctx.lineWidth = 1
      const gridLines = 4
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartH / gridLines) * i
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(padding.left + chartW, y)
        ctx.stroke()

        // Y轴标签
        const val = yMax - (yRange / gridLines) * i
        ctx.fillStyle = '#94a3b8'
        ctx.font = '20rpx sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(val.toFixed(1), padding.left - 8, y + 7)
      }

      // X轴标签（取等间隔的几个点）
      const labelCount = Math.min(5, data.length)
      const labelStep = Math.max(1, Math.floor(data.length / labelCount))
      const xStep = chartW / (data.length - 1 || 1)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '20rpx sans-serif'
      ctx.textAlign = 'center'

      for (let i = 0; i < data.length; i += labelStep) {
        const dateStr = data[i].date || ''
        const label = dateStr.length >= 10 ? dateStr.slice(5) : dateStr
        const x = padding.left + i * xStep
        ctx.fillText(label, x, padding.top + chartH + 28)
      }

      // 绘制目标线
      if (goalWeight && goalWeight >= yMin && goalWeight <= yMax) {
        const goalY = padding.top + chartH - ((goalWeight - yMin) / yRange) * chartH
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(padding.left, goalY)
        ctx.lineTo(padding.left + chartW, goalY)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = '#f59e0b'
        ctx.font = '20rpx sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('目标 ' + goalWeight + 'kg', padding.left + chartW - 100, goalY - 8)
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

      // 连接有效点
      ctx.strokeStyle = '#10b981'
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
        } else {
          started = false
        }
      }
      ctx.stroke()

      // 绘制数据点
      for (const p of points) {
        if (p.y !== null) {
          // 外圈
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
          ctx.fill()

          // 内圈
          ctx.fillStyle = '#10b981'
          ctx.beginPath()
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 标注最新体重
      const latest = points[points.length - 1]
      if (latest && latest.y !== null) {
        ctx.fillStyle = '#1e293b'
        ctx.font = 'bold 22rpx sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(latest.weight + ' kg', latest.x, latest.y - 16)
      }
    }
  }
})
