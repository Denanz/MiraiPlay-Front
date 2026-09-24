# Упаковка dist-tizen/ в MiraiPlay.wgt и (по желанию) установка на телевизор.
#
#   npm run build:tizen
#   npm run package:tizen                                  # только .wgt
#   powershell -File tizen/package.ps1 -TvIp 192.168.1.50  # .wgt + установка + запуск
#
# Нужны Tizen Studio (CLI) и профиль Samsung-сертификата (создаётся в Certificate Manager).
param(
  [string]$TvIp = "",
  [string]$Profile = $(if ($env:TIZEN_PROFILE) { $env:TIZEN_PROFILE } else { "MiraiPlay" }),
  [string]$TizenStudio = $(if ($env:TIZEN_STUDIO) { $env:TIZEN_STUDIO } else { "C:\tizen-studio" })
)
$ErrorActionPreference = "Stop"

$tizen = Join-Path $TizenStudio "tools\ide\bin\tizen.bat"
$sdb = Join-Path $TizenStudio "tools\sdb.exe"
if (-not (Test-Path $tizen)) { throw "Не найден Tizen CLI: $tizen (укажи -TizenStudio или TIZEN_STUDIO)" }

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist-tizen"
if (-not (Test-Path (Join-Path $dist "config.xml"))) { throw "Сначала npm run build:tizen" }

Get-ChildItem $dist -Filter *.wgt | Remove-Item -Force
& $tizen package -t wgt -s $Profile -- $dist
if ($LASTEXITCODE -ne 0) { throw "tizen package завершился с ошибкой" }
$wgt = Get-ChildItem $dist -Filter *.wgt | Select-Object -First 1
Write-Host "Готово: $($wgt.FullName)"

if ($TvIp) {
  & $sdb connect $TvIp
  $serial = "${TvIp}:26101"
  & $tizen install -n $wgt.Name -s $serial -- $dist
  if ($LASTEXITCODE -ne 0) { throw "tizen install завершился с ошибкой" }
  & $tizen run -p "MiraiPlay1.MiraiPlay" -s $serial
}
