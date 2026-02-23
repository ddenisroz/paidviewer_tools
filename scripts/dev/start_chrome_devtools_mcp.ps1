$ErrorActionPreference = "Stop"

function Resolve-ChromePath {
    if ($env:CHROME_PATH -and (Test-Path $env:CHROME_PATH)) {
        return $env:CHROME_PATH
    }

    $chromeCommand = Get-Command chrome.exe -ErrorAction SilentlyContinue
    if ($chromeCommand) {
        return $chromeCommand.Source
    }

    $programFilesX86 = ${env:ProgramFiles(x86)}
    $candidates = @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
    )
    if ($programFilesX86) {
        $candidates += (Join-Path $programFilesX86 "Google\Chrome\Application\chrome.exe")
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $null
}

$chromePath = Resolve-ChromePath
$debugPort = 9222
$browserUrl = "http://127.0.0.1:$debugPort"
$versionUrl = "$browserUrl/json/version"
$profileDir = if ($env:CHROME_PROFILE_DIR) { $env:CHROME_PROFILE_DIR } else { (Join-Path $env:TEMP "ChromeDevProfile") }

function Test-DebugPortReady {
    param([string]$Url)
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
        return $resp.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-Path $chromePath)) {
    Write-Error "Chrome not found. Set CHROME_PATH or install Google Chrome."
    exit 1
}

if (-not (Test-DebugPortReady -Url $versionUrl)) {
    Start-Process -FilePath $chromePath -ArgumentList "--remote-debugging-port=$debugPort", "--user-data-dir=$profileDir"

    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 300
        if (Test-DebugPortReady -Url $versionUrl) {
            $ready = $true
            break
        }
    }

    if (-not $ready) {
        Write-Error "Chrome launched, but DevTools endpoint is not ready: $versionUrl"
        exit 1
    }
}

& npx -y chrome-devtools-mcp@latest --browserUrl $browserUrl
exit $LASTEXITCODE
