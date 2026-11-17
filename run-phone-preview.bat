@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  copy .env.example .env >nul
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing frontend packages for the first run...
  call npm install
  if errorlevel 1 goto failed
)

call npm run build
if errorlevel 1 goto failed

if exist ".venv\Scripts\python.exe" (
  start "BountyDesk Backend" cmd /k "cd /d ""%~dp0"" && .\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"
)

start "BountyDesk Wi-Fi preview" cmd /k "cd /d ""%~dp0"" && npm run preview -- --host 0.0.0.0 --port 4173 --strictPort"
ping 127.0.0.1 -n 4 >nul
echo.
echo Keep the preview server window open. Connect your phone to this PC's Wi-Fi.
echo Run ipconfig and use the IPv4 address under the active Wi-Fi adapter.
echo On the phone, open: http://YOUR-PC-IP:4173
echo.
pause
exit /b 0

:failed
echo Preview setup failed. Check that Node.js is installed and try again.
pause
exit /b 1
