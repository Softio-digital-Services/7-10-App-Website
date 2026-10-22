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

REM 0. Verify Node.js and npm are installed
where node >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js is not found in your system PATH.
  echo Please install Node.js from https://nodejs.org
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] npm is not found in your system PATH.
  echo Please ensure Node.js is properly installed from https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM 0b. Verify Node.js version is at least 18
node -e "if (parseInt(process.versions.node) >= 18) process.exit(0); else process.exit(1);" >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js version 18.18 or newer is required to run this website.
  echo Detected version:
  node -v
  echo Please install an updated LTS version from https://nodejs.org
  echo.
  pause
  exit /b 1
)

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
if not exist "node_modules" (
  echo [Setup] First-time setup detected: Installing npm dependencies...
  echo (This only happens once and may take 1-2 minutes depending on connection)
  call npm install
  if errorlevel 1 (
    echo.
    echo [Error] npm install failed. Make sure you are connected to the internet.
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
  echo [Setup] Database not found. Creating database and running migrations...
  call npx prisma migrate deploy
  if errorlevel 1 (
    echo [Warning] Prisma migrate deploy encountered an issue, trying npm run db:deploy...
    call npm run db:deploy
  )
  echo [Setup] Seeding initial product catalog, categories, and admin account...
  call npm run db:seed
  if errorlevel 1 (
    echo [Warning] Seeding encountered an issue. You can re-run 'npm run db:seed' later.
  )
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
) else (
  echo.
  echo Server has stopped.
  pause
)
