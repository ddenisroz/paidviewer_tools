param(
    [string]$ProvisioningFile = "",
    [switch]$NoStart
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Root ".venv"
$Python = "python"
$ConfigPath = Join-Path $Root "config.json"
$ConfigTemplatePath = Join-Path $Root "config.example.json"
$StartupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$StartupCmdPath = Join-Path $StartupDir "PaidviewerTTSAgent.cmd"

function Get-LatestProvisioningFile {
    param(
        [string]$ExplicitPath
    )

    if ($ExplicitPath) {
        $resolved = Resolve-Path -Path $ExplicitPath -ErrorAction Stop
        return $resolved.Path
    }

    $candidates = @()
    $searchRoots = @($Root, (Join-Path $env:USERPROFILE "Downloads"))

    foreach ($searchRoot in $searchRoots) {
        if (-not (Test-Path $searchRoot)) {
            continue
        }

        $candidates += Get-ChildItem -Path $searchRoot -Filter "paidviewer-worker-provisioning-*.json" -File -ErrorAction SilentlyContinue

        $directName = Join-Path $searchRoot "paidviewer-worker-provisioning.json"
        if (Test-Path $directName) {
            $candidates += Get-Item $directName
        }
    }

    if (-not $candidates -or $candidates.Count -eq 0) {
        return $null
    }

    return ($candidates | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).FullName
}

function Ensure-ConfigExists {
    if (-not (Test-Path $ConfigPath)) {
        Copy-Item $ConfigTemplatePath $ConfigPath
    }
}

function Update-PropertyIfPresent {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Target,
        [Parameter(Mandatory = $true)]
        [string]$PropertyName,
        [Parameter(Mandatory = $true)]
        [object]$Value
    )

    if ($Target.PSObject.Properties.Name -contains $PropertyName) {
        $Target.$PropertyName = $Value
    } else {
        $Target | Add-Member -NotePropertyName $PropertyName -NotePropertyValue $Value
    }
}

function Merge-ProvisioningIntoConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundlePath
    )

    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $bundle = Get-Content $BundlePath -Raw | ConvertFrom-Json

    if ($bundle.kind -ne "paidviewer_worker_provisioning") {
        throw "Unsupported provisioning file: $BundlePath"
    }

    Update-PropertyIfPresent -Target $config -PropertyName "server_base_url" -Value ([string]$bundle.server_base_url)
    Update-PropertyIfPresent -Target $config -PropertyName "pairing_code" -Value ([string]$bundle.pairing_code)
    if ($bundle.required_agent_version) {
        Update-PropertyIfPresent -Target $config -PropertyName "required_agent_version" -Value ([string]$bundle.required_agent_version)
    }
    if ($bundle.recommended_agent_version) {
        Update-PropertyIfPresent -Target $config -PropertyName "recommended_agent_version" -Value ([string]$bundle.recommended_agent_version)
    }

    if ($bundle.label) {
        Update-PropertyIfPresent -Target $config -PropertyName "label" -Value ([string]$bundle.label)
    }
    if ($null -ne $bundle.poll_interval_sec) {
        Update-PropertyIfPresent -Target $config -PropertyName "poll_interval_sec" -Value ([int]$bundle.poll_interval_sec)
    }
    if ($null -ne $bundle.max_jobs_per_poll) {
        Update-PropertyIfPresent -Target $config -PropertyName "max_jobs_per_poll" -Value ([int]$bundle.max_jobs_per_poll)
    }
    if ($null -ne $bundle.wait_for_jobs) {
        Update-PropertyIfPresent -Target $config -PropertyName "wait_for_jobs" -Value ([bool]$bundle.wait_for_jobs)
    }

    if (-not ($config.PSObject.Properties.Name -contains "providers")) {
        $config | Add-Member -NotePropertyName "providers" -NotePropertyValue ([pscustomobject]@{})
    }

    foreach ($providerName in @("f5", "qwen")) {
        $providerBundle = $bundle.providers.$providerName
        if ($null -eq $providerBundle) {
            continue
        }

        $providerConfig = $config.providers.$providerName
        if ($null -eq $providerConfig) {
            $providerConfig = [pscustomobject]@{}
            $config.providers | Add-Member -NotePropertyName $providerName -NotePropertyValue $providerConfig
        }

        if ($null -ne $providerBundle.enabled) {
            Update-PropertyIfPresent -Target $providerConfig -PropertyName "enabled" -Value ([bool]$providerBundle.enabled)
        }
        if ($providerBundle.endpoint_url) {
            Update-PropertyIfPresent -Target $providerConfig -PropertyName "endpoint_url" -Value ([string]$providerBundle.endpoint_url)
        }
        if ($null -ne $providerBundle.api_key) {
            Update-PropertyIfPresent -Target $providerConfig -PropertyName "api_key" -Value ([string]$providerBundle.api_key)
        }
    }

    $config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigPath -Encoding UTF8
}

function Register-UserScheduledTask {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TaskName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$Arguments
    )

    $action = New-ScheduledTaskAction -Execute $ExecutablePath -Argument $Arguments
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
    $userId = if ($env:USERDOMAIN) { "$($env:USERDOMAIN)\$($env:USERNAME)" } else { $env:USERNAME }
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Paidviewer TTS worker agent" `
        -ErrorAction Stop `
        -Force | Out-Null
}

function Install-StartupFallback {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$Arguments
    )

    if (-not (Test-Path $StartupDir)) {
        New-Item -ItemType Directory -Path $StartupDir -Force | Out-Null
    }

    $commandLine = "@echo off`r`nstart `"`" `"$ExecutablePath`" $Arguments`r`n"
    Set-Content -Path $StartupCmdPath -Value $commandLine -Encoding ASCII
}

if (-not (Test-Path $Venv)) {
    & $Python -m venv $Venv
}

$VenvPython = Join-Path $Venv "Scripts\\python.exe"
$Pip = Join-Path $Venv "Scripts\\pip.exe"

& $Pip install -r (Join-Path $Root "requirements.txt")

Ensure-ConfigExists

$ResolvedProvisioningFile = Get-LatestProvisioningFile -ExplicitPath $ProvisioningFile
if ($ResolvedProvisioningFile) {
    Merge-ProvisioningIntoConfig -BundlePath $ResolvedProvisioningFile
}

$TaskName = "PaidviewerTTSAgent"
$RunArguments = "`"$Root\\main.py`" --config `"$ConfigPath`""
$InstalledMode = ""
$StartedMode = ""
$ScheduleError = $null

try {
    Register-UserScheduledTask -TaskName $TaskName -ExecutablePath $VenvPython -Arguments $RunArguments
    $InstalledMode = "scheduled_task"
} catch {
    $ScheduleError = $_
    Install-StartupFallback -ExecutablePath $VenvPython -Arguments $RunArguments
    $InstalledMode = "startup_folder"
}

if (-not $NoStart) {
    if ($InstalledMode -eq "scheduled_task") {
        try {
            Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
            $StartedMode = "scheduled_task"
        } catch {
            Start-Process -FilePath $VenvPython -ArgumentList "$RunArguments" | Out-Null
            $StartedMode = "direct_process"
        }
    } else {
        Start-Process -FilePath $VenvPython -ArgumentList "$RunArguments" | Out-Null
        $StartedMode = "direct_process"
    }
}

Write-Host "Worker agent installed."
if ($ResolvedProvisioningFile) {
    Write-Host "Imported provisioning: $ResolvedProvisioningFile"
}
Write-Host "Config path: $ConfigPath"
if ($InstalledMode -eq "scheduled_task") {
    Write-Host "Autostart mode: Scheduled Task"
} else {
    Write-Host "Autostart mode: Startup folder fallback"
    Write-Host "Startup file: $StartupCmdPath"
    if ($ScheduleError) {
        Write-Warning "Scheduled Task registration failed, fallback installed instead: $($ScheduleError.Exception.Message)"
    }
}
if (-not $ResolvedProvisioningFile) {
    Write-Host "Provisioning file not found yet. Start the app and click 'Подключить устройство' to complete pairing."
}
if (-not $NoStart) {
    if ($StartedMode -eq "scheduled_task") {
        Write-Host "Agent started via Scheduled Task."
    } elseif ($StartedMode -eq "direct_process") {
        Write-Host "Agent started as a direct background process."
    }
} else {
    if ($InstalledMode -eq "scheduled_task") {
        Write-Host "Start later with: Start-ScheduledTask -TaskName $TaskName"
    } else {
        Write-Host "Start later with: Start-Process -FilePath `"$VenvPython`" -ArgumentList '$RunArguments'"
    }
}
