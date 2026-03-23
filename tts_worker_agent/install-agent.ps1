$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Root ".venv"
$Python = "python"

if (-not (Test-Path $Venv)) {
    & $Python -m venv $Venv
}

$VenvPython = Join-Path $Venv "Scripts\\python.exe"
$Pip = Join-Path $Venv "Scripts\\pip.exe"

& $Pip install -r (Join-Path $Root "requirements.txt")

$ConfigPath = Join-Path $Root "config.json"
if (-not (Test-Path $ConfigPath)) {
    Copy-Item (Join-Path $Root "config.example.json") $ConfigPath
}

$TaskName = "PaidviewerTTSAgent"
$RunCommand = "`"$VenvPython`" `"$Root\\main.py`" --config `"$ConfigPath`""

$Action = New-ScheduledTaskAction -Execute $VenvPython -Argument "`"$Root\\main.py`" --config `"$ConfigPath`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Paidviewer TTS worker agent" -Force | Out-Null

Write-Host "Worker agent installed."
Write-Host "Edit $ConfigPath and then run:"
Write-Host "Start-ScheduledTask -TaskName $TaskName"
