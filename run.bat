@echo off
setlocal
cd /d "%~dp0web"
call run.bat
if errorlevel 1 (
  echo.
  pause
)
