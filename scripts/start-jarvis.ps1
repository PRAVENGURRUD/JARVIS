# Starts JARVIS for testing: backend, a pairing QR, and the app on your phone.
# Run from C:\Jarvis:  powershell -ExecutionPolicy Bypass -File scripts\start-jarvis.ps1
#   -NoPair   skip the QR (phone already paired)
#   -NoApp    don't build/run the app
param([switch]$NoPair, [switch]$NoApp)
$root = 'C:\Jarvis'

function Open-Window([string]$title, [string]$dir, [string]$cmd) {
    Start-Process powershell -WorkingDirectory $dir -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle='$title'; $cmd"
}

$opened = @()

# Only one backend can use port 3000. If one is already running, reuse it.
$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host 'Backend is already running on port 3000 - not starting another.' -ForegroundColor Yellow
    Write-Host '(To restart it after a code change: Ctrl+C in the "JARVIS backend" window, then npm start.)'
} else {
    Open-Window 'JARVIS backend' "$root\backend" 'npm start'
    $opened += 'backend'
    Start-Sleep -Seconds 3
}

if (-not $NoPair) { Open-Window 'JARVIS pairing QR' "$root\backend" 'npm run pair'; $opened += 'pairing QR' }
if (-not $NoApp)  { Open-Window 'JARVIS app (phone)' "$root\app" 'flutter run'; $opened += 'app build' }

if ($opened.Count) { Write-Host ("Opened: " + ($opened -join ', ')) -ForegroundColor Green }
if (-not $NoPair) { Write-Host 'On the phone: allow camera, scan the QR (valid 5 minutes), then chat.' }
elseif (-not $NoApp) { Write-Host 'The app opens on your phone when the build finishes - just chat.' }
