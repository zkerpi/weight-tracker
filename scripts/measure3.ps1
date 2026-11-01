# 定向扫描：只看中轴线与数字带，避开背景植物干扰
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile('D:\project\weight-tracker\preview\crop-home.png')
$W = $img.Width; $H = $img.Height
$L = 375.0 / $W
function LG($v) { return [math]::Round($v * $L, 1) }

# 1) 沿中轴找圆盘上下边界：亮而偏白 (#FBF6F0 左右) 与外围照片底区分
$cx = [int]($W / 2)
$inRing = @()
for ($y = 0; $y -lt 1000; $y++) {
  $c = $img.GetPixel($cx, $y)
  $bright = ($c.R + $c.G + $c.B) / 3
  if ($bright -gt 240 -and ($c.R - $c.B) -lt 22) { $inRing += $y }
}
if ($inRing.Count -gt 0) {
  $t = $inRing[0]; $b = $inRing[$inRing.Count - 1]
  Write-Output ("CIRCLE on axis: top {0} bottom {1} d {2} | logical top {3} d {4}" -f $t, $b, ($b - $t), (LG $t), (LG ($b - $t)))
}

# 2) 数字墨迹：在 x 中段找真正的深色块
$ny0 = -1; $ny1 = -1; $nx0 = 9999; $nx1 = -1
for ($y = 300; $y -lt 900; $y++) {
  $cnt = 0; $rowMin = 9999; $rowMax = -1
  for ($x = 200; $x -lt 760; $x++) {
    $c = $img.GetPixel($x, $y)
    if ($c.R -lt 80 -and $c.G -lt 80 -and $c.B -lt 80) {
      $cnt++
      if ($x -lt $rowMin) { $rowMin = $x }
      if ($x -gt $rowMax) { $rowMax = $x }
    }
  }
  if ($cnt -ge 6) {
    if ($ny0 -lt 0) { $ny0 = $y }
    $ny1 = $y
    if ($rowMin -lt $nx0) { $nx0 = $rowMin }
    if ($rowMax -gt $nx1) { $nx1 = $rowMax }
  }
}
Write-Output ("NUMBER ink: x {0}..{1} y {2}..{3} | logical left {4} width {5} top {6} height {7}" -f `
  $nx0, $nx1, $ny0, $ny1, (LG $nx0), (LG ($nx1 - $nx0)), (LG $ny0), (LG ($ny1 - $ny0)))

# 3) 「当前体重」标签：数字上方的次要深灰
$cy0 = -1; $cy1 = -1
for ($y = 150; $y -lt $ny0; $y++) {
  $cnt = 0
  for ($x = 380; $x -lt 600; $x++) {
    $c = $img.GetPixel($x, $y)
    if (($c.R + $c.G + $c.B) / 3 -lt 150) { $cnt++ }
  }
  if ($cnt -ge 4) { if ($cy0 -lt 0) { $cy0 = $y }; $cy1 = $y }
}
Write-Output ("CAPTION: y {0}..{1} | logical top {2} height {3}" -f $cy0, $cy1, (LG $cy0), (LG ($cy1 - $cy0)))

# 4) 胶囊：浅绿底
$py0 = -1; $py1 = -1; $px0 = 9999; $px1 = -1
for ($y = $ny1; $y -lt ($ny1 + 200); $y++) {
  for ($x = 300; $x -lt 700; $x++) {
    $c = $img.GetPixel($x, $y)
    if (($c.G - $c.R) -gt 4 -and ($c.G - $c.B) -gt 2 -and ($c.R + $c.G + $c.B) -gt 600) {
      if ($py0 -lt 0) { $py0 = $y }
      $py1 = $y
      if ($x -lt $px0) { $px0 = $x }
      if ($x -gt $px1) { $px1 = $x }
    }
  }
}
Write-Output ("CHIP: x {0}..{1} y {2}..{3} | logical left {4} width {5} top {6} height {7}" -f `
  $px0, $px1, $py0, $py1, (LG $px0), (LG ($px1 - $px0)), (LG $py0), (LG ($py1 - $py0)))

# 5) 右侧「kg」墨迹
$kx0 = 9999; $kx1 = -1; $ky0 = -1; $ky1 = -1
for ($y = $ny0; $y -lt $ny1; $y++) {
  for ($x = $nx1 + 2; $x -lt ($nx1 + 120); $x++) {
    $c = $img.GetPixel($x, $y)
    if ($c.R -lt 110 -and $c.G -lt 110 -and $c.B -lt 110) {
      if ($x -lt $kx0) { $kx0 = $x }
      if ($x -gt $kx1) { $kx1 = $x }
      if ($ky0 -lt 0) { $ky0 = $y }
      $ky1 = $y
    }
  }
}
Write-Output ("KG: x {0}..{1} y {2}..{3} | logical height {4} gapFromNumber {5}" -f `
  $kx0, $kx1, $ky0, $ky1, (LG ($ky1 - $ky0)), (LG ($kx0 - $nx1)))

$img.Dispose()
'done'
