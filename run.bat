@echo off
setlocal
cd /d "%~dp0"

if /i "%~1"=="--status" goto status
if /i "%~1"=="--stop" goto stop
if /i "%~1"=="--help" goto help
if /i "%~1"=="--open" goto launch-open
if /i "%~1"=="--background" goto launch-background
if /i "%~1"=="--start" goto launch
if /i "%~1"=="--foreground" goto launch
if /i "%~1"=="--headless" goto launch

:launch
node "%~dp0scripts\run-headless.cjs" --foreground --no-open
exit /b %ERRORLEVEL%

:launch-background
if not exist "%~dp0run-hidden.vbs" (
  echo Could not find run-hidden.vbs.
  exit /b 1
)
wscript.exe //B //NoLogo "%~dp0run-hidden.vbs" --no-open
exit /b %ERRORLEVEL%

:launch-open
node "%~dp0scripts\run-headless.cjs" --start --open --foreground
exit /b %ERRORLEVEL%

:status
node "%~dp0scripts\run-headless.cjs" --status
exit /b %ERRORLEVEL%

:stop
node "%~dp0scripts\run-headless.cjs" --stop
exit /b %ERRORLEVEL%

:help
echo FreeModel Lab local launcher
echo   run.bat          Start headless in this CMD and show build/server logs and port
echo   run.bat --headless  Same as run.bat
echo   run.bat --background  Start headless in the background
echo   run.bat --open   Open or reopen the dashboard explicitly
echo   run.bat --status Show local host, port, and running state
echo   run.bat --stop   Stop the background server
echo   run-hidden.vbs   Start without even the brief batch window
exit /b 0
