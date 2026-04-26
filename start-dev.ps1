param(
    [switch]$CoreOnly,
    [switch]$WithCloudTtsFake,
    [switch]$WithCloudTtsReal
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

if ($WithCloudTtsFake -and $WithCloudTtsReal) {
    Write-Host "[ERROR] Use only one TTS profile: -WithCloudTtsFake or -WithCloudTtsReal." -ForegroundColor Red
    exit 1
}

if ($CoreOnly -and ($WithCloudTtsFake -or $WithCloudTtsReal)) {
    Write-Host "[ERROR] -CoreOnly cannot be combined with TTS profile flags." -ForegroundColor Red
    exit 1
}

if ($WithCloudTtsFake) {
    $profileArgs += @("--profile", "cloud-tts-fake")
}

if ($WithCloudTtsReal) {
    $profileArgs += @("--profile", "cloud-tts-real")
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

Write-Host "[PROFILE] Active Docker profiles: $($profileArgs -join ' ')" -ForegroundColor Cyan
if (-not $WithCloudTtsFake -and -not $WithCloudTtsReal) {
    Write-Host "[INFO] Default start is core-only: postgres, redis, bot_service, frontend." -ForegroundColor Cyan
    Write-Host "[INFO] Add -WithCloudTtsFake for gateway-only TTS smoke or -WithCloudTtsReal for heavy GPU runtimes." -ForegroundColor Yellow
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

if ($WithCloudTtsFake) {
    Write-Host "[TTS] Gateway: http://localhost:8010" -ForegroundColor Cyan
    Write-Host "[INFO] Fake/light TTS profile does not start F5 or Qwen model runtimes." -ForegroundColor Yellow
} elseif ($WithCloudTtsReal) {
    Write-Host "[TTS] Gateway: http://localhost:8010" -ForegroundColor Cyan
    Write-Host "[TTS] F5 runtime: http://localhost:8011" -ForegroundColor Cyan
    Write-Host "[TTS] Qwen runtime: http://localhost:8012" -ForegroundColor Cyan
} else {
    Write-Host "[INFO] Started core profile only. Re-run with -WithCloudTtsFake or -WithCloudTtsReal to include TTS." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[LOG] Logs: docker compose $($composeArgs -join ' ') logs -f" -ForegroundColor Yellow
Write-Host "[STOP] Stop: .\stop-dev.ps1" -ForegroundColor Yellow
