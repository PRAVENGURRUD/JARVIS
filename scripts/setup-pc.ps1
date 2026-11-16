# One-time PC setup for JARVIS: Tailscale tunnel + backend/.env
# Run from C:\Jarvis:  powershell -ExecutionPolicy Bypass -File scripts\setup-pc.ps1
$ErrorActionPreference = 'Continue'   # PS 5.1: 'Stop' turns tailscale's normal stderr output into fatal errors; we check exit codes instead
$root = 'C:\Jarvis'
$envFile = Join-Path $root 'backend\.env'
$ts = 'C:\Program Files\Tailscale\tailscale.exe'

function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

function Set-EnvValue([string]$key, [string]$value) {
    $lines = @()
    if (Test-Path $envFile) { $lines = [IO.File]::ReadAllLines($envFile) }
    $found = $false
    $out = foreach ($l in $lines) {
        if ($l -match "^$key=") { $found = $true; "$key=$value" } else { $l }
    }
    if (-not $found) { $out = @($out) + "$key=$value" }
    [IO.File]::WriteAllLines($envFile, [string[]]$out)   # UTF-8, no BOM
}

# 1. Tailscale on the PC
Step '1/5 Tailscale install'
if (-not (Test-Path $ts)) {
    Write-Host 'Installing Tailscale with winget (Windows may ask "allow changes?" - click Yes)...'
    winget install --id Tailscale.Tailscale -e --accept-package-agreements --accept-source-agreements
    if (-not (Test-Path $ts)) { throw 'Tailscale did not install. Install it from https://tailscale.com/download and run this script again.' }
} else { Write-Host 'Tailscale already installed.' }

# 2. Sign in (opens your browser the first time)
Step '2/5 Tailscale sign-in'
& $ts status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'A browser window will open: sign in with the SAME account you will use on your phone.'
    & $ts up
}
& $ts status *> $null
if ($LASTEXITCODE -ne 0) { throw 'Tailscale is not signed in yet. Sign in, then run this script again.' }
Write-Host 'Signed in.'

# 3. Private HTTPS tunnel: only your own Tailscale devices can reach port 3000
Step '3/5 Tailscale Serve (HTTPS -> 127.0.0.1:3000)'
& $ts serve --bg 3000
if ($LASTEXITCODE -ne 0) {
    throw 'tailscale serve failed. If it printed a link to enable HTTPS, open it, click Enable, then run this script again.'
}
$self = (& $ts status --json | ConvertFrom-Json).Self
$dns = $self.DNSName.TrimEnd('.')
$publicUrl = "https://$dns"
Write-Host "Your private JARVIS address: $publicUrl" -ForegroundColor Green

# 4. backend/.env
Step '4/5 backend\.env'
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $root 'backend\.env.example') $envFile }
Set-EnvValue 'PUBLIC_URL' $publicUrl
$current = (Select-String -Path $envFile -Pattern '^GEMINI_API_KEY=(.+)$' -ErrorAction SilentlyContinue)
if (-not $current) {
    Write-Host 'Paste your Gemini API key from aistudio.google.com (it stays hidden as you paste) and press Enter.'
    Write-Host 'Leave empty to skip for now.'
    $secure = Read-Host 'GEMINI_API_KEY' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if ($key) { Set-EnvValue 'GEMINI_API_KEY' $key; Write-Host 'Key saved to backend\.env (never committed to git).' }
    else { Write-Host 'Skipped. Run this script again later to add it.' -ForegroundColor Yellow }
    $key = $null
} else { Write-Host 'GEMINI_API_KEY already set.' }

# 5. Backend packages
Step '5/5 npm install'
Push-Location (Join-Path $root 'backend'); npm install; Pop-Location

Write-Host "`nDone. Next: install Tailscale on your phone (Play Store), sign in with the same account," -ForegroundColor Green
Write-Host 'then run:  powershell -ExecutionPolicy Bypass -File scripts\start-jarvis.ps1' -ForegroundColor Green
