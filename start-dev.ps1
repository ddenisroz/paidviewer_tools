param(
    [switch]$CoreOnly,
    [switch]$WithCloudTtsFake,
    [switch]$WithCloudTtsReal,
    [switch]$Build,
    [switch]$Reset,
    [string[]]$Services,
    [int]$WaitTimeoutSec = 90
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Invoke-NativeOrThrow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$FailureMessage = "Command failed."
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage ExitCode=$LASTEXITCODE"
    }
}

function Get-LogMirrorRoot {
    return Join-Path $PSScriptRoot "logs\docker"
}

function Get-LogWatcherStatePath {
    return Join-Path (Get-LogMirrorRoot) ".watchers.json"
}

function Stop-ExistingLogWatchers {
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

function Start-LogWatchers {
    param(
        [string[]]$ComposeArgs
    )

    $watcherScript = Join-Path $PSScriptRoot "scripts\docker-log-watcher.ps1"
    if (-not (Test-Path -LiteralPath $watcherScript)) {
        Write-Host "[WARN] Log watcher helper not found: $watcherScript" -ForegroundColor Yellow
        return
    }

    $logRoot = Get-LogMirrorRoot
    if (-not (Test-Path -LiteralPath $logRoot)) {
        New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    }

    Stop-ExistingLogWatchers

    $services = @(
        docker compose @ComposeArgs ps --services --status running |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($services.Count -eq 0) {
        Write-Host "[WARN] No running services found for log mirroring" -ForegroundColor Yellow
        return
    }

    $composeArgsJson = ConvertTo-Json -Compress -InputObject @($ComposeArgs)
    $composeArgsBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($composeArgsJson))
    $state = New-Object System.Collections.Generic.List[object]

    foreach ($service in $services) {
        $trimmedService = $service.Trim()
        $logFile = Join-Path $logRoot ($trimmedService + ".log")

        if (Test-Path -LiteralPath $logFile) {
            Remove-Item -LiteralPath $logFile -Force -ErrorAction SilentlyContinue
        }

        $process = Start-Process powershell `
            -WindowStyle Hidden `
            -ArgumentList @(
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", $watcherScript,
                "-RepoRoot", $PSScriptRoot,
                "-ServiceName", $trimmedService,
                "-LogFilePath", $logFile,
                "-ComposeArgsBase64", $composeArgsBase64
            ) `
            -PassThru

        $state.Add([pscustomobject]@{
            service = $trimmedService
            pid = $process.Id
            log_file = $logFile
        })
    }

    $state | ConvertTo-Json | Set-Content -LiteralPath (Get-LogWatcherStatePath) -Encoding UTF8
    Write-Host "[LOG] Mirroring Docker logs to $logRoot" -ForegroundColor Cyan
}

function Get-ServiceReadinessStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ComposeArgs,

        [Parameter(Mandatory = $true)]
        [string[]]$ServiceNames
    )

    $statuses = New-Object System.Collections.Generic.List[object]

    foreach ($serviceName in $ServiceNames) {
        $containerId = docker compose @ComposeArgs ps -q $serviceName 2>$null
        if ([string]::IsNullOrWhiteSpace($containerId)) {
            $statuses.Add([pscustomobject]@{
                service = $serviceName
                status = "missing"
                raw = ""
            })
            continue
        }

        $state = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $containerId 2>$null
        if ([string]::IsNullOrWhiteSpace($state)) {
            $trimmedState = "unknown"
        } else {
            $trimmedState = $state.Trim()
        }

        $statuses.Add([pscustomobject]@{
            service = $serviceName
            status = $trimmedState
            raw = $trimmedState
        })
    }

    return $statuses
}

function Wait-ForServicesReady {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ComposeArgs,

        [Parameter(Mandatory = $true)]
        [string[]]$ServiceNames,

        [Parameter(Mandatory = $true)]
        [int]$TimeoutSec
    )

    if ($ServiceNames.Count -eq 0) {
        return
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSec)

    while ((Get-Date) -lt $deadline) {
        $statuses = @(Get-ServiceReadinessStatus -ComposeArgs $ComposeArgs -ServiceNames $ServiceNames)
        $pending = @($statuses | Where-Object { $_.status -notin @("running", "healthy") })
        $failed = @($statuses | Where-Object { $_.status -in @("exited", "dead", "missing") })

        if ($failed.Count -gt 0) {
            $failedText = ($failed | ForEach-Object { "$($_.service)=$($_.status)" }) -join ", "
            throw "Service startup failed: $failedText"
        }

        if ($pending.Count -eq 0) {
            $summary = ($statuses | ForEach-Object { "$($_.service)=$($_.status)" }) -join ", "
            Write-Host "[WAIT] Ready: $summary" -ForegroundColor Green
            return
        }

        $summary = ($statuses | ForEach-Object { "$($_.service)=$($_.status)" }) -join ", "
        Write-Host "[WAIT] $summary" -ForegroundColor DarkGray
        Start-Sleep -Seconds 2
    }

    $lastStatuses = @(Get-ServiceReadinessStatus -ComposeArgs $ComposeArgs -ServiceNames $ServiceNames)
    $summary = ($lastStatuses | ForEach-Object { "$($_.service)=$($_.status)" }) -join ", "
    throw "Timed out after $TimeoutSec seconds waiting for services: $summary"
}

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

Stop-ExistingLogWatchers

$selectedServices = @(
    $Services |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { $_ -split "," } |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)

if (($WithCloudTtsFake -or $WithCloudTtsReal) -and $selectedServices.Count -gt 0) {
    $selectedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($serviceName in $selectedServices) {
        [void]$selectedSet.Add($serviceName)
    }

    $cloudTtsBackends = if ($WithCloudTtsFake) { @("tts_gateway", "tts_service_fake") } else { @("tts_gateway", "tts_service") }
    $needsCloudBackends = $selectedSet.Contains("bot_service") -or $selectedSet.Contains("tts_gateway")

    if ($needsCloudBackends) {
        $autoAdded = New-Object System.Collections.Generic.List[string]
        foreach ($backendService in $cloudTtsBackends) {
            if (-not $selectedSet.Contains($backendService)) {
                [void]$selectedSet.Add($backendService)
                $autoAdded.Add($backendService)
            }
        }

        if ($autoAdded.Count -gt 0) {
            Write-Host "[INFO] Auto-including cloud TTS services for selected backend startup: $($autoAdded -join ', ')" -ForegroundColor Cyan
        }

        $selectedServices = @($selectedSet)
    }
}

try {
    Invoke-NativeOrThrow -FilePath "docker" -ArgumentList @("version") -FailureMessage "Docker is not available."
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

Write-Host "[PREP] Preparing local Docker stack..." -ForegroundColor Yellow
if ($Reset) {
    $downArgs = @("compose") + $composeArgs + @("down", "--remove-orphans")
    Invoke-NativeOrThrow -FilePath "docker" -ArgumentList $downArgs -FailureMessage "Failed to stop existing containers."
} else {
    Write-Host "[SKIP] Keeping existing containers and volumes. Use -Reset for full cleanup/start." -ForegroundColor DarkGray
}

if ($Build) {
    Write-Host "[BUILD] Building updated images for selected services..." -ForegroundColor Yellow
} else {
    Write-Host "[START] Starting containers without forced rebuild..." -ForegroundColor Yellow
}

$upArgs = @("compose") + $composeArgs + @("up", "-d", "--remove-orphans")
if ($Build) {
    $upArgs += "--build"
}
if ($selectedServices.Count -gt 0) {
    $upArgs += $selectedServices
}
Invoke-NativeOrThrow -FilePath "docker" -ArgumentList $upArgs -FailureMessage "Failed to build and start local stack."

if ($selectedServices.Count -gt 0) {
    $waitServices = $selectedServices
} else {
    $waitServices = @(
        docker compose @composeArgs ps --services --status running |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}

Write-Host "[WAIT] Waiting for services to become ready..." -ForegroundColor Yellow
Wait-ForServicesReady -ComposeArgs $composeArgs -ServiceNames $waitServices -TimeoutSec $WaitTimeoutSec

Write-Host "[STATUS] Services status:" -ForegroundColor Cyan
$psArgs = @("compose") + $composeArgs + @("ps")
Invoke-NativeOrThrow -FilePath "docker" -ArgumentList $psArgs -FailureMessage "Failed to read service status."

$runningServices = @(
    docker compose @composeArgs ps --services --status running |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
if ($runningServices.Count -eq 0) {
    throw "Docker compose completed without any running services."
}

Start-LogWatchers -ComposeArgs $composeArgs

Write-Host ""
Write-Host "[OK] Local stack started" -ForegroundColor Green
Write-Host "[WEB] Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "[API] Bot API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "[AUTH] Local Docker callbacks use http://localhost/auth/... for Twitch/VK and http://localhost/donationalerts/callback for DonationAlerts." -ForegroundColor Cyan
Write-Host "[AUTH] Backend-direct http://localhost:8000/auth/... callbacks are only for explicit non-nginx runs." -ForegroundColor Cyan
Write-Host "[LOG] Mirrored service logs: $((Get-LogMirrorRoot))" -ForegroundColor Cyan

if ($WithCloudTtsFake) {
    Write-Host "[TTS] Gateway: http://localhost:8010" -ForegroundColor Cyan
    Write-Host "[TTS] Fake F5 runtime: http://localhost:8011" -ForegroundColor Cyan
    Write-Host "[INFO] Fake/light TTS profile starts a lightweight smoke runtime without model prewarm." -ForegroundColor Yellow
} elseif ($WithCloudTtsReal) {
    Write-Host "[TTS] Gateway: http://localhost:8010" -ForegroundColor Cyan
    Write-Host "[TTS] F5 runtime: http://localhost:8011" -ForegroundColor Cyan
} else {
    Write-Host "[INFO] Started core profile only. Re-run with -WithCloudTtsFake or -WithCloudTtsReal to include TTS." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[LOG] Live logs: docker compose $($composeArgs -join ' ') logs -f" -ForegroundColor Yellow
Write-Host "[STOP] Stop: .\stop-dev.ps1" -ForegroundColor Yellow
