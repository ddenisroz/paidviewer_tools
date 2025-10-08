#!/bin/bash

# Скрипт для быстрой настройки среды разработки

set -e

echo "🛠️ Настройка среды разработки..."

# Проверяем зависимости
echo "🔍 Проверяем зависимости..."

# Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден! Установите Python 3.11+"
    exit 1
fi

# Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден! Установите Node.js 18+"
    exit 1
fi

# Git
if ! command -v git &> /dev/null; then
    echo "❌ Git не найден! Установите Git"
    exit 1
fi

echo "✅ Все зависимости найдены"

# Настройка Python окружений
echo "🐍 Настройка Python окружений..."

# Bot Service
if [ -d "bot_service" ]; then
    echo "📦 Настройка bot_service..."
    cd bot_service
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate
    pip install -r requirements.txt
    cd ..
fi

# TTS Service  
if [ -d "tts_service" ]; then
    echo "🎤 Настройка tts_service..."
    cd tts_service
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate
    pip install -r requirements.txt
    cd ..
fi

# Frontend
echo "⚛️ Настройка frontend..."
if [ -d "frontend" ]; then
    cd frontend
    npm install
    cd ..
fi

# Создание .env файлов для разработки
echo "⚙️ Настройка конфигурации..."

# Bot service env
if [ ! -f "bot_service/.env" ] && [ -f "bot_service/env.example" ]; then
    cp bot_service/env.example bot_service/.env
    echo "📝 Создан bot_service/.env из примера"
fi

# Frontend env
if [ ! -f "frontend/.env" ] && [ -f "frontend/env.example" ]; then
    cp frontend/env.example frontend/.env
    echo "📝 Создан frontend/.env из примера"
fi

# Git hooks для удобства
echo "🪝 Настройка Git hooks..."
mkdir -p .git/hooks

# Pre-commit hook для проверки кода
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Проверяем код перед коммитом..."

# Проверяем, что нет console.log в продакшен коде
if git diff --cached --name-only | grep -E '\.(js|jsx|ts|tsx)$' | xargs grep -l 'console\.log' 2>/dev/null; then
    echo "⚠️  Найдены console.log в коммите!"
    echo "Замените на logger.debug() или удалите"
    exit 1
fi

# Проверяем, что нет секретов
if git diff --cached | grep -E '(password|secret|key|token).*=.*[a-zA-Z0-9]{10,}'; then
    echo "⚠️  Возможно, вы коммитите секретные данные!"
    echo "Проверьте изменения и используйте .env файлы"
    exit 1
fi

echo "✅ Проверка пройдена"
EOF

chmod +x .git/hooks/pre-commit

# Создание алиасов для удобства
echo "🔗 Создание удобных команд..."

# Создаем package.json в корне для npm scripts
cat > package.json << 'EOF'
{
  "name": "tts-project",
  "version": "1.0.0",
  "scripts": {
    "dev:frontend": "cd frontend && npm run dev",
    "dev:bot": "cd bot_service && python main.py",
    "dev:tts": "cd tts_service && python main.py",
    "build": "cd frontend && npm run build",
    "update": "./update.sh",
    "deploy": "./deploy.sh",
    "logs": "docker-compose -f docker-compose.prod.yml logs -f",
    "status": "docker-compose -f docker-compose.prod.yml ps"
  }
}
EOF

echo "✅ Среда разработки настроена!"
echo ""
echo "🚀 Быстрые команды:"
echo "  npm run dev:frontend  - Запуск frontend в dev режиме"
echo "  npm run dev:bot       - Запуск bot service"
echo "  npm run dev:tts       - Запуск TTS service"
echo "  npm run build         - Сборка frontend"
echo "  npm run update        - Обновление проекта"
echo "  npm run deploy        - Деплой в продакшен"
echo "  npm run logs          - Просмотр логов"
echo ""
echo "📝 Не забудьте:"
echo "  1. Заполнить .env файлы реальными значениями"
echo "  2. Настроить интеграции (Twitch, VK, YouTube)"
echo "  3. Проверить работу всех сервисов"
