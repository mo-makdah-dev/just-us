@echo off
setlocal
cd /d "%~dp0"
echo Connect Just Us to your own accounts. Approve each sign-in in your browser.
call npm run cloud -- login
if errorlevel 1 (
  echo Sign-in did not finish. Return to the assistant with the provider name and error.
  pause
  exit /b 1
)
echo.
echo Return to the assistant after authorizing your accounts. No paid resources were selected.
pause
