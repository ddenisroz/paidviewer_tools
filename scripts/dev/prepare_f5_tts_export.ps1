param(
    [string]$OutputDir = "artifacts/F5_tts_export",
    [switch]$CleanExisting,
    [switch]$FlatLayout
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
$serviceTarget = if ($FlatLayout) { $targetRoot } else { Join-Path $targetRoot "F5_tts" }
Copy-Directory -Source $serviceSource -Destination $serviceTarget

$manifestPath = Join-Path $targetRoot "EXPORT_MANIFEST.txt"
@(
    "F5_tts export bundle"
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    "Source: $repoRoot"
    "Layout: $(if ($FlatLayout) { 'flat' } else { 'nested' })"
    ""
    "Included:"
    $(if ($FlatLayout) { "- <repo-root from F5_tts contents>" } else { "- F5_tts/" })
) | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "[OK] Export bundle prepared: $targetRoot"
