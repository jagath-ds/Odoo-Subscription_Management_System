@echo off
setlocal
title Brightloop - setup
cd /d "%~dp0frontend"

echo.
echo ============================================
echo  Brightloop Subscription Management - setup
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install Node.js 22 LTS from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [1/4] Node.js %NODE_VERSION% detected.

if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [2/4] Created frontend\.env from .env.example
  ) else (
    echo [2/4] No .env.example found - skipping .env
  )
) else (
  echo [2/4] frontend\.env already exists - keeping it.
)

if exist "package-lock.json" (
  echo [3/4] Installing dependencies with npm ci...
  call npm ci
) else (
  echo [3/4] Installing dependencies with npm install...
  call npm install
)

if errorlevel 1 (
  echo.
  echo [ERROR] Dependency installation failed. Check your network/proxy and try again.
  echo.
  pause
  exit /b 1
)

echo [4/4] Starting the dev server at http://127.0.0.1:5173 ...
echo       Press Ctrl+C to stop.
echo.
call npm run dev

pause
