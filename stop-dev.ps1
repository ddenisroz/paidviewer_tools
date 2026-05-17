param(
    [switch]$CleanContainers,
    [switch]$PruneImages,
    [switch]$PruneVolumes,
    [switch]$ConfirmVolumes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Get-LogWatcherStatePath {
    return Join-Path $PSScriptRoot "logs\docker\.watchers.json"
}

function Stop-LogWatchers {
    $statePath = Get-LogWatcherStatePath
    if (-not (Test-Path -LiteralPath $statePath)) {
        return
    }

    try {
        $entries = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    } catch {
        Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
        return
    }

    foreach ($entry in @($entries)) {
        if ($null -eq $entry.pid) {
            continue
        }

        try {
            $process = Get-Process -Id ([int]$entry.pid) -ErrorAction Stop
            Stop-Process -Id $process.Id -Force -ErrorAction Stop
        } catch {
        }
    }

    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
}

Write-Host "[STOP] Stopping Paidviewer local Docker stack..." -ForegroundColor Yellow

$envFiles = @(
    "--env-file", "bot_service/.env",
    "--env-file", "deploy/docker/compose.local.env"
)

$composeFiles = @(
    "-f", "deploy/docker/docker-compose.prod.yml",
    "-f", "deploy/docker/docker-compose.local.yml"
)

$profileArgs = @(
    "--profile", "core",
    "--profile", "cloud-tts-fake",
    "--profile", "cloud-tts-real"
)

$composeArgs = $envFiles + $composeFiles + $profileArgs

if (-not (Test-Path "bot_service/.env")) {
    Write-Host "[ERROR] Missing bot_service/.env. Run from paidviewer_tools and keep env files in place." -ForegroundColor Red
    exit 1
}

Stop-LogWatchers
Write-Host "[LOG] Local log watchers stopped" -ForegroundColor Cyan

try {
    docker version | Out-Null
    Write-Host "[OK] Docker is available" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running or not installed" -ForegroundColor Red
    exit 1
}

if ($CleanContainers) {
    Write-Host "[CLEAN] Removing project containers and orphan containers. Volumes are preserved." -ForegroundColor Yellow
    docker compose @composeArgs down --remove-orphans
} else {
    Write-Host "[STOP] Stopping containers only. Volumes and containers are preserved." -ForegroundColor Yellow
    docker compose @composeArgs stop
}

if ($PruneImages) {
    Write-Host "[PRUNE] Removing dangling <none> images." -ForegroundColor Yellow
    docker image prune -f
    Write-Host "[PRUNE] Removing unused Docker build cache." -ForegroundColor Yellow
    docker builder prune -f
}

if ($PruneVolumes) {
    if (-not $ConfirmVolumes) {
        Write-Host "[ERROR] -PruneVolumes can delete local databases and model caches." -ForegroundColor Red
        Write-Host "[ERROR] Re-run with -PruneVolumes -ConfirmVolumes only after backing up important data." -ForegroundColor Red
        exit 1
    }

    Write-Host "[DANGER] Removing unused Docker volumes. This may delete Postgres data and model caches if containers were removed." -ForegroundColor Red
    docker volume prune -f
}

Write-Host ""
Write-Host "[STATUS] Docker disk usage:" -ForegroundColor Cyan
docker system df
