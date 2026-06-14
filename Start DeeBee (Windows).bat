@echo off
title DeeBee
cd /d "%~dp0app"
if errorlevel 1 goto :missing_folder

where node >nul 2>nul
if errorlevel 1 goto :no_node

if not exist "node_modules" goto :first_install
goto :launch

:first_install
echo.
echo First-time setup. Installing dependencies (1-2 minutes)...
echo.
call npm install
if errorlevel 1 goto :npm_error

:launch
echo.
echo Starting DeeBee...
echo.
call npm start
if errorlevel 1 goto :npm_error
goto :end

:no_node
echo.
echo Node.js is not installed, or Windows hasn't picked it up yet.
echo.
echo 1) If you JUST installed Node.js, RESTART your computer and try again.
echo 2) If you haven't installed Node.js, the download page is opening now.
echo    Install the LTS version, restart, then double-click this file again.
echo.
start "" "https://nodejs.org/en/download/"
pause
exit /b 1

:missing_folder
echo.
echo Could not find the "app" folder next to this launcher.
echo Make sure you fully unzipped DeeBee before running this.
echo.
pause
exit /b 1

:npm_error
echo.
echo Something went wrong starting DeeBee. See the messages above.
echo.
pause
exit /b 1

:end
pause
