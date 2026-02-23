param(
    [string]$OutputDir = "artifacts/F5_tts_export",
    [switch]$CleanExisting
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Resolve-ExportTarget {
    param(
        [string]$BasePath,
        [switch]$AllowReplace
    )

    if (-not (Test-Path $BasePath)) {
        return $BasePath
    }

    if ($AllowReplace) {
        return $BasePath
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    return "${BasePath}_$timestamp"
}

function Copy-Directory {
    param(
        [string]$Source,
        [string]$Destination
    )

    Ensure-Directory -Path $Destination

    $excludeDirs = @(
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        ".mypy_cache",
        ".git",
        ".idea",
        ".vscode",
        ".venv",
        "venv",
        "node_modules",
        "logs",
        "backups",
        "audio",
        "f5_tts_cache",
        "user_configs",
        "data",
        "tmp",
        "temp"
    )

    $excludeFiles = @(
        ".env",
        "*.pyc",
        "*.pyo",
        "*.pyd",
        "Thumbs.db",
        ".DS_Store"
    )

    $args = @(
        $Source,
        $Destination,
        "/E",
        "/XJ",
        "/COPY:DAT",
        "/DCOPY:DA",
        "/R:1",
        "/W:1",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/NC",
        "/NS",
        "/NP",
        "/XF"
    )

    foreach ($file in $excludeFiles) {
        $args += $file
    }

    $args += "/XD"
    foreach ($dir in $excludeDirs) {
        $args += $dir
    }

    & robocopy @args | Out-Null
    $rc = $LASTEXITCODE
    # Robocopy exit codes < 8 are non-fatal.
    if ($rc -ge 8) {
        throw "robocopy failed for $Source -> $Destination (exit code: $rc)"
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..")
$targetRootBase = Join-Path $repoRoot $OutputDir
$targetRoot = Resolve-ExportTarget -BasePath $targetRootBase -AllowReplace:$CleanExisting

if ((Test-Path $targetRoot) -and $CleanExisting) {
    try {
        Remove-Item -Path $targetRoot -Recurse -Force -ErrorAction Stop
    } catch {
        throw "Failed to clean existing export directory '$targetRoot'. Try a new OutputDir or fix permissions."
    }
}
Ensure-Directory -Path $targetRoot

Write-Host "[INFO] Exporting F5_tts to $targetRoot"

$serviceSource = Join-Path $repoRoot "F5_tts"
$serviceTarget = Join-Path $targetRoot "F5_tts"
Copy-Directory -Source $serviceSource -Destination $serviceTarget

# Copy docker profiles needed for standalone operations.
Ensure-Directory -Path (Join-Path $targetRoot "deploy/docker")
Copy-Item (Join-Path $repoRoot "deploy/docker/docker-compose.tts-simple.yml") (Join-Path $targetRoot "deploy/docker/docker-compose.tts-simple.yml")
Copy-Item (Join-Path $repoRoot "deploy/docker/docker-compose.tts-advanced.yml") (Join-Path $targetRoot "deploy/docker/docker-compose.tts-advanced.yml")

# Copy extraction docs.
Ensure-Directory -Path (Join-Path $targetRoot "docs/setup")
Copy-Item (Join-Path $repoRoot "docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md") (Join-Path $targetRoot "docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md")

$manifestPath = Join-Path $targetRoot "EXPORT_MANIFEST.txt"
@(
    "F5_tts export bundle"
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    "Source: $repoRoot"
    ""
    "Included:"
    "- F5_tts/"
    "- deploy/docker/docker-compose.tts-simple.yml"
    "- deploy/docker/docker-compose.tts-advanced.yml"
    "- docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md"
) | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "[OK] Export bundle prepared: $targetRoot"
