# Starts JARVIS for testing: backend, a pairing QR, and the app on your phone.
# Run from C:\Jarvis:  powershell -ExecutionPolicy Bypass -File scripts\start-jarvis.ps1
#   -NoPair   skip the QR (phone already paired)
#   -NoApp    don't build/run the app
param([switch]$NoPair, [switch]$NoApp)
$root = 'C:\Jarvis'

function Open-Window([string]$title, [string]$dir, [string]$cmd) {
    Start-Process powershell -WorkingDirectory $dir -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle='$title'; $cmd"
}

Open-Window 'JARVIS backend' "$root\backend" 'npm start'
Start-Sleep -Seconds 3
if (-not $NoPair) { Open-Window 'JARVIS pairing QR' "$root\backend" 'npm run pair' }
if (-not $NoApp)  { Open-Window 'JARVIS app (phone)' "$root\app" 'flutter run' }

Write-Host 'Opened: backend, pairing QR, and app build windows.' -ForegroundColor Green
Write-Host 'On the phone: allow camera, scan the QR (valid 5 minutes), then chat.'
