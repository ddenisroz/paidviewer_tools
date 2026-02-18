$ErrorActionPreference = "Stop"

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$debugPort = 9222
$browserUrl = "http://127.0.0.1:$debugPort"
$versionUrl = "$browserUrl/json/version"
$profileDir = "C:\ChromeDevProfile"

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
    Write-Error "Chrome not found at: $chromePath"
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

