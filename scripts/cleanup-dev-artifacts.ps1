param(
    [switch]$RemoveHarFiles,
    [switch]$RemoveOutput,
    [switch]$RemovePycache,
    [switch]$RemoveTempAudio
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$pathsToRemove = @(
    ".playwright-cli",
    ".playwright",
    "playwright-report",
    ".ruff_cache",
    ".pytest_cache",
    ".mypy_cache",
    ".cache",
    "coverage",
    "frontend/.vite"
)

foreach ($relativePath in $pathsToRemove) {
    if (Test-Path $relativePath) {
        Remove-Item $relativePath -Recurse -Force
        Write-Host "Removed: $relativePath"
    }
}

if ($RemoveHarFiles) {
    Get-ChildItem -Path . -Filter *.har -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "Removed HAR: $($_.FullName)"
    }
}

if ($RemoveOutput -and (Test-Path "output")) {
    Remove-Item "output" -Recurse -Force
    Write-Host "Removed: output"
}

if ($RemoveTempAudio) {
    $tempAudioPaths = @(
        "bot_service/temp/tts_audio",
        "tts_service/audio"
    )
    foreach ($audioPath in $tempAudioPaths) {
        if (Test-Path $audioPath) {
            Get-ChildItem -Path $audioPath -File -ErrorAction SilentlyContinue | ForEach-Object {
                Remove-Item $_.FullName -Force
                Write-Host "Removed temp audio: $($_.FullName)"
            }
        }
    }
}

if ($RemovePycache) {
    Get-ChildItem -Path . -Directory -Recurse -Filter "__pycache__" -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force
        Write-Host "Removed: $($_.FullName)"
    }
    Get-ChildItem -Path . -File -Recurse -Include *.pyc,*.pyo -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "Removed bytecode: $($_.FullName)"
    }
}

Write-Host "Cleanup complete."
