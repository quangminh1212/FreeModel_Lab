@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto node_missing

node -e "if (Number(process.versions.node.split('.')[0]) < 24) process.exit(1)"
if errorlevel 1 goto node_old

where npm >nul 2>nul
if errorlevel 1 goto npm_missing

echo Setting up FreeModel Lab dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto setup_failed

echo Starting FreeModel Lab with automatic reload...
call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo FreeModel Lab stopped with exit code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%

:node_missing
echo Node.js 24 or newer is required. Install it from https://nodejs.org/ and run this file again.
pause
exit /b 1

:node_old
echo This project requires Node.js 24 or newer. Please update Node.js and run this file again.
pause
exit /b 1

:npm_missing
echo npm is missing. Reinstall Node.js 24 or newer with npm included, then run this file again.
pause
exit /b 1

:setup_failed
echo Dependency setup failed. Check your internet connection and npm output, then try again.
pause
exit /b 1
