#!/bin/bash

# Скрипт для быстрого обновления проекта

set -e

echo "🔄 Обновление TTS-приложения..."

# Проверяем, что мы в git репозитории
if [ ! -d ".git" ]; then
    echo "❌ Не найден git репозиторий!"
    exit 1
fi

# Показываем текущий статус
echo "📊 Текущий статус:"
git status --porcelain

# Предлагаем сохранить изменения
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Есть несохраненные изменения!"
    read -p "Сохранить их в commit? (y/n): " save_changes
    
    if [ "$save_changes" = "y" ]; then
        read -p "Введите описание изменений: " commit_message
        git add .
        git commit -m "$commit_message"
        echo "✅ Изменения сохранены"
    fi
fi

# Получаем последние изменения
echo "📥 Получаем обновления с сервера..."
git fetch origin

# Показываем что изменилось
echo "📋 Новые изменения:"
git log HEAD..origin/main --oneline || echo "Нет новых изменений"

# Предлагаем обновиться
read -p "Применить обновления? (y/n): " apply_updates

if [ "$apply_updates" = "y" ]; then
    # Обновляем код
    git pull origin main
    
    # Проверяем, есть ли изменения в зависимостях
    if git diff HEAD~1 HEAD --name-only | grep -E "(requirements\.txt|package\.json)" > /dev/null; then
        echo "📦 Обнаружены изменения в зависимостях"
        
        # Обновляем Python зависимости
        if git diff HEAD~1 HEAD --name-only | grep "requirements.txt" > /dev/null; then
            echo "🐍 Обновляем Python зависимости..."
            if [ -d "bot_service" ]; then
                cd bot_service && pip install -r requirements.txt && cd ..
            fi
            if [ -d "tts_service" ]; then
                cd tts_service && pip install -r requirements.txt && cd ..
            fi
        fi
        
        # Обновляем Node.js зависимости
        if git diff HEAD~1 HEAD --name-only | grep "package.json" > /dev/null; then
            echo "📦 Обновляем Node.js зависимости..."
            cd frontend && npm install && cd ..
        fi
    fi
    
    # Проверяем, нужно ли перезапустить сервисы
    echo "🔄 Нужно ли перезапустить сервисы?"
    echo "1. Только frontend (если изменения только в UI)"
    echo "2. Только backend (если изменения только в API)"
    echo "3. Все сервисы (если изменения везде)"
    echo "4. Ничего не перезапускать"
    
    read -p "Выберите опцию (1-4): " restart_option
    
    case $restart_option in
        1)
            echo "🔄 Перезапускаем frontend..."
            if [ -f "docker-compose.prod.yml" ]; then
                docker-compose -f docker-compose.prod.yml restart frontend
            else
                echo "Перезапустите frontend вручную"
            fi
            ;;
        2)
            echo "🔄 Перезапускаем backend..."
            if [ -f "docker-compose.prod.yml" ]; then
                docker-compose -f docker-compose.prod.yml restart bot_service
            else
                echo "Перезапустите bot_service вручную"
            fi
            ;;
        3)
            echo "🔄 Перезапускаем все сервисы..."
            if [ -f "docker-compose.prod.yml" ]; then
                docker-compose -f docker-compose.prod.yml restart
            else
                echo "Перезапустите все сервисы вручную"
            fi
            ;;
        4)
            echo "⏭️ Пропускаем перезапуск"
            ;;
    esac
    
    echo "✅ Обновление завершено!"
    echo "🌐 Проверьте работу: https://$(grep DOMAIN .env.production 2>/dev/null | cut -d '=' -f2 || echo 'yourdomain.com')"
else
    echo "⏭️ Обновление отменено"
fi
