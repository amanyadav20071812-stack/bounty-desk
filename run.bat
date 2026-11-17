@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo             Starting BountyDesk Demo
echo ===================================================
echo.

if not exist ".env" (
  echo Creating .env from .env.example...
  copy .env.example .env >nul
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 goto failed_node
)

if not exist ".venv\Scripts\python.exe" (
  echo Setting up Python virtual environment...
  py -m venv .venv 2>nul || python -m venv .venv
  if not exist ".venv\Scripts\python.exe" goto failed_py
  echo Installing Python requirements...
  call .\.venv\Scripts\pip install -r backend\requirements.txt
)

echo Starting FastAPI backend on http://127.0.0.1:8000 ...
start "BountyDesk Backend" cmd /k "cd /d ""%~dp0"" && .\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Vite frontend on http://127.0.0.1:5173 ...
start "BountyDesk Frontend" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

ping 127.0.0.1 -n 4 >nul
echo Opening BountyDesk in your browser...
start "" "http://localhost:5173"
exit /b 0

:failed_node
echo.
echo Node.js packages could not be installed. Make sure Node.js is installed.
pause
exit /b 1

:failed_py
echo.
echo Python virtual environment could not be created. Make sure Python 3.11+ is installed.
pause
exit /b 1
