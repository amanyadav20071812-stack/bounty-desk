@echo off
setlocal
cd /d "%~dp0"

set "GIT_EXE=C:\Users\aruny\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
if not exist "%GIT_EXE%" (
  set "GIT_EXE=git"
)

echo ===================================================
echo     Pushing BountyDesk to GitHub
echo     Remote: https://github.com/amanyadav20071812-stack/bounty-desk.git
echo ===================================================
echo.

"%GIT_EXE%" push -u origin main
echo.
pause
