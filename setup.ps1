# Full-stack setup: venv + requirements, .env files, database + seed, npm install.
# Usage: .\setup.ps1 [-SkipDatabase]   (or run setup.cmd). Safe to re-run.
param([switch]$SkipDatabase)

Set-Location $PSScriptRoot

function Step([string]$n, [string]$text) { Write-Host "[$n/5] $text" -ForegroundColor Cyan }
function Fail([string]$text) { Write-Host "[ERROR] $text" -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '=================================================='
Write-Host ' BrightLoop Subscription ERP - full-stack setup'
Write-Host '=================================================='
Write-Host ''

# 1. Prerequisites
Step 1 'Checking prerequisites...'
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) { Fail 'Python 3.11+ was not found on PATH. Install it from https://www.python.org/downloads/' }
& $python.Source -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if ($LASTEXITCODE -ne 0) { Fail 'Python 3.11 or newer is required.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js 22 LTS was not found on PATH. Install it from https://nodejs.org' }
Write-Host ("      {0}   Node {1}" -f (& $python.Source --version), (node -v))

# 2. Python virtual environment
Step 2 'Creating the virtual environment (venv) and installing requirements.txt...'
$venvPython = Join-Path $PSScriptRoot 'venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
  & $python.Source -m venv venv
  if ($LASTEXITCODE -ne 0) { Fail 'Could not create the venv.' }
}
& $venvPython -m pip install --upgrade pip --quiet --disable-pip-version-check
& $venvPython -m pip install -r requirements.txt --quiet --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { Fail 'pip install -r requirements.txt failed.' }

# 3. Environment files
Step 3 'Preparing .env files...'
if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  # Replace the JWT secret placeholder with a fresh random value.
  & $venvPython -c "import pathlib, secrets; p = pathlib.Path('.env'); p.write_text(p.read_text(encoding='utf-8').replace('replace-with-a-64-character-random-hex-string', secrets.token_hex(32)), encoding='utf-8')"
  Write-Host '      Created .env from .env.example (random JWT_SECRET_KEY generated).'
} else {
  Write-Host '      .env already exists - keeping it.'
}
if (-not (Test-Path 'frontend\.env')) {
  Copy-Item 'frontend\.env.example' 'frontend\.env'
  Write-Host '      Created frontend\.env from frontend\.env.example.'
} else {
  Write-Host '      frontend\.env already exists - keeping it.'
}
$needsPassword = Select-String -Path '.env' -Pattern 'YOUR_POSTGRES_PASSWORD' -Quiet

# 4. Database
if ($SkipDatabase) {
  Step 4 'Skipping the database step (-SkipDatabase).'
} elseif ($needsPassword) {
  Step 4 'Skipping the database step: set your PostgreSQL password first.'
  Write-Host '      Open .env, replace YOUR_POSTGRES_PASSWORD in DATABASE_URL, then run this script again.' -ForegroundColor Yellow
} else {
  Step 4 'Creating the PostgreSQL database and tables, then seeding demo data...'
  & $venvPython scripts\init_db.py
  if ($LASTEXITCODE -ne 0) { Fail 'Database initialisation failed. Is PostgreSQL running and is DATABASE_URL in .env correct?' }
  & $venvPython -m backend.seed
  if ($LASTEXITCODE -ne 0) { Fail 'Seeding demo data failed.' }
}

# 5. Frontend dependencies
Step 5 'Installing frontend dependencies (npm install)...'
Push-Location frontend
npm install --no-audit --no-fund
$npmExit = $LASTEXITCODE
Pop-Location
if ($npmExit -ne 0) { Fail 'npm install failed. Check your network/proxy and try again.' }

Write-Host ''
Write-Host 'Setup complete. Start the app in two terminals from the repository root:' -ForegroundColor Green
Write-Host '  Backend : venv\Scripts\python -m uvicorn backend.main:app --reload --port 8000'
Write-Host '            API http://127.0.0.1:8000   Swagger http://127.0.0.1:8000/docs'
Write-Host '  Frontend: cd frontend; npm run dev'
Write-Host '            App http://localhost:5173'
Write-Host ''
Write-Host 'Demo logins (password Brightloop@123):'
Write-Host '  admin@brightloop.local | staff@brightloop.local | customer@brightloop.local'
if ($needsPassword -and -not $SkipDatabase) {
  Write-Host ''
  Write-Host 'Reminder: set your PostgreSQL password in .env and re-run setup to create the database.' -ForegroundColor Yellow
}
