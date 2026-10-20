@echo off
setlocal
cd /d "%~dp0"
title 7.10 Store

set PORT=3000
set URL=http://localhost:%PORT%

echo ===================================================
echo               7.10 Store Website Server
echo ===================================================
echo.

REM 1. Ensure .env exists
if not exist ".env" (
  if exist ".env.example" (
    echo [Setup] Creating .env file from .env.example...
    copy ".env.example" ".env" >nul
  ) else (
    echo [Setup] Creating default .env file...
    (
      echo DATABASE_URL="file:./dev.db"
      echo AUTH_SECRET="TovQpH3ls4YF+Ti4WCSzKKqqPb3iKM/yQg1AA4UDkJ2Kw/lfadDl7ePmCFhkD1gF"
      echo AUTH_URL="http://localhost:3000"
      echo AUTH_TRUST_HOST="true"
      echo STORE_MODE="live"
    ) > ".env"
  )
)

REM 2. Ensure node_modules dependencies are installed
if not exist "node_modules\" (
  echo [Setup] Installing npm packages (first run)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [Error] npm install failed. Make sure Node.js is installed.
    pause
    exit /b 1
  )
)

REM 3. Ensure Prisma Client is generated
if not exist "node_modules\.prisma\client\index.js" (
  echo [Setup] Generating Prisma Client...
  call npx prisma generate
  if errorlevel 1 (
    echo [Warning] Prisma generate returned an error, attempting to continue...
  )
)

REM 4. Ensure local database is migrated and seeded if missing
if not exist "prisma\dev.db" (
  echo [Setup] Local database not found. Creating database and running migrations...
  call npx prisma migrate deploy
  echo [Setup] Seeding initial product catalog and demo data...
  call npm run db:seed
)

echo.
echo Starting the website server on %URL%
echo Keep this window open while browsing. Close it to stop the server.
echo.

REM 5. Wait for the server to be ready before opening the browser
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "$url = '%URL%'; $max = 35; while ($max -gt 0) { Start-Sleep -Seconds 1; try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { break } } catch {}; $max-- }; $chrome = @($env:ProgramFiles + '\Google\Chrome\Application\chrome.exe', ${env:ProgramFiles(x86)} + '\Google\Chrome\Application\chrome.exe', $env:LOCALAPPDATA + '\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($chrome) { Start-Process $chrome $url } else { Start-Process $url }"

call npm run dev -- -p %PORT%
if errorlevel 1 (
  echo.
  echo [Error] Dev server stopped or encountered an error.
  pause
)
