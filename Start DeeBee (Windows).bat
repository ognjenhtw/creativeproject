@echo off
title DeeBee
cd /d "%~dp0app"
if errorlevel 1 goto :missing_folder

where node >nul 2>nul
if errorlevel 1 goto :no_node

if not exist "node_modules" goto :first_install
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
echo Electron binary is missing - repairing the install...
echo.
if exist "node_modules\electron" rmdir /s /q "node_modules\electron"
call npm install electron@33.2.0 --no-save
if exist "node_modules\electron\dist\electron.exe" goto :launch

echo.
echo npm couldn't download Electron (commonly due to antivirus). Trying direct download (~90 MB)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { Invoke-WebRequest -Uri 'https://github.com/electron/electron/releases/download/v33.2.0/electron-v33.2.0-win32-x64.zip' -OutFile 'electron-binary.zip' -UseBasicParsing; Expand-Archive -Path 'electron-binary.zip' -DestinationPath '.\node_modules\electron\dist' -Force; 'electron.exe' | Out-File -FilePath '.\node_modules\electron\path.txt' -Encoding ASCII -NoNewline; Remove-Item 'electron-binary.zip' -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 goto :electron_repair_failed
if not exist "node_modules\electron\dist\electron.exe" goto :electron_repair_failed
echo Repaired successfully.
echo.

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
echo Could not download the Electron binary, even directly from GitHub.
echo This means either:
echo   1) No internet connection
echo   2) Antivirus is blocking the download (try disabling real-time protection)
echo   3) A firewall or proxy is blocking github.com
echo.
echo Once you fix the connection, double-click this launcher again.
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
