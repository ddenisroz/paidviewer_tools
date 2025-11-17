# Скрипт настройки PostgreSQL для TTS Bot
# Запуск: .\scripts\setup_postgresql.ps1

$PSQL_PATH = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Настройка PostgreSQL для TTS Bot" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверяем наличие psql
if (-not (Test-Path $PSQL_PATH)) {
    Write-Host "❌ PostgreSQL не найден по пути: $PSQL_PATH" -ForegroundColor Red
    Write-Host "   Убедитесь, что PostgreSQL установлен" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PostgreSQL найден" -ForegroundColor Green
Write-Host ""

# Запрашиваем пароль postgres
$postgresPassword = Read-Host "Введите пароль пользователя 'postgres' (который указывали при установке)" -AsSecureString
$postgresPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($postgresPassword))

# Запрашиваем имя БД (можно оставить по умолчанию)
$dbName = Read-Host "Имя базы данных [по умолчанию: tts_bot_db]"
if ([string]::IsNullOrWhiteSpace($dbName)) {
    $dbName = "tts_bot_db"
}

# Запрашиваем имя пользователя
$dbUser = Read-Host "Имя пользователя БД [по умолчанию: tts_user]"
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    $dbUser = "tts_user"
}

# Запрашиваем пароль пользователя
Write-Host ""
$dbPassword = Read-Host "Пароль для пользователя '$dbUser'" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host ""
Write-Host "📋 Создание базы данных и пользователя..." -ForegroundColor Cyan

# SQL команды
$sqlCommands = @"
-- Создаем базу данных
CREATE DATABASE $dbName;

-- Создаем пользователя
CREATE USER $dbUser WITH PASSWORD '$dbPasswordPlain';

-- Даем права на базу данных
GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;

-- Подключаемся к новой БД и даем права на схему public
\c $dbName
GRANT ALL ON SCHEMA public TO $dbUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $dbUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $dbUser;
"@

# Сохраняем во временный файл
$tempFile = [System.IO.Path]::GetTempFileName()
$sqlCommands | Out-File -FilePath $tempFile -Encoding UTF8

try {
    # Устанавливаем переменную окружения с паролем
    $env:PGPASSWORD = $postgresPasswordPlain
    
    # Выполняем SQL команды
    $result = & $PSQL_PATH -U postgres -f $tempFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ База данных и пользователь успешно созданы!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Добавьте в ваш .env файл:" -ForegroundColor Cyan
        Write-Host "DATABASE_URL=postgresql://$dbUser`:$dbPasswordPlain@localhost:5432/$dbName" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "⚠️  ВАЖНО: Сохраните эту строку - она понадобится для подключения!" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Ошибка создания базы данных:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Ошибка: $_" -ForegroundColor Red
} finally {
    # Удаляем временный файл
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    # Очищаем пароль из окружения
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Нажмите Enter для выхода..."
Read-Host

