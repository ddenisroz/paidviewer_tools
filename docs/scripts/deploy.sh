#!/bin/bash

# Скрипт деплоя TTS-приложения на VPS

set -e

echo "🚀 Начинаем деплой TTS-приложения..."

# Проверяем наличие .env файлов
if [ ! -f ".env.production" ]; then
    echo "❌ Файл .env.production не найден!"
    echo "Скопируйте env.production.example в .env.production и заполните значения"
    exit 1
fi

if [ ! -f "frontend/.env.production" ]; then
    echo "❌ Файл frontend/.env.production не найден!"
    echo "Скопируйте frontend/env.production.example в frontend/.env.production и заполните значения"
    exit 1
fi

# Проверяем SSL сертификаты
if [ ! -d "ssl" ]; then
    echo "📋 Создаем директорию для SSL сертификатов..."
    mkdir -p ssl
    echo "⚠️  Поместите ваши SSL сертификаты в папку ssl/"
    echo "   - ssl/cert.pem"
    echo "   - ssl/key.pem"
    echo "   Или используйте Let's Encrypt для автоматического получения"
fi

# Останавливаем старые контейнеры
echo "🛑 Останавливаем старые контейнеры..."
docker-compose -f docker-compose.prod.yml down || true

# Собираем образы
echo "🔨 Собираем Docker образы..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Запускаем сервисы
echo "🎬 Запускаем сервисы..."
docker-compose -f docker-compose.prod.yml up -d

# Проверяем статус
echo "📊 Проверяем статус сервисов..."
sleep 10
docker-compose -f docker-compose.prod.yml ps

echo "✅ Деплой завершен!"
echo "🌐 Ваше приложение доступно по адресу: https://$(grep DOMAIN .env.production | cut -d '=' -f2)"
echo "📝 Логи можно посмотреть командой: docker-compose -f docker-compose.prod.yml logs -f"
