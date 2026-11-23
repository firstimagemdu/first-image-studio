@echo off
title Install Auto-Start for First Image Studio ERP
set "SCRIPT_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if not exist "%SCRIPT_DIR%server.js" (
    echo [ERROR] server.js not found!
    echo Extract all files from this ZIP directly into your ERP folder (where server.js is located) and run this again.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_DIR%\First_Image_Studio_ERP.lnk'); $s.TargetPath = '%SCRIPT_DIR%Start_ERP.bat'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"

echo.
echo [SUCCESS] Auto-Start shortcut added to Windows Startup folder!
echo Location: %STARTUP_DIR%\First_Image_Studio_ERP.lnk
echo.
pause
