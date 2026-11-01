# 生成 tabBar 图标：81x81 PNG，形状对齐设计稿
# 叶子(今天) / 两人(小组) / 单人(我)
# 用法: powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\miniprogram\images'
$outDir = [System.IO.Path]::GetFullPath($outDir)
$S = 81
$gray = [System.Drawing.ColorTranslator]::FromHtml('#8A8F86')
$dark = [System.Drawing.ColorTranslator]::FromHtml('#2C4A38')

function New-Canvas {
  $bmp = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  return @($bmp, $g)
}

function Save-Canvas($bmp, $name) {
  $path = Join-Path $outDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("wrote " + $name)
}

function New-LinePen($color, $w) {
  $pen = New-Object System.Drawing.Pen -ArgumentList $color, ([single]$w)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

# ---------- 叶子 ----------
function Draw-Leaf($color, $filled, $name) {
  $r = New-Canvas; $bmp = $r[0]; $g = $r[1]
  $brush = New-Object System.Drawing.SolidBrush($color)
  $pen = New-LinePen $color 5.0
  $veinPen = New-LinePen $color 3.4

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  # 叶形：左下叶柄 -> 右上叶尖，两条对称贝塞尔
  $path.StartFigure()
  $path.AddBezier(17, 65, 14, 33, 32, 14, 64, 15)
  $path.AddBezier(64, 15, 63, 47, 46, 66, 17, 65)
  $path.CloseFigure()

  if ($filled) {
    $g.FillPath($brush, $path)
  } else {
    $g.DrawPath($pen, $path)
    $g.DrawBezier($veinPen, 24, 58, 33, 45, 45, 33, 58, 21)
  }
  $veinPen.Dispose(); $pen.Dispose(); $brush.Dispose(); $g.Dispose()
  Save-Canvas $bmp $name
}

# ---------- 人形（头 + 肩弧）----------
# shTop = 肩弧顶部的 y，shH = 肩弧可见高度（弧端落在 shTop + shH）
function Add-PersonFilled($g, $brush, $cx, $cy, $headR, $shW, $shTop, $shH) {
  $g.FillEllipse($brush, ($cx - $headR), ($cy - $headR), ($headR * 2), ($headR * 2))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(($cx - $shW / 2), $shTop, $shW, ($shH * 2), 180, 180)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Add-PersonLine($g, $pen, $cx, $cy, $headR, $shW, $shTop, $shH) {
  $g.DrawEllipse($pen, ($cx - $headR), ($cy - $headR), ($headR * 2), ($headR * 2))
  $rect = New-Object System.Drawing.RectangleF(($cx - $shW / 2), $shTop, $shW, ($shH * 2))
  $g.DrawArc($pen, $rect, 180, 180)
  $rect = $null
}

# 三个 tab 图标的整体包围盒统一在 ~54x45 内，保证视觉重量一致
function Draw-People($color, $filled, $name) {
  $r = New-Canvas; $bmp = $r[0]; $g = $r[1]
  if ($filled) {
    $brush = New-Object System.Drawing.SolidBrush($color)
    Add-PersonFilled $g $brush 55 29 8   30 45 12
    Add-PersonFilled $g $brush 28 30 9.5 34 46 14
    $brush.Dispose()
  } else {
    $pen = New-LinePen $color 5.2
    Add-PersonLine $g $pen 55 29 8   30 45 12
    Add-PersonLine $g $pen 28 30 9.5 34 46 14
    $pen.Dispose()
  }
  $g.Dispose(); Save-Canvas $bmp $name
}

function Draw-Single($color, $filled, $name) {
  $r = New-Canvas; $bmp = $r[0]; $g = $r[1]
  if ($filled) {
    $brush = New-Object System.Drawing.SolidBrush($color)
    Add-PersonFilled $g $brush 40.5 26 11 54 43 17
    $brush.Dispose()
  } else {
    $pen = New-LinePen $color 5.2
    Add-PersonLine $g $pen 40.5 26 11 54 43 17
    $pen.Dispose()
  }
  $g.Dispose(); Save-Canvas $bmp $name
}

Draw-Leaf $gray $false 'tab-today.png'
Draw-Leaf $dark $true  'tab-today-active.png'
Draw-People $gray $false 'tab-group.png'
Draw-People $dark $true  'tab-group-active.png'
Draw-Single $gray $false 'tab-me.png'
Draw-Single $dark $true  'tab-me-active.png'

# ---------- 页面内小图标（64x64，线描风格）----------
function Draw-PersonOutline($g, $pen, $cx, $cy, $headR, $shW, $shH) {
  $g.DrawEllipse($pen, $cx - $headR, $cy - $headR, $headR * 2, $headR * 2)
  $rect = New-Object System.Drawing.RectangleF(($cx - $shW / 2), ($cy + $headR * 0.5), $shW, ($shH * 2))
  $g.DrawArc($pen, $rect, 180, 180)
}

# 邀请：人 + 加号
function Draw-Invite($color, $name) {
  $bmp = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $pen = New-LinePen $color 3.4
  Draw-PersonOutline $g $pen 26 32 9.5 28 11
  # 加号（右上）
  $plus = New-LinePen $color 3.4
  $g.DrawLine($plus, 46, 18, 58, 18)
  $g.DrawLine($plus, 52, 12, 52, 24)
  $plus.Dispose(); $pen.Dispose(); $g.Dispose()
  Save-Canvas $bmp $name
}

# target icon: two rings plus arrow
function Draw-Target($color, $name) {
  $bmp = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $pen = New-LinePen $color 3.2
  $g.DrawEllipse($pen, 10, 14, 40, 40)
  $g.DrawEllipse($pen, 23, 27, 14, 14)
  # 斜向箭头
  $g.DrawLine($pen, 36, 30, 52, 14)
  $g.DrawLine($pen, 52, 14, 42, 14)
  $g.DrawLine($pen, 52, 14, 52, 24)
  $pen.Dispose(); $g.Dispose()
  Save-Canvas $bmp $name
}

# 体重单位：圆角方框 + kg
function Draw-UnitIcon($color, $name) {
  $bmp = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $pen = New-LinePen $color 3.2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 12
  $path.AddArc(8, 14, $r, $r, 180, 90)
  $path.AddArc(44, 14, $r, $r, 270, 90)
  $path.AddArc(44, 38, $r, $r, 0, 90)
  $path.AddArc(8, 38, $r, $r, 90, 90)
  $path.CloseFigure()
  $g.DrawPath($pen, $path)
  $font = New-Object System.Drawing.Font('Arial', 15, [System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush($color)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString('kg', $font, $brush, (New-Object System.Drawing.RectangleF(8, 14, 48, 36)), $fmt)
  $fmt.Dispose(); $font.Dispose(); $brush.Dispose(); $pen.Dispose(); $g.Dispose()
  Save-Canvas $bmp $name
}

# 所属小组：两个人（线描）
function Draw-UsersIcon($color, $name) {
  $bmp = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  $pen = New-LinePen $color 3.0
  Draw-PersonOutline $g $pen 40 32 7 21 9
  Draw-PersonOutline $g $pen 25 35 8.5 25 10.5
  $pen.Dispose(); $g.Dispose()
  Save-Canvas $bmp $name
}

Draw-Invite $dark 'ui-invite.png'
Draw-Target $dark 'ui-goal.png'
Draw-UnitIcon $dark 'ui-unit.png'
Draw-UsersIcon $dark 'ui-group.png'

Write-Output 'done'
