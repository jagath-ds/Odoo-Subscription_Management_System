# Brightloop - setup (PowerShell)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'frontend')

Write-Host ''
Write-Host '============================================'
Write-Host ' Brightloop Subscription Management - setup'
Write-Host '============================================'
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] Node.js was not found on PATH.'
  Write-Host '        Install Node.js 22 LTS from https://nodejs.org and run this file again.'
  exit 1
}

Write-Host ("[1/4] Node.js {0} detected." -f (node -v))

if (-not (Test-Path '.env')) {
  if (Test-Path '.env.example') {
    Copy-Item '.env.example' '.env'
    Write-Host '[2/4] Created frontend\.env from .env.example'
  } else {
    Write-Host '[2/4] No .env.example found - skipping .env'
  }
} else {
  Write-Host '[2/4] frontend\.env already exists - keeping it.'
}

if (Test-Path 'package-lock.json') {
  Write-Host '[3/4] Installing dependencies with npm ci...'
  npm ci
} else {
  Write-Host '[3/4] Installing dependencies with npm install...'
  npm install
}

if ($LASTEXITCODE -ne 0) {
  Write-Host '[ERROR] Dependency installation failed. Check your network/proxy and try again.'
  exit 1
}

Write-Host '[4/4] Starting the dev server at http://127.0.0.1:5173 ...'
Write-Host '      Press Ctrl+C to stop.'
npm run dev
