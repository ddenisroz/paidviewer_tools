# Скрипт для запуска в режиме разработки
Write-Host "🚀 Запуск TTS системы в режиме разработки..." -ForegroundColor Green

# Проверяем, что Docker запущен
try {
    docker version | Out-Null
    Write-Host "✅ Docker доступен" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker не запущен или не установлен!" -ForegroundColor Red
    exit 1
}

# Останавливаем существующие контейнеры
Write-Host "🛑 Останавливаем существующие контейнеры..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down

# Собираем и запускаем контейнеры
Write-Host "🔨 Собираем и запускаем контейнеры..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml up --build -d

# Ждем запуска сервисов
Write-Host "⏳ Ждем запуска сервисов..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Проверяем статус
Write-Host "📊 Статус сервисов:" -ForegroundColor Cyan
docker-compose -f docker-compose.dev.yml ps

Write-Host ""
Write-Host "🎉 Система запущена!" -ForegroundColor Green
Write-Host "🌐 Frontend: http://localhost" -ForegroundColor Cyan
Write-Host "🔧 Bot API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "🎵 TTS API: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Логи: docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor Yellow
Write-Host "🛑 Остановка: docker-compose -f docker-compose.dev.yml down" -ForegroundColor Yellow
