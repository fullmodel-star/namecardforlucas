@echo off
title Business Card System - Local Server
echo Checking local environment...
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Python detected. Starting local server...
    echo [INFO] Please open this URL in your browser: http://localhost:8000
    echo.
    echo Press Ctrl+C to stop the server.
    start http://localhost:8000
    python -m http.server 8000
    goto end
)

:: Check if Node.js (npx) is installed
npx --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Node.js detected. Starting local server...
    echo [INFO] Please open this URL in your browser: http://localhost:8000
    echo.
    echo Press Ctrl+C to stop the server.
    start http://localhost:8000
    npx http-server -p 8000
    goto end
)

echo [ERROR] Python or Node.js (npx) was not found on your system.
echo.
echo [TIPS] You can still double-click "index.html" to run the system,
echo        but Google Drive sync will NOT work due to browser security policies.
echo.
echo Please install Python (https://www.python.org/) to enable full features.
echo.
pause

:end
