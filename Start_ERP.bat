@echo off
title First Image Studio ERP Server
cd /d "%~dp0"
if not exist "server.js" (
    echo [ERROR] server.js not found in %~dp0
    echo Please place this file inside your First Image Studio ERP folder!
    pause
    exit /b 1
)
echo Starting First Image Studio Backend + DB on http://localhost:4580 ...
start "" http://localhost:4580
node server.js
pause
