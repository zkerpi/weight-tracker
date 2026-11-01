Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap('D:\project\weight-tracker\preview\_screens.png')
Write-Output ("png " + $bmp.Width + " x " + $bmp.Height)

$minX = 9999; $maxX = -1; $minY = 9999; $maxY = -1
for ($y = 300; $y -lt 900; $y++) {
  for ($x = 120; $x -lt 700; $x++) {
    $p = $bmp.GetPixel($x, $y)
    if ($p.R -ge 250 -and $p.G -ge 246 -and $p.B -ge 236) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$d = $maxX - $minX + 1
Write-Output ("RING x " + $minX + ".." + $maxX + " w=" + $d + "  y " + $minY + ".." + $maxY + " h=" + ($maxY - $minY + 1))

$nMinX = 9999; $nMaxX = -1; $nMinY = 9999; $nMaxY = -1
for ($y = $minY; $y -lt $maxY; $y++) {
  for ($x = $minX; $x -lt $maxX; $x++) {
    $p = $bmp.GetPixel($x, $y)
    $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
    if ($lum -lt 90) {
      if ($x -lt $nMinX) { $nMinX = $x }
      if ($x -gt $nMaxX) { $nMaxX = $x }
      if ($y -lt $nMinY) { $nMinY = $y }
      if ($y -gt $nMaxY) { $nMaxY = $y }
    }
  }
}
$nw = $nMaxX - $nMinX + 1; $nh = $nMaxY - $nMinY + 1
Write-Output ("NUM  x " + $nMinX + ".." + $nMaxX + " w=" + $nw + "  y " + $nMinY + ".." + $nMaxY + " h=" + $nh)
Write-Output ("css ring d = " + ($d / 2) + ", num w = " + ($nw / 2) + ", num h = " + ($nh / 2))
Write-Output ("num_w / ring_d = " + [math]::Round($nw / $d, 3))
Write-Output ("left gap = " + [math]::Round(($nMinX - $minX) / 2) + "px, right gap = " + [math]::Round(($maxX - $nMaxX) / 2) + "px")
Write-Output ("num center at " + [math]::Round(((($nMinY + $nMaxY) / 2) - $minY) / $d, 3) + " of ring height")
Write-Output ("empty above num = " + [math]::Round(($nMinY - $minY) / 2) + "px, num bottom to ring bottom = " + [math]::Round(($maxY - $nMaxY) / 2) + "px")
$bmp.Dispose()
