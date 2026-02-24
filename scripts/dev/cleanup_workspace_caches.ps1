param(
    [switch]$Apply,
    [switch]$IncludeNodeModules
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    $scriptPath = $PSCommandPath
    if (-not $scriptPath) {
        $scriptPath = $MyInvocation.MyCommand.Path
    }
    if (-not $scriptPath) {
        throw "Unable to resolve script path."
    }
    $scriptDir = Split-Path -Parent $scriptPath
    return (Resolve-Path (Join-Path $scriptDir "..\\..")).Path
}

function Add-TargetIfExists {
    param(
        [System.Collections.Generic.List[string]]$Targets,
        [string]$PathToCheck
    )
    if (Test-Path $PathToCheck) {
        $Targets.Add((Resolve-Path $PathToCheck).Path)
    }
}

$repoRoot = Resolve-RepoRoot
Set-Location $repoRoot

$targets = New-Object 'System.Collections.Generic.List[string]'

# Common cache/build/test artifacts.
$fixedPaths = @(
    "artifacts",
    "playwright-report",
    ".playwright",
    ".playwright-cli",
    "frontend/dist",
    "frontend/coverage",
    "frontend/.vite",
    "frontend/.vitest",
    "bot_service/.pytest_cache",
    "bot_service/.ruff_cache",
    "bot_service/.mypy_cache",
    "bot_service/htmlcov"
)

foreach ($relativePath in $fixedPaths) {
    Add-TargetIfExists -Targets $targets -PathToCheck (Join-Path $repoRoot $relativePath)
}

if ($IncludeNodeModules) {
    Add-TargetIfExists -Targets $targets -PathToCheck (Join-Path $repoRoot "frontend/node_modules")
}

# Recurse only in project code (skip .venv and .git).
$searchRoots = @("bot_service", "frontend", "scripts", "docs", "deploy", "F5_tts")
foreach ($root in $searchRoots) {
    $absRoot = Join-Path $repoRoot $root
    if (-not (Test-Path $absRoot)) {
        continue
    }

    Get-ChildItem -Path $absRoot -Recurse -Directory -Force |
        Where-Object {
            $_.Name -eq "__pycache__" -and
            $_.FullName -notlike "*\\.venv\\*" -and
            $_.FullName -notlike "*\\.git\\*"
        } |
        ForEach-Object {
            $targets.Add($_.FullName)
        }
}

$targets = $targets | Sort-Object -Unique

if (-not $targets -or $targets.Count -eq 0) {
    Write-Host "[cleanup] No cache/build targets found."
    exit 0
}

Write-Host "[cleanup] Targets:"
$targets | ForEach-Object { Write-Host " - $_" }

if (-not $Apply) {
    Write-Host ""
    Write-Host "[cleanup] Dry-run mode. Re-run with -Apply to delete listed paths."
    exit 0
}

foreach ($target in $targets) {
    try {
        Remove-Item -Path $target -Recurse -Force -ErrorAction Stop
        Write-Host "[cleanup] removed: $target"
    }
    catch {
        Write-Warning "[cleanup] failed: $target :: $($_.Exception.Message)"
    }
}

Write-Host "[cleanup] Done."
