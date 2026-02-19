# Script to run development Docker stack
Write-Host "[START] Starting TTS system in development mode..." -ForegroundColor Green

$composeFile = "deploy/docker/docker-compose.dev.yml"

# Check Docker availability
try {
    docker version | Out-Null
    Write-Host "[OK] Docker is available" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running or not installed" -ForegroundColor Red
    exit 1
}

# Stop existing containers
Write-Host "[STOP] Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f $composeFile down

# Build and start containers
Write-Host "[BUILD] Building and starting containers..." -ForegroundColor Yellow
docker-compose -f $composeFile up --build -d

# Wait for startup
Write-Host "[WAIT] Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Show status
Write-Host "[STATUS] Services status:" -ForegroundColor Cyan
docker-compose -f $composeFile ps

Write-Host ""
Write-Host "[OK] System started" -ForegroundColor Green
Write-Host "[WEB] Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "[API] Bot API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "[TTS] TTS API: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
Write-Host "[LOG] Logs: docker-compose -f $composeFile logs -f" -ForegroundColor Yellow
Write-Host "[STOP] Stop: docker-compose -f $composeFile down" -ForegroundColor Yellow
