@echo off
setlocal
cd /d "%~dp0"
title 7.10 Store

set PORT=3000
set URL=http://localhost:%PORT%

if not exist "node_modules\" (
  echo Installing packages ^(first run^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Make sure Node.js is installed.
    pause
    exit /b 1
  )
)

echo.
echo Starting the website on %URL%
echo Keep this window open while you browse.
echo Close it to stop the site.
echo.

REM Wait a few seconds, then open Chrome (runs in the background)
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; $chrome = @($env:ProgramFiles + '\Google\Chrome\Application\chrome.exe', ${env:ProgramFiles(x86)} + '\Google\Chrome\Application\chrome.exe', $env:LOCALAPPDATA + '\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($chrome) { Start-Process $chrome '%URL%' } else { Start-Process '%URL%' }"

call npm run dev -- -p %PORT%
pause
