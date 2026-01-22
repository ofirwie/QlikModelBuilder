# Docker E2E Test Runner for QlikModelBuilder

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "QMB Docker E2E Test Runner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$projectDir = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $projectDir "test-results\docker-e2e-$timestamp.log"

# Ensure test-results directory exists
$resultsDir = Join-Path $projectDir "test-results"
if (!(Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null
}

function Log($message) {
    $ts = Get-Date -Format "HH:mm:ss"
    $line = "[$ts] $message"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

Log "Starting Docker E2E tests..."
Log "Project dir: $projectDir"
Log "Log file: $logFile"

# Change to project directory
Push-Location $projectDir

try {
    # Step 1: Check Docker
    Log "Step 1: Checking Docker..."
    $dockerVersion = docker info --format "{{.ServerVersion}}" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: Docker not running!"
        exit 1
    }
    Log "Docker version: $dockerVersion"

    # Step 2: Build Docker image
    Log "Step 2: Building Docker image..."
    docker-compose build vscode-test 2>&1 | ForEach-Object { Log $_ }
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: Docker build failed!"
        exit 1
    }
    Log "Docker image built successfully"

    # Step 3: Start VS Code server
    Log "Step 3: Starting VS Code server..."
    docker-compose up -d vscode-test 2>&1 | ForEach-Object { Log $_ }

    # Step 4: Wait for healthy
    Log "Step 4: Waiting for VS Code server to be healthy..."
    $attempts = 0
    $maxAttempts = 30
    while ($attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 2
        $health = docker inspect --format "{{.State.Health.Status}}" (docker-compose ps -q vscode-test) 2>&1
        Log "Health check attempt $($attempts + 1): $health"
        if ($health -eq "healthy") {
            Log "VS Code server is healthy!"
            break
        }
        $attempts++
    }

    if ($attempts -eq $maxAttempts) {
        Log "ERROR: VS Code server failed to become healthy!"
        docker-compose logs vscode-test 2>&1 | ForEach-Object { Log $_ }
        docker-compose down
        exit 1
    }

    # Step 5: Run Playwright tests
    Log "Step 5: Running Playwright GUI tests..."
    docker-compose run --rm playwright 2>&1 | ForEach-Object { Log $_ }
    $testResult = $LASTEXITCODE
    Log "Playwright tests exit code: $testResult"

    # Step 6: Collect screenshots
    Log "Step 6: Collecting results..."
    $screenshots = Get-ChildItem -Path "$resultsDir\*.png" -ErrorAction SilentlyContinue
    Log "Screenshots found: $($screenshots.Count)"

    # Step 7: Stop containers
    Log "Step 7: Stopping containers..."
    docker-compose down 2>&1 | ForEach-Object { Log $_ }

    # Summary
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Test Results" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Log file: $logFile"
    Write-Host "Screenshots: $($screenshots.Count) found"

    if ($testResult -eq 0) {
        Write-Host "[PASS] All Docker E2E tests passed!" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Some tests failed. Check log for details." -ForegroundColor Red
    }

    exit $testResult
}
finally {
    Pop-Location
}
