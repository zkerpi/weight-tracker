Add-Type -AssemblyName System.Drawing
$dir = 'D:\project\weight-tracker\miniprogram\images'
$names = @('tab-today.png','tab-group.png','tab-me.png','tab-today-active.png','tab-group-active.png','tab-me-active.png')
$cell = 120
$bmp = New-Object System.Drawing.Bitmap(($cell * 6), ($cell * 2))
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#FFFEFA'))
for ($i = 0; $i -lt 6; $i++) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $dir $names[$i]))
  # 上排：真实显示尺寸 27px
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, ($i * $cell + 46), 20, 27, 27)
  # 下排：3 倍放大看细节
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.DrawImage($img, ($i * $cell + 6), 60, 81, 81)
  $img.Dispose()
}
$g.Dispose()
$bmp.Save('D:\project\weight-tracker\preview\_icons2.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output 'montage ok'
