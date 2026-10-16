@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 is required. Please ask your assistant to set it up.
  pause
  exit /b 1
)
if not exist "node_modules\tsx\dist\cli.mjs" (
  echo Dependencies have not been installed. Ask your assistant to finish setup.
  pause
  exit /b 1
)
node scripts/launch.mjs
if errorlevel 1 pause
