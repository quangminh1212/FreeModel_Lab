@echo off
setlocal
cd /d "%~dp0"

if /i "%~1"=="--status" goto status
if /i "%~1"=="--stop" goto stop
if /i "%~1"=="--help" goto help
if /i "%~1"=="--open" goto launch
if /i "%~1"=="--start" goto launch

:launch
if not exist "%~dp0run-hidden.vbs" (
  echo Could not find run-hidden.vbs.
  exit /b 1
)
wscript.exe //B //NoLogo "%~dp0run-hidden.vbs"
exit /b %ERRORLEVEL%

:status
node "%~dp0scripts\run-headless.cjs" --status
exit /b %ERRORLEVEL%

:stop
node "%~dp0scripts\run-headless.cjs" --stop
exit /b %ERRORLEVEL%

:help
echo FreeModel Lab local launcher
echo   run.bat          Start the dashboard in the background
echo   run.bat --open   Open or reopen the dashboard
echo   run.bat --status Show its local URL and running state
echo   run.bat --stop   Stop the background server
echo   run-hidden.vbs   Start without even the brief batch window
exit /b 0
