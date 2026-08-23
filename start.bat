@echo off
REM ============================================================
REM PoopLog Desktop — Development/Test Launcher
REM This batch file is for local development and testing only.
REM It starts the Tauri desktop app in development mode (Vite + Tauri).
REM It is NOT the production installer.
REM The production Windows installer is built via: npm run build:desktop
REM   -> src-tauri\target\release\bundle\nsis\PoopLog_0.1.0_x64-setup.exe
REM ============================================================

REM Change to project root (handles being double-clicked from Explorer)
cd /d "C:\Projects\PoopLog"
if %errorlevel% neq 0 (
  echo [ERROR] Failed to change directory to C:\Projects\PoopLog
  pause
  exit /b 1
)

echo [PoopLog] Project directory: %CD%
echo.

REM Verify Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found in PATH.
  echo Please install Node.js 20+ and ensure "node" is available.
  pause
  exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [PoopLog] Node %%i

REM Verify npm is available
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] npm not found in PATH.
  echo Please install Node.js 20+ and ensure "npm" is available.
  pause
  exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do echo [PoopLog] npm %%i
echo.

echo [PoopLog] Starting Tauri desktop development server...
echo [PoopLog] Command: npm run dev:desktop
echo [PoopLog] Close the PoopLog window to terminate this process.
echo.

REM Run the Tauri dev server (Vite + Rust). Keep console open while it runs.
REM Using call ensures batch waits for npm to finish and returns correctly.
call npm run dev:desktop
set EXITCODE=%errorlevel%

echo.
if %EXITCODE% neq 0 (
  echo [PoopLog] Tauri dev exited with code %EXITCODE%.
  echo Check the output above for errors.
) else (
  echo [PoopLog] Tauri dev exited cleanly.
)

REM Keep window open briefly if there was an error, otherwise exit
if %EXITCODE% neq 0 pause

exit /b %EXITCODE%
