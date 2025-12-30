# Скрипт для запуска в режиме разработки
Write-Host "[START] Запуск TTS системы в режиме разработки..." -ForegroundColor Green

# Проверяем, что Docker запущен
try {
    docker version | Out-Null
    Write-Host "[OK] Docker доступен" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker не запущен или не установлен!" -ForegroundColor Red
    exit 1
}

# Останавливаем существующие контейнеры
Write-Host "[STOP] Останавливаем существующие контейнеры..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down

# Собираем и запускаем контейнеры
Write-Host "[BUILD] Собираем и запускаем контейнеры..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml up --build -d

# Ждем запуска сервисов
Write-Host "[WAIT] Ждем запуска сервисов..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Проверяем статус
Write-Host "[STATUS] Статус сервисов:" -ForegroundColor Cyan
docker-compose -f docker-compose.dev.yml ps

Write-Host ""
Write-Host "[OK] Система запущена!" -ForegroundColor Green
Write-Host "[WEB] Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "[API] Bot API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "[TTS] TTS API: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
Write-Host "[LOG] Логи: docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor Yellow
Write-Host "[STOP] Остановка: docker-compose -f docker-compose.dev.yml down" -ForegroundColor Yellow
