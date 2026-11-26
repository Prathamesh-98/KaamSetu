$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
function Run-Native {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed: $LASTEXITCODE" }
}
Run-Native "npm.cmd" @("ci")
$env:VITE_API_BASE_URL = "https://kaamsetu-api-staging.onrender.com"
Run-Native "npm.cmd" @("run","build")
if (!(Test-Path "android/gradlew.bat")) { Run-Native "npx.cmd" @("cap","add","android") }
Run-Native "npx.cmd" @("cap","sync","android")
if (Test-Path "resources/android/res") {
    Copy-Item -Path "resources/android/res/*" -Destination "android/app/src/main/res" -Recurse -Force
}
Push-Location android
try { Run-Native ".\gradlew.bat" @("assembleDebug") } finally { Pop-Location }
Write-Host "APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk"
