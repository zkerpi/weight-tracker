Add-Type -AssemblyName System.Drawing
$src = 'D:\project\weight-tracker\preview\_screens.png'
function Crop($x, $y, $w, $h, $scale, $name) {
  $img = [System.Drawing.Image]::FromFile($src)
  $crop = New-Object System.Drawing.Bitmap($w, $h)
  $g1 = [System.Drawing.Graphics]::FromImage($crop)
  $g1.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)), (New-Object System.Drawing.Rectangle($x, $y, $w, $h)), [System.Drawing.GraphicsUnit]::Pixel)
  $g1.Dispose()
  $tw = [int]($w * $scale); $th = [int]($h * $scale)
  $big = New-Object System.Drawing.Bitmap($tw, $th)
  $g2 = [System.Drawing.Graphics]::FromImage($big)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.DrawImage($crop, 0, 0, $tw, $th)
  $g2.Dispose()
  $big.Save(('D:\project\weight-tracker\preview\' + $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $big.Dispose(); $crop.Dispose(); $img.Dispose()
  Write-Output ($name + ' ok')
}
Crop 100 340 660 560 1.4 'r1-ring.png'
Crop 1650 150 780 620 1.2 'r3-hero.png'
Crop 760 330 760 520 1.2 'r2-feed.png'
