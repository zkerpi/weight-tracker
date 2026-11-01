# 把照片类 PNG 压成合适尺寸的 JPEG，避免主包超过 2MB 限制
Add-Type -AssemblyName System.Drawing

$dir = 'D:\project\weight-tracker\miniprogram\images'

function Convert-Photo($srcName, $dstName, $maxWidth) {
  $src = Join-Path $dir $srcName
  $dst = Join-Path $dir $dstName
  $img = [System.Drawing.Image]::FromFile($src)
  $w = [math]::Min($maxWidth, $img.Width)
  $h = [int]($img.Height * $w / $img.Width)

  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $img.Dispose()

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ps = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)
  $bmp.Save($dst, $codec, $ps)
  $bmp.Dispose()

  $size = [math]::Round((Get-Item $dst).Length / 1KB)
  Write-Output ("{0} -> {1}x{2} {3}KB" -f $dstName, $w, $h, $size)
}

Convert-Photo 'cat-hero.png' 'cat-hero.jpg' 828
Convert-Photo 'cat-avatar.png' 'cat-avatar.jpg' 360
Convert-Photo 'profile-hero.png' 'profile-hero.jpg' 828

# 旧的位图图标（形状与设计稿不符，已被 tab-*.png 取代）
$obsolete = @('home.png','home-active.png','rank.png','rank-active.png','profile.png','profile-active.png')
foreach ($f in $obsolete) {
  $p = Join-Path $dir $f
  if (Test-Path $p) { Remove-Item $p -Force; Write-Output ("removed " + $f) }
}

# 原始超大 PNG 已在 JPEG 中保留，删掉以缩小主包
foreach ($f in @('cat-hero.png','cat-avatar.png','profile-hero.png')) {
  $p = Join-Path $dir $f
  if (Test-Path $p) { Remove-Item $p -Force; Write-Output ("removed " + $f) }
}

$total = (Get-ChildItem -Recurse 'D:\project\weight-tracker\miniprogram' | Measure-Object -Property Length -Sum).Sum
Write-Output ("miniprogram total: {0} KB" -f [math]::Round($total / 1KB))
