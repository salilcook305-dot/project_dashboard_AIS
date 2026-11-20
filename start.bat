@echo off
title Project Dashboard Platform
color 0b
echo ===============================================================================
echo                           PROJECT DASHBOARD
echo ===============================================================================
echo  Backend: Django Web Architecture & REST API
echo  Frontend: React SPA
echo  Database: SQLite / PostgreSQL Ready
echo ===============================================================================
echo.

cd /d "%~dp0"

:: -------------------------------------------------------------------------
:: 1. Detect and Verify Python Executable
:: -------------------------------------------------------------------------
set "PY_EXE="

if exist "C:\Users\kiran\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
    set "PY_EXE=C:\Users\kiran\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
) else if exist "%~dp0venv\Scripts\python.exe" (
    set "PY_EXE=%~dp0venv\Scripts\python.exe"
) else if exist "%~dp0.venv\Scripts\python.exe" (
    set "PY_EXE=%~dp0.venv\Scripts\python.exe"
) else if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PY_EXE=%~dp0backend\venv\Scripts\python.exe"
) else (
    set "PY_EXE=python"
)

:: Verify Django is available with the detected Python
"%PY_EXE%" -c "import django" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Django is not found in %PY_EXE%. Trying system python...
    python -c "import django" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        set "PY_EXE=python"
    ) else (
        echo [ERROR] Python with Django installed was not found!
        echo Please ensure requirements are installed: pip install -r requirements.txt
        pause
        exit /b 1
    )
)

echo [OK] Using Python: %PY_EXE%
echo.

:: -------------------------------------------------------------------------
:: 2. Check and Apply Database Migrations
:: -------------------------------------------------------------------------
echo [INFO] Checking and applying database migrations...
"%PY_EXE%" backend\manage.py migrate --noinput
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Migration failed. Please check database settings in .env.
    pause
    exit /b 1
)
echo [OK] Database is up to date.
echo.

:: -------------------------------------------------------------------------
:: 2.1. Ensure the initial Administrator account exists
:: -------------------------------------------------------------------------
echo [INFO] Ensuring the initial Administrator account exists...
"%PY_EXE%" backend\manage.py init_admin
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Administrator initialization failed.
    pause
    exit /b 1
)
echo.

:: -------------------------------------------------------------------------
:: 3. Launch Server & Open Browser
:: -------------------------------------------------------------------------
set "PORT=8000"
set "URL=http://127.0.0.1:%PORT%/"

echo ===============================================================================
echo  LOGIN DETAILS:
echo   - Default Administrator:  admin  /  Password123!
echo   - Team Members:           See team_credentials.csv
echo.
echo  LIVE ACCESS:
echo   - Web Dashboard:          %URL%
echo   - Login Page:             %URL%login
echo ===============================================================================
echo.
echo Starting server on %URL% (Press Ctrl+C to stop)...
echo.

:: Open browser automatically after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start %URL%"

:: Run Django server
"%PY_EXE%" backend\manage.py runserver 0.0.0.0:%PORT%

pause
