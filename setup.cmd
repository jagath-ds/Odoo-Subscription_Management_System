@echo off
rem BrightLoop Subscription ERP - Windows launcher for setup.ps1.
rem Double-click this file or run it from CMD in the repository root.
rem Options are passed through, e.g.:  setup.cmd -SkipDatabase
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%
