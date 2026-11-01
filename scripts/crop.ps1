# 从设计稿里裁出局部并放大，方便精确量取尺寸与取色
Add-Type -AssemblyName System.Drawing

$src = 'D:\project\weight-tracker\preview\_design.jpg'
$outDir = 'D:\project\weight-tracker\preview'
$img = [System.Drawing.Image]::FromFile($src)
Write-Output ("design size: {0}x{1}" -f $img.Width, $img.Height)

function Crop-Zoom($name, $x0, $y0, $x1, $y1, $scale) {
  $w = [int](($x1 - $x0) * $img.Width)
  $h = [int](($y1 - $y0) * $img.Height)
  $sx = [int]($x0 * $img.Width)
  $sy = [int]($y0 * $img.Height)
  $bmp = New-Object System.Drawing.Bitmap(($w * $scale), ($h * $scale))
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, ($w * $scale), ($h * $scale))), (New-Object System.Drawing.Rectangle($sx, $sy, $w, $h)), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $p = Join-Path $outDir $name
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("{0}: crop {1},{2} {3}x{4} -> x{5}" -f $name, $sx, $sy, $w, $h, $scale)
}

# 三个手机屏各裁一张（去掉画布留白）
Crop-Zoom 'crop-home.png' 0.020 0.010 0.335 0.965 2
Crop-Zoom 'crop-group.png' 0.350 0.010 0.660 0.965 2
Crop-Zoom 'crop-me.png' 0.675 0.010 0.985 0.965 2

# 关键局部
Crop-Zoom 'crop-ring.png' 0.120 0.155 0.265 0.360 4
Crop-Zoom 'crop-row.png' 0.360 0.235 0.650 0.330 4

# 取色
function Sample($label, $fx, $fy) {
  $x = [int]($fx * $img.Width)
  $y = [int]($fy * $img.Height)
  $c = $img.GetPixel($x, $y)
  Write-Output ("{0}: #{1}{2}{3}" -f $label, $c.R.ToString('X2'), $c.G.ToString('X2'), $c.B.ToString('X2'))
}

Sample 'page-bg'        0.020 0.500
Sample 'card-bg'        0.060 0.640
Sample 'ring-inside'    0.140 0.180
Sample 'button-green'   0.200 0.480
Sample 'seg-active'     0.420 0.190
Sample 'trend-card-bg'  0.060 0.760
Sample 'text-dark'      0.135 0.530
Sample 'tab-inactive'   0.395 0.870
Sample 'tab-active'     0.470 0.870

$img.Dispose()
'done'
