param(
  [string]$Html = 'D:\project\weight-tracker\preview\_all.html',
  [string]$Out  = 'D:\project\weight-tracker\preview\_all.png',
  [int]$Width = 2420,
  [int]$Height = 1300,
  [int]$Scale = 1
)
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$tmp = Join-Path $env:TEMP ('cshot_' + [guid]::NewGuid().ToString('N'))
if (Test-Path $Out) { Remove-Item $Out -Force }
$url = 'file:///' + $Html.Replace('\','/')
$args2 = @(
  '--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--hide-scrollbars',
  "--force-device-scale-factor=$Scale","--window-size=$Width,$Height",
  "--user-data-dir=$tmp","--screenshot=$Out", $url
)
$p = Start-Process -FilePath $chrome -ArgumentList $args2 -PassThru -Wait
if (Test-Path $Out) {
  Write-Output ("ok " + (Get-Item $Out).Length + " bytes")
} else {
  Write-Output "FAILED"
}
