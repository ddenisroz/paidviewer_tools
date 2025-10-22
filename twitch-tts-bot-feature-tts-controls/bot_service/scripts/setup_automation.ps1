# PowerShell скрипт настройки автоматизации обслуживания bot_service

param(
    [string]$ServiceName = "bot_service"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
$PythonScript = Join-Path $ScriptDir "maintenance.py"

Write-Host "Настройка автоматизации для $ServiceName" -ForegroundColor Green
Write-Host "Базовая директория: $BaseDir"
Write-Host "Скрипты: $ScriptDir"

# Проверяем, что скрипты существуют
if (-not (Test-Path $PythonScript)) {
    Write-Error "Ошибка: Скрипт $PythonScript не найден!"
    exit 1
}

Write-Host "Создание задач Windows..."

# Создаем задачу для ежедневного обслуживания
$DailyTaskName = "BotServiceDailyMaintenance"
$DailyTaskDescription = "Ежедневное обслуживание bot_service"
$DailyCommand = "python"
$DailyArguments = "`"$PythonScript`" daily"
$DailyTrigger = New-ScheduledTaskTrigger -Daily -At "02:00"

$DailyAction = New-ScheduledTaskAction -Execute $DailyCommand -Argument $DailyArguments -WorkingDirectory $BaseDir
$DailySettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName $DailyTaskName -Description $DailyTaskDescription -Action $DailyAction -Trigger $DailyTrigger -Settings $DailySettings -Force
    Write-Host "Задача '$DailyTaskName' создана!" -ForegroundColor Green
} catch {
    Write-Warning "Не удалось создать задачу '$DailyTaskName': $_"
}

# Создаем задачу для еженедельного обслуживания
$WeeklyTaskName = "BotServiceWeeklyMaintenance"
$WeeklyTaskDescription = "Еженедельное обслуживание bot_service"
$WeeklyCommand = "python"
$WeeklyArguments = "`"$PythonScript`" weekly"
$WeeklyTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "03:00"

$WeeklyAction = New-ScheduledTaskAction -Execute $WeeklyCommand -Argument $WeeklyArguments -WorkingDirectory $BaseDir
$WeeklySettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName $WeeklyTaskName -Description $WeeklyTaskDescription -Action $WeeklyAction -Trigger $WeeklyTrigger -Settings $WeeklySettings -Force
    Write-Host "Задача '$WeeklyTaskName' создана!" -ForegroundColor Green
} catch {
    Write-Warning "Не удалось создать задачу '$WeeklyTaskName': $_"
}

# Создаем задачу для мониторинга (каждый час)
$MonitorTaskName = "BotServiceMonitor"
$MonitorTaskDescription = "Мониторинг bot_service"
$MonitorCommand = "python"
$MonitorArguments = "`"$PythonScript`" status --alert-only"
$MonitorTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 365)

$MonitorAction = New-ScheduledTaskAction -Execute $MonitorCommand -Argument $MonitorArguments -WorkingDirectory $BaseDir
$MonitorSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName $MonitorTaskName -Description $MonitorTaskDescription -Action $MonitorAction -Trigger $MonitorTrigger -Settings $MonitorSettings -Force
    Write-Host "Задача '$MonitorTaskName' создана!" -ForegroundColor Green
} catch {
    Write-Warning "Не удалось создать задачу '$MonitorTaskName': $_"
}

# Создаем скрипт для ручного запуска
$ManualScript = Join-Path $BaseDir "run_maintenance.ps1"
$ManualScriptContent = @"
# Ручной запуск обслуживания bot_service

param(
    [Parameter(Mandatory=`$true)]
    [ValidateSet("daily", "weekly", "emergency", "status")]
    [string]`$Action
)

`$ScriptDir = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$PythonScript = Join-Path `$ScriptDir "scripts\maintenance.py"

Set-Location `$ScriptDir

switch (`$Action) {
    "daily" {
        Write-Host "Запуск ежедневного обслуживания..." -ForegroundColor Yellow
        python `"`$PythonScript`" daily
    }
    "weekly" {
        Write-Host "Запуск еженедельного обслуживания..." -ForegroundColor Yellow
        python `"`$PythonScript`" weekly
    }
    "emergency" {
        Write-Host "Запуск экстренной очистки..." -ForegroundColor Red
        python `"`$PythonScript`" emergency
    }
    "status" {
        Write-Host "Проверка статуса..." -ForegroundColor Cyan
        python `"`$PythonScript`" status
    }
}
"@

Set-Content -Path $ManualScript -Value $ManualScriptContent -Encoding UTF8
Write-Host "Создан скрипт для ручного запуска: $ManualScript" -ForegroundColor Green

# Создаем конфигурационный файл
$ConfigFile = Join-Path $BaseDir "maintenance.conf"
$ConfigContent = @"
# Конфигурация обслуживания bot_service

# Пороги предупреждений (проценты)
DISK_WARNING_THRESHOLD=80
DISK_CRITICAL_THRESHOLD=90

# Максимальный размер сервиса (в GB)
SERVICE_MAX_SIZE_GB=3

# Возраст файлов для очистки (в днях)
MAX_BACKUP_AGE_DAYS=30
MAX_LOG_AGE_DAYS=90

# Настройки бэкапов
BACKUP_TYPES=database,config
BACKUP_COMPRESS=true

# Настройки логирования
LOG_LEVEL=INFO
"@

Set-Content -Path $ConfigFile -Value $ConfigContent -Encoding UTF8
Write-Host "Создан конфигурационный файл: $ConfigFile" -ForegroundColor Green

# Создаем папку для логов обслуживания
$LogsDir = Join-Path $BaseDir "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

Write-Host ""
Write-Host "Настройка автоматизации завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "Полезные команды:" -ForegroundColor Cyan
Write-Host "  .\run_maintenance.ps1 status     - Проверить статус"
Write-Host "  .\run_maintenance.ps1 daily      - Ежедневное обслуживание"
Write-Host "  .\run_maintenance.ps1 weekly     - Еженедельное обслуживание"
Write-Host "  .\run_maintenance.ps1 emergency  - Экстренная очистка"
Write-Host ""
Write-Host "Логи обслуживания: $LogsDir\maintenance.log"
Write-Host "Конфигурация: $ConfigFile"
Write-Host ""
Write-Host "Для просмотра задач используйте:" -ForegroundColor Yellow
Write-Host "  Get-ScheduledTask -TaskName '*BotService*'"
