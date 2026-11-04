@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22 or 24 from https://nodejs.org/ then run this file again.
 pause
 exit /b 1
)
if not exist node_modules (
 call npm ci
 if errorlevel 1 (
  echo Dependency installation failed. Check the error above and your internet connection.
  pause
  exit /b 1
 )
)
echo Open http://localhost:3000 after the server is ready.
call npm run dev
pause
