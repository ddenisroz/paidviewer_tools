param(
    [Parameter(Mandatory = $true)]
    [string]$RootDomain,

    [string]$AppSubdomain = "app",
    [string]$ApiSubdomain = "api"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Set-OrAddEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    if (-not (Test-Path $Path)) {
        "" | Set-Content -Path $Path -Encoding utf8
    }

    $content = Get-Content -Path $Path -Raw -Encoding utf8
    $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
    $line = "$Key=$Value"

    if ($content -match $pattern) {
        $content = [regex]::Replace($content, $pattern, $line)
    } else {
        if ($content -and -not $content.EndsWith("`n")) {
            $content += "`r`n"
        }
        $content += "$line`r`n"
    }

    Set-Content -Path $Path -Value $content -Encoding utf8
}

$root = (Resolve-Path ".").Path
$appHost = "$AppSubdomain.$RootDomain"
$apiHost = "$ApiSubdomain.$RootDomain"
$appUrl = "https://$appHost"
$apiUrl = "https://$apiHost"

$frontendEnv = Join-Path $root "frontend/.env"
$backendEnv = Join-Path $root "bot_service/.env"

Set-OrAddEnvValue -Path $frontendEnv -Key "VITE_BOT_SERVICE_URL" -Value $apiUrl
Set-OrAddEnvValue -Path $frontendEnv -Key "VITE_BOT_SERVICE_WS_URL" -Value ("wss://{0}" -f $apiHost)
Set-OrAddEnvValue -Path $frontendEnv -Key "VITE_FRONTEND_URL" -Value $appUrl

Set-OrAddEnvValue -Path $backendEnv -Key "FRONTEND_URL" -Value $appUrl
Set-OrAddEnvValue -Path $backendEnv -Key "BACKEND_URL" -Value $apiUrl
Set-OrAddEnvValue -Path $backendEnv -Key "CORS_ORIGINS" -Value "$appUrl,$apiUrl"
Set-OrAddEnvValue -Path $backendEnv -Key "TWITCH_REDIRECT_URI" -Value "$apiUrl/auth/twitch/callback"
Set-OrAddEnvValue -Path $backendEnv -Key "VK_REDIRECT_URI" -Value "$apiUrl/auth/vk/callback"
Set-OrAddEnvValue -Path $backendEnv -Key "DONATIONALERTS_REDIRECT_URI" -Value "$apiUrl/auth/donationalerts/callback"

$cloudflaredConfigDir = Join-Path $env:USERPROFILE ".cloudflared"
if (-not (Test-Path $cloudflaredConfigDir)) {
    New-Item -ItemType Directory -Path $cloudflaredConfigDir | Out-Null
}

$cloudflaredTemplatePath = Join-Path $root "scripts/dev/cloudflared.public.template.yml"
$cloudflaredConfigPath = Join-Path $cloudflaredConfigDir "config.yml"
$cloudflaredCredentialsTemplatePath = Join-Path $cloudflaredConfigDir "REPLACE_WITH_TUNNEL_ID.json"

$template = @"
# 1) Run once: cloudflared tunnel login
# 2) Create tunnel: cloudflared tunnel create tts-ttv
# 3) Put real tunnel id and credentials file below.
tunnel: REPLACE_WITH_TUNNEL_NAME_OR_ID
credentials-file: $cloudflaredCredentialsTemplatePath

ingress:
  - hostname: $appHost
    service: http://localhost:5173
  - hostname: $apiHost
    service: http://localhost:8000
  - service: http_status:404
"@

Set-Content -Path $cloudflaredTemplatePath -Value $template -Encoding utf8

Write-Host ""
Write-Host "Public domain env updated:"
Write-Host "  frontend/.env -> VITE_BOT_SERVICE_URL=$apiUrl"
Write-Host "  bot_service/.env -> FRONTEND_URL=$appUrl, BACKEND_URL=$apiUrl"
Write-Host ""
Write-Host "Cloudflared template created:"
Write-Host "  $cloudflaredTemplatePath"
Write-Host ""
Write-Host "Next commands:"
Write-Host "  cloudflared tunnel login"
Write-Host "  cloudflared tunnel create tts-ttv"
Write-Host "  cloudflared tunnel route dns tts-ttv $appHost"
Write-Host "  cloudflared tunnel route dns tts-ttv $apiHost"
Write-Host "  # copy template to $cloudflaredConfigPath and fill tunnel id"
Write-Host "  cloudflared tunnel run tts-ttv"
Write-Host ""
