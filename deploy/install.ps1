# Supun Construction — install or update on Windows (needs Docker Desktop).
#
#   Open PowerShell and run:
#   irm https://raw.githubusercontent.com/chalakajaniththa/supun-construction/main/deploy/install.ps1 | iex
#
# It creates the folder %USERPROFILE%\supun-construction (or $env:SC_DIR), downloads the
# docker-compose.yml, creates .env with fresh random secrets on the first run (and asks whether to
# load the sample data), pulls the images and starts everything. Running it again updates the
# system to the newest version and keeps all data.
$ErrorActionPreference = 'Stop'

$RepoRaw = if ($env:SC_REPO_RAW) { $env:SC_REPO_RAW } else { 'https://raw.githubusercontent.com/chalakajaniththa/supun-construction/main' }
$Dir = if ($env:SC_DIR) { $env:SC_DIR } else { Join-Path $env:USERPROFILE 'supun-construction' }

function Say($text) { Write-Host "`n$text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }
function New-Secret {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
}

Say 'Supun Construction - install / update'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail 'Docker is not installed. Install Docker Desktop first (see docs/INSTALL.md), then run this again.'
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail '"docker compose" is missing. Install or update Docker Desktop.' }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker is not running. Open Docker Desktop, wait until it says "Engine running", and try again.' }

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
Set-Location $Dir
Write-Host "  Folder: $Dir"

Say 'Downloading the newest setup file...'
try {
  Invoke-WebRequest -UseBasicParsing -Uri "$RepoRaw/deploy/docker-compose.yml" -OutFile 'docker-compose.yml'
} catch { Fail 'Could not download docker-compose.yml. Check the internet connection.' }

$First = $false
if (-not (Test-Path '.env')) {
  $First = $true
  Say 'First installation'
  $answer = Read-Host '  Load the SAMPLE data (a made-up company) to practise first? [Y/n]'
  $Seed = if ($answer -match '^[nN]') { 'false' } else { 'true' }
  $BackupPassword = New-Secret
  $today = Get-Date -Format 'yyyy-MM-dd'
  $env_text = @"
# Supun Construction - settings for docker compose (created by install.ps1 on $today).
# Keep this file safe: it holds the passwords of this installation.

# Image version (latest, or a release like 1.2.0)
SC_VERSION=latest

# First login (change the password in Settings -> Password after logging in)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Web: http://localhost:3000. WEB_BIND=0.0.0.0 lets phones on the same Wi-Fi open it.
WEB_PORT=3000
WEB_BIND=127.0.0.1
COOKIE_SECURE=false

# Database, file storage and login cookie (random)
POSTGRES_USER=supun
POSTGRES_DB=supun
POSTGRES_PASSWORD=$(New-Secret)
JWT_SECRET=$(New-Secret)
S3_ACCESS_KEY=$(New-Secret)
S3_SECRET_KEY=$(New-Secret)
S3_BUCKET=supun-docs

# BACKUP PASSWORD - write it on paper! Without it no backup can ever be restored.
RESTIC_PASSWORD=$BackupPassword
BACKUP_SCHEDULE=0 23 * * *
GDRIVE_FOLDER=SupunConstructionBackup
GDRIVE_CLIENT_ID=
GDRIVE_CLIENT_SECRET=

# true = load the sample data on the first start (Settings -> Reset data can remove it later)
SEED_SAMPLE_DATA=$Seed
"@
  # UTF-8 without BOM and with LF line ends, so docker compose reads the first line correctly.
  [System.IO.File]::WriteAllText((Join-Path $Dir '.env'), ($env_text -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))

  Write-Host ''
  Write-Host '  YOUR BACKUP PASSWORD - WRITE IT DOWN ON PAPER AND KEEP IT SAFE:' -ForegroundColor Yellow
  Write-Host "  $BackupPassword" -ForegroundColor Yellow
  Write-Host "  (it is also in $Dir\.env)" -ForegroundColor Yellow
  Read-Host '  Press Enter when you have written it down' | Out-Null
}

Say 'Downloading the system (the first time this takes a few minutes)...'
docker compose pull
if ($LASTEXITCODE -ne 0) { Fail 'Could not download the images. Check the internet connection.' }

Say 'Starting...'
docker compose up -d --wait --remove-orphans
if ($LASTEXITCODE -ne 0) { Fail 'The system did not start. See: docker compose logs' }

$port = (Select-String -Path '.env' -Pattern '^WEB_PORT=(.*)$').Matches[0].Groups[1].Value
if (-not $port) { $port = '3000' }
$url = "http://localhost:$port"
Say "Supun Construction is running: $url"
if ($First) { Write-Host '  Log in with:  admin  /  admin123   - then change the password (Settings -> Password).' }
Write-Host "  Stop:    cd `"$Dir`"; docker compose stop"
Write-Host "  Start:   cd `"$Dir`"; docker compose up -d"
Write-Host '  Update:  run this install command again.'
Start-Process $url
