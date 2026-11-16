# Step 1.4: add voice packages, check the code, run tests, install on the phone (USB).
# Run from C:\Jarvis:  powershell -ExecutionPolicy Bypass -File scripts\update-app-1.4.ps1
$ErrorActionPreference = 'Continue'
Set-Location C:\Jarvis\app
flutter pub add record audioplayers flutter_tts path_provider
if ($LASTEXITCODE -ne 0) { Write-Host 'flutter pub add failed' -ForegroundColor Red; exit 1 }
Write-Host "`n=== flutter analyze ===" -ForegroundColor Cyan
flutter analyze
Write-Host "`n=== flutter test ===" -ForegroundColor Cyan
flutter test
Write-Host "`nIf analyze shows no 'error' lines and tests passed, plug in the phone and run:  flutter run" -ForegroundColor Green
