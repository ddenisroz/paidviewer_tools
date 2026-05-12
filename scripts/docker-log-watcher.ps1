param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [Parameter(Mandatory = $true)]
    [string]$LogFilePath,

    [string]$ComposeArgsJson,

    [string]$ComposeArgsBase64
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$composeArgs = @()
if (-not [string]::IsNullOrWhiteSpace($ComposeArgsBase64)) {
    $decodedComposeArgsJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($ComposeArgsBase64))
    $composeArgs = @((ConvertFrom-Json -InputObject $decodedComposeArgsJson))
} elseif (-not [string]::IsNullOrWhiteSpace($ComposeArgsJson)) {
    $composeArgs = @((ConvertFrom-Json -InputObject $ComposeArgsJson))
}

$logDirectory = Split-Path -Parent $LogFilePath
if (-not (Test-Path -LiteralPath $logDirectory)) {
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
}

Set-Location $RepoRoot

docker compose @composeArgs logs -f --timestamps --no-color $ServiceName |
    Out-File -FilePath $LogFilePath -Encoding utf8 -Width 4096
