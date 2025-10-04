#!/bin/bash

# Скрипт очистки проекта от временных файлов и мусора

echo "🧹 Очистка проекта от мусора..."

# Удаляем временные файлы
echo "🗑️  Удаляем временные файлы..."
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name "*.log" -path "*/temp/*" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true
find . -name "Thumbs.db" -delete 2>/dev/null || true

# Очищаем кеши Python
echo "🐍 Очищаем Python кеши..."
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "*.pyo" -delete 2>/dev/null || true

# Очищаем Node.js кеши
echo "📦 Очищаем Node.js кеши..."
if [ -d "frontend/node_modules/.cache" ]; then
    rm -rf frontend/node_modules/.cache
fi
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
fi

# Очищаем временные аудио файлы
echo "🎵 Очищаем временные аудио файлы..."
if [ -d "tts_service/temp" ]; then
    find tts_service/temp -name "*.wav" -mtime +1 -delete 2>/dev/null || true
fi
if [ -d "tts_service/audio/temp" ]; then
    find tts_service/audio/temp -name "*.wav" -mtime +1 -delete 2>/dev/null || true
fi

# Очищаем старые логи (старше 30 дней)
echo "📋 Очищаем старые логи..."
find . -name "*.log" -mtime +30 -delete 2>/dev/null || true

# Очищаем старые бэкапы (старше 7 дней, оставляем последние 5)
echo "💾 Очищаем старые бэкапы..."
if [ -d "bot_service/backups" ]; then
    cd bot_service/backups
    ls -t backup_*.db 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    find . -name "backup_*.db" -mtime +7 -delete 2>/dev/null || true
    cd - > /dev/null
fi

# Очищаем Docker мусор (если Docker установлен)
if command -v docker &> /dev/null; then
    echo "🐳 Очищаем Docker мусор..."
    docker system prune -f 2>/dev/null || true
    docker image prune -f 2>/dev/null || true
fi

# Проверяем размер проекта
echo "📊 Размер проекта после очистки:"
du -sh . 2>/dev/null || echo "Не удалось определить размер"

echo "✅ Очистка завершена!"
