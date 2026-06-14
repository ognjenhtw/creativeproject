@echo off
REM Double-click this file. It will install everything the first time, then start the app.

cd /d "%~dp0app"

REM Check Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Opening the download page now. Install the LTS version, then double-click this file again.
  echo.
  start "" "https://nodejs.org/en/download/"
  pause
  exit /b 1
)

REM Install dependencies on first run
if not exist "node_modules" (
  echo.
  echo First-time setup. Installing dependencies (1-2 minutes)...
  echo.
  call npm install
)

echo.
echo Starting DeeBee...
echo.
call npm start
pause
