@echo off
echo ========================================
echo  Qlik Model Builder - Automated E2E Tests
echo ========================================
echo.

REM Create test-results directory
if not exist "test-results" mkdir test-results

echo [1/4] Building Docker image...
docker-compose build --no-cache
if %ERRORLEVEL% neq 0 (
    echo ERROR: Docker build failed
    exit /b 1
)

echo.
echo [2/4] Starting VS Code Server...
docker-compose up -d vscode-test
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to start VS Code Server
    exit /b 1
)

echo Waiting for VS Code Server to be ready...
timeout /t 15 /nobreak > nul

echo.
echo [3/4] Running Playwright tests...
docker-compose run --rm playwright
set TEST_RESULT=%ERRORLEVEL%

echo.
echo [4/4] Cleaning up...
docker-compose down

echo.
echo ========================================
if %TEST_RESULT% equ 0 (
    echo  ALL TESTS PASSED!
) else (
    echo  TESTS FAILED - Check test-results/
)
echo ========================================
echo.
echo Test results: test-results\html\index.html

exit /b %TEST_RESULT%
