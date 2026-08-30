@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  7-10 Inventory - Publish + Setup
echo ============================================
echo.
echo Publishes win-x64 Release to dist\app
echo builds dist\SevenTenInventory.exe (portable app)
echo and dist\SevenTenSetup.exe (Inno Setup).
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\build.ps1"
if errorlevel 1 (
  echo.
  echo ERROR: Publish / setup failed.
  pause
  exit /b 1
)

echo.
echo --------------------------------------------
echo  Done
echo --------------------------------------------
echo  App:   %~dp0dist\SevenTenInventory.exe
echo  Folder:%~dp0dist\app\SevenTenInventorySystem.exe
if exist "%~dp0dist\SevenTenSetup.exe" (
  echo  Setup: %~dp0dist\SevenTenSetup.exe
) else (
  echo  Setup: not created - install Inno Setup, then re-run.
  echo         https://jrsoftware.org/isdl.php
)
echo.
pause
endlocal
