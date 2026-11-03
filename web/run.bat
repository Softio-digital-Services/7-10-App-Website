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

REM 1b. Replace a missing/placeholder AUTH_SECRET with a random one (the server refuses to start otherwise)
node scripts\ensure-auth-secret.js
if errorlevel 1 (
  echo [Error] Could not set AUTH_SECRET in .env. Set it manually to a random value of 32+ characters.
  pause
  exit /b 1
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

REM 4b. If the server is already running (e.g. another window), just open it instead of failing
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { if ($_.Exception.Response) { exit 0 } else { exit 1 } }" >nul 2>nul
if not errorlevel 1 (
  echo The website server is already running on %URL%. Opening it in the browser...
  start "" "%URL%"
  timeout /t 3 >nul
  exit /b 0
)

REM 4c. Production mode (default) serves prebuilt pages, so every click responds immediately.
REM     Run "run.bat dev" instead for live-reload while editing code (slower: pages compile on demand).
set MODE=%~1
if /i not "%MODE%"=="dev" (
  powershell -NoProfile -Command "$id = Get-Item '.next\BUILD_ID' -ErrorAction SilentlyContinue; if (-not $id) { exit 1 }; $files = @(Get-ChildItem src, public, prisma, scripts -Recurse -File -ErrorAction SilentlyContinue) + @(Get-Item package.json, package-lock.json, next.config.ts, postcss.config.mjs, .env, ..\desktop\appsettings.json -ErrorAction SilentlyContinue); $newest = $files | Where-Object { $_.Name -notmatch '\.db(-journal|-wal|-shm)?$' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($newest -and $newest.LastWriteTime -gt $id.LastWriteTime) { exit 1 }; exit 0" >nul 2>nul
  if errorlevel 1 (
    echo [Build] Code changed since the last build. Building the optimized website...
    echo (This takes about a minute and only happens after changes.)
    call npm run build
    if errorlevel 1 (
      echo.
      echo [Error] Build failed. See the messages above.
      pause
      exit /b 1
    )
  )
)

echo.
echo Starting the website server on %URL%
echo Keep this window open while browsing. Close it to stop the server.
echo.

REM 5. Wait for the server to be ready before opening the browser
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "$url = '%URL%'; $max = 90; while ($max -gt 0) { Start-Sleep -Seconds 1; try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { break } } catch {}; $max-- }; $chrome = @($env:ProgramFiles + '\Google\Chrome\Application\chrome.exe', ${env:ProgramFiles(x86)} + '\Google\Chrome\Application\chrome.exe', $env:LOCALAPPDATA + '\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($chrome) { Start-Process $chrome $url } else { Start-Process $url }"

if /i "%MODE%"=="dev" (
  call npm run dev -- -p %PORT%
) else (
  call npx next start -p %PORT%
)
if errorlevel 1 (
  echo.
  echo [Error] Dev server stopped or encountered an error.
  pause
) else (
  echo.
  echo Server has stopped.
  pause
)
