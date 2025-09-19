# TTS_TTV - Микросервисная архитектура (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   TTS_TTV - МИКРОСЕРВИСНАЯ АРХИТЕКТУРА  " -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка .env файла
Write-Host "📋 Проверка .env файла..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "❌ Файл .env не найден!" -ForegroundColor Red
    Write-Host "💡 Скопируйте test.env.example в .env и заполните токены" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit
}

Write-Host "✅ .env файл найден" -ForegroundColor Green
Write-Host ""

# Активация venv
Write-Host "🔧 Активация venv..." -ForegroundColor Yellow
if (Test-Path ".venv\Scripts\Activate.ps1") {
    Write-Host "✅ Virtual environment найден" -ForegroundColor Green
} else {
    Write-Host "⚠️ .venv не найден, используем системный Python" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "🚀 Запуск микросервисов..." -ForegroundColor Cyan
Write-Host ""

# Запуск TTS сервиса
Write-Host "[1/3] 🎤 Запуск TTS сервиса (с исправленным чтением референсного текста)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd tts-service; if (Test-Path '..\.venv\Scripts\Activate.ps1') { ..\.venv\Scripts\Activate.ps1 }; python main.py" -WindowStyle Normal
Start-Sleep -Seconds 3

# Запуск Bot сервиса  
Write-Host "[2/3] 🤖 Запуск Bot сервиса..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd bot-service; if (Test-Path '..\.venv\Scripts\Activate.ps1') { ..\.venv\Scripts\Activate.ps1 }; python main.py" -WindowStyle Normal
Start-Sleep -Seconds 3

# Запуск Frontend
Write-Host "[3/3] 🌐 Запуск Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Все микросервисы запущены!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Адреса сервисов:" -ForegroundColor Cyan
Write-Host "🌐 Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "🤖 Bot API:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "🎤 TTS API:   http://localhost:8001/docs" -ForegroundColor White
Write-Host "📈 Health:    http://localhost:8001/health" -ForegroundColor White
Write-Host ""
Write-Host "💡 Тестирование:" -ForegroundColor Yellow
Write-Host "1. Откройте http://localhost:5173"
Write-Host "2. Проверьте http://localhost:8001/health - должно показать правильные голоса"
Write-Host "3. В логах TTS сервиса должно появиться: 'Загружен референсный текст из speaker1.txt'"
Write-Host ""
Write-Host "⚠️  Убедитесь что порты 5173, 8000, 8001 свободны!" -ForegroundColor Yellow
Write-Host ""
Read-Host "Нажмите Enter для завершения"
