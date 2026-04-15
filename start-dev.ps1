param(
    [switch]$CoreOnly
)

Write-Host "[START] Starting Paidviewer local Docker stack..." -ForegroundColor Green

$envFiles = @(
    "--env-file", "bot_service/.env",
    "--env-file", "deploy/docker/compose.local.env"
)

$composeFiles = @(
    "-f", "deploy/docker/docker-compose.prod.yml",
    "-f", "deploy/docker/docker-compose.local.yml"
)

$profileArgs = @("--profile", "core")
if (-not $CoreOnly) {
    $profileArgs += @("--profile", "cloud-tts")
}

$composeArgs = $envFiles + $composeFiles + $profileArgs

if (-not (Test-Path "bot_service/.env")) {
    Write-Host "[ERROR] Missing bot_service/.env. Copy bot_service/.env.example first." -ForegroundColor Red
    exit 1
}

try {
    docker version | Out-Null
    Write-Host "[OK] Docker is available" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running or not installed" -ForegroundColor Red
    exit 1
}

Write-Host "[STOP] Stopping existing containers..." -ForegroundColor Yellow
docker compose @composeArgs down --remove-orphans

Write-Host "[BUILD] Building and starting containers..." -ForegroundColor Yellow
docker compose @composeArgs up --build -d

Write-Host "[WAIT] Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "[STATUS] Services status:" -ForegroundColor Cyan
docker compose @composeArgs ps

Write-Host ""
Write-Host "[OK] Local stack started" -ForegroundColor Green
Write-Host "[WEB] Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "[API] Bot API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "[AUTH] Local OAuth callbacks must use http://localhost/... only" -ForegroundColor Cyan

if (-not $CoreOnly) {
    Write-Host "[TTS] Gateway: http://localhost:8010" -ForegroundColor Cyan
    Write-Host "[TTS] F5 runtime: http://localhost:8011" -ForegroundColor Cyan
    Write-Host "[TTS] Qwen runtime: http://localhost:8012" -ForegroundColor Cyan
} else {
    Write-Host "[INFO] Started core profile only. Re-run without -CoreOnly to include cloud TTS." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[LOG] Logs: docker compose $($composeArgs -join ' ') logs -f" -ForegroundColor Yellow
Write-Host "[STOP] Stop: docker compose $($envFiles -join ' ') $($composeFiles -join ' ') down --remove-orphans" -ForegroundColor Yellow
