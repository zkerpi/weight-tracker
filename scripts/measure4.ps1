Add-Type -AssemblyName System.Drawing
$src = 'C:\Users\Administrator\.workbuddy\clipboard-images'
$f1 = Join-Path $src 'clipboard-2026-11-01T14-04-58-865Z-251d8ffd.png'
$bmp = New-Object System.Drawing.Bitmap($f1)
$W = $bmp.Width; $H = $bmp.Height
Write-Output "image $W x $H"

function Get-Px($x, $y) { return $bmp.GetPixel($x, $y) }

# 1) 圆环内部比背景亮：找亮区包围盒（限定首页上半部）
$minX = 9999; $maxX = -1; $minY = 9999; $maxY = -1
for ($y = 150; $y -lt 430; $y++) {
  for ($x = 20; $x -lt ($W - 20); $x++) {
    $p = Get-Px $x $y
    if ($p.R -ge 250 -and $p.G -ge 246 -and $p.B -ge 236) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
Write-Output ("RING  x[$minX..$maxX] w=" + ($maxX - $minX + 1) + "  y[$minY..$maxY] h=" + ($maxY - $minY + 1))

# 2) 数字：圆环区域内深色像素包围盒
$nMinX = 9999; $nMaxX = -1; $nMinY = 9999; $nMaxY = -1
for ($y = $minY; $y -lt $maxY; $y++) {
  for ($x = $minX; $x -lt $maxX; $x++) {
    $p = Get-Px $x $y
    $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
    if ($lum -lt 90) {
      if ($x -lt $nMinX) { $nMinX = $x }; if ($x -gt $nMaxX) { $nMaxX = $x }
      if ($y -lt $nMinY) { $nMinY = $y }; if ($y -gt $nMaxY) { $nMaxY = $y }
    }
  }
}
Write-Output ("NUM   x[$nMinX..$nMaxX] w=" + ($nMaxX - $nMinX + 1) + "  y[$nMinY..$nMaxY] h=" + ($nMaxY - $nMinY + 1))
$diam = $maxX - $minX + 1
Write-Output ("      num_h/ring_d = " + [math]::Round(($nMaxY - $nMinY + 1) / $diam, 3))
Write-Output ("      num_center_at = " + [math]::Round((($nMinY + $nMaxY) / 2 - $minY) / $diam, 3) + " of ring height")
Write-Output ("      num_w/ring_d  = " + [math]::Round(($nMaxX - $nMinX + 1) / $diam, 3))
Write-Output ("      ring left margin = $minX  right margin = " + ($W - 1 - $maxX))

# 3) 标题「今天」深色包围盒（限定 y 80..170）
$tMinX = 9999; $tMaxX = -1; $tMinY = 9999; $tMaxY = -1
for ($y = 70; $y -lt 175; $y++) {
  for ($x = 0; $x -lt 200; $x++) {
    $p = Get-Px $x $y
    $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
    if ($lum -lt 110) {
      if ($x -lt $tMinX) { $tMinX = $x }; if ($x -gt $tMaxX) { $tMaxX = $x }
      if ($y -lt $tMinY) { $tMinY = $y }; if ($y -gt $tMaxY) { $tMaxY = $y }
    }
  }
}
Write-Output ("TITLE x[$tMinX..$tMaxX] w=" + ($tMaxX - $tMinX + 1) + "  y[$tMinY..$tMaxY] h=" + ($tMaxY - $tMinY + 1))

# 4) 副标题行（y 175..205）深色包围盒
$sMinY = 9999; $sMaxY = -1; $sMinX = 9999; $sMaxX = -1
for ($y = 168; $y -lt 210; $y++) {
  for ($x = 0; $x -lt 260; $x++) {
    $p = Get-Px $x $y
    $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
    if ($lum -lt 190) {
      if ($x -lt $sMinX) { $sMinX = $x }; if ($x -gt $sMaxX) { $sMaxX = $x }
      if ($y -lt $sMinY) { $sMinY = $y }; if ($y -gt $sMaxY) { $sMaxY = $y }
    }
  }
}
Write-Output ("SUB   x[$sMinX..$sMaxX] y[$sMinY..$sMaxY] h=" + ($sMaxY - $sMinY + 1))

# 5) tabBar 图标区：找 y 740..780 内非背景像素的列分组
Write-Output '--- tabbar icon columns (y 735..775) ---'
$cols = @()
for ($x = 0; $x -lt $W; $x++) {
  $hit = 0
  for ($y = 735; $y -lt 778; $y++) {
    $p = Get-Px $x $y
    $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
    if ($lum -lt 170) { $hit++ }
  }
  $cols += $hit
}
$inRun = $false; $runStart = 0
for ($x = 0; $x -lt $W; $x++) {
  if ($cols[$x] -gt 0 -and -not $inRun) { $inRun = $true; $runStart = $x }
  elseif ($cols[$x] -eq 0 -and $inRun) { $inRun = $false; Write-Output ("  run x=" + $runStart + ".." + ($x - 1) + " w=" + ($x - $runStart)) }
}

# 6) 图标纵向范围（第一组）
Write-Output '--- first icon vertical extent ---'
$ymin = 9999; $ymax = -1
for ($y = 730; $y -lt 790; $y++) {
  for ($x = 40; $x -lt 120; $x++) {
    $p = Get-Px $x $y
    $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
    if ($lum -lt 170) { if ($y -lt $ymin) { $ymin = $y }; if ($y -gt $ymax) { $ymax = $y } }
  }
}
Write-Output ("  y $ymin..$ymax h=" + ($ymax - $ymin + 1))

$bmp.Dispose()
