Add-Type -AssemblyName System.Drawing

$srcDir = 'C:\Users\Administrator\.workbuddy\clipboard-images'
$old = @(
  'clipboard-2026-11-01T14-04-58-865Z-251d8ffd.png',
  'clipboard-2026-11-01T14-04-58-866Z-b8a2f24a.png',
  'clipboard-2026-11-01T14-04-58-866Z-3ab32faa.png'
)
$newPng = 'D:\project\weight-tracker\preview\_screens.png'

$fw = 375; $fh = 812; $gap = 18; $pad = 24; $labelH = 26
$W = $pad * 2 + $fw * 3 + $gap * 2
$H = $pad * 2 + $labelH * 2 + $fh * 2 + $gap

$out = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#cfcabf'))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

$font = New-Object System.Drawing.Font('Arial', 12, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#4a5044'))

# 上排：现在的截图
$g.DrawString('BEFORE  (your screenshots)', $font, $brush, $pad, $pad)
$y1 = $pad + $labelH
for ($i = 0; $i -lt 3; $i++) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $srcDir $old[$i]))
  $x = $pad + $i * ($fw + $gap)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle($x, $y1, $fw, $fh)))
  $img.Dispose()
}

# 下排：改后的渲染
$y2 = $y1 + $fh + $gap
$g.DrawString('AFTER  (rebuilt to the measured values)', $font, $brush, $pad, $y2)
$y3 = $y2 + $labelH
$sheet = [System.Drawing.Image]::FromFile($newPng)
for ($i = 0; $i -lt 3; $i++) {
  $sx = (26 + $i * (375 + 26)) * 2
  $sy = 26 * 2
  $rect = New-Object System.Drawing.Rectangle($sx, $sy, (375 * 2), (812 * 2))
  $x = $pad + $i * ($fw + $gap)
  $g.DrawImage($sheet, (New-Object System.Drawing.Rectangle($x, $y3, $fw, $fh)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
}
$sheet.Dispose()
$font.Dispose(); $brush.Dispose(); $g.Dispose()
$out.Save('D:\project\weight-tracker\preview\before-after.png', [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()
Write-Output ('saved ' + $W + 'x' + $H)
