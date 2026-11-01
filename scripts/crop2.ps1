Add-Type -AssemblyName System.Drawing
$src = 'C:\Users\Administrator\.workbuddy\clipboard-images'
$out = 'D:\project\weight-tracker\preview'

function Crop-Zoom($file, $x, $y, $w, $h, $scale, $name) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $src $file))
  $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
  $crop = New-Object System.Drawing.Bitmap($w, $h)
  $g1 = [System.Drawing.Graphics]::FromImage($crop)
  $g1.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$w,$h)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g1.Dispose()
  $tw = [int]($w * $scale); $th = [int]($h * $scale)
  $big = New-Object System.Drawing.Bitmap($tw, $th)
  $g2 = [System.Drawing.Graphics]::FromImage($big)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.DrawImage($crop, 0, 0, $tw, $th)
  $g2.Dispose()
  $big.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $big.Dispose(); $crop.Dispose(); $img.Dispose()
  Write-Output "$name  $w x $h -> $tw x $th"
}

$f1 = 'clipboard-2026-11-01T14-04-58-865Z-251d8ffd.png'
$f2 = 'clipboard-2026-11-01T14-04-58-866Z-b8a2f24a.png'
$f3 = 'clipboard-2026-11-01T14-04-58-866Z-3ab32faa.png'

Crop-Zoom $f1 10 85 357 90 3 'z1-head.png'
Crop-Zoom $f1 40 160 300 250 3 'z1-ring.png'
Crop-Zoom $f1 0 720 377 96 3 'z1-tab.png'
Crop-Zoom $f1 10 420 357 200 3 'z1-cards.png'
Crop-Zoom $f2 10 85 357 180 3 'z2-head.png'
Crop-Zoom $f2 10 225 357 140 3 'z2-rows.png'
Crop-Zoom $f3 0 85 377 260 3 'z3-head.png'
