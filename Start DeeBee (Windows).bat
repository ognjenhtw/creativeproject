@echo off
title DeeBee
cd /d "%~dp0app"
if errorlevel 1 goto :missing_folder

where node >nul 2>nul
if errorlevel 1 goto :no_node

if not exist "node_modules" goto :first_install
REM Check that Electron's binary actually downloaded (it's a separate post-install step
REM that can silently fail on flaky networks or with antivirus blocking).
if not exist "node_modules\electron\dist\electron.exe" goto :repair_electron
goto :launch

:first_install
echo.
echo First-time setup. Installing dependencies (1-2 minutes)...
echo.
call npm install
if errorlevel 1 goto :npm_error
if not exist "node_modules\electron\dist\electron.exe" goto :repair_electron
goto :launch

:repair_electron
echo.
echo Electron binary is missing - repairing the install (1 minute)...
echo (This usually means the first download was blocked by antivirus or a flaky network.)
echo.
if exist "node_modules\electron" rmdir /s /q "node_modules\electron"
call npm install electron --no-save
if errorlevel 1 goto :electron_repair_failed
if not exist "node_modules\electron\dist\electron.exe" goto :electron_repair_failed

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

:electron_repair_failed
echo.
echo Electron could not be downloaded.
echo Likely cause: Windows Defender / antivirus is blocking it.
echo.
echo Fix: temporarily disable real-time virus protection,
echo      then double-click this launcher again. You can re-enable after.
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
