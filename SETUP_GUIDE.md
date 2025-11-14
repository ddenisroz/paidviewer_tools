# 🚀 Быстрая установка на новой машине

**Время:** 10-15 минут

---

## 1. Требования

- Python 3.10+
- Node.js 18+
- PostgreSQL (или SQLite для dev)
- Git

---

## 2. Клонирование

```bash
git clone https://github.com/ddenisroz/twitch-tts-bot.git
cd twitch-tts-bot
```

---

## 3. Backend Setup

### 3.1 Создать .env
```bash
cd bot_service
cp .env.example .env
```

### 3.2 Заполнить обязательные переменные в .env:

```bash
# Сгенерировать секреты
openssl rand -hex 32  # → SECRET_KEY
openssl rand -hex 32  # → JWT_SECRET_KEY (можно тот же)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # → TOKEN_ENCRYPTION_KEY

# Вставить в .env:
SECRET_KEY="сгенерированный_ключ"
TOKEN_ENCRYPTION_KEY="сгенерированный_ключ"

# OAuth credentials (получить на сайтах):
TWITCH_CLIENT_ID="..."
TWITCH_CLIENT_SECRET="..."
VK_CLIENT_ID="..."
VK_CLIENT_SECRET="..."

# Database (для dev можно оставить SQLite)
DATABASE_URL=sqlite:///./data/bot_service.db
```

### 3.3 Установить зависимости
```bash
pip install -r requirements.txt
```

### 3.4 Инициализировать БД
```bash
alembic upgrade head
```

---

## 4. Frontend Setup

### 4.1 Создать .env
```bash
cd ../frontend
cp .env.example .env
```

### 4.2 Проверить .env (обычно defaults подходят):
```bash
VITE_BOT_SERVICE_URL=http://localhost:8000
VITE_TTS_SERVICE_URL=http://localhost:8001
VITE_BOT_SERVICE_WS_URL=ws://localhost:8000
VITE_FRONTEND_URL=http://localhost:5173
```

### 4.3 Установить зависимости
```bash
npm install
```

---

## 5. Запуск

### Терминал 1 - Backend:
```bash
cd bot_service
python main.py
```
✅ Должен запуститься на http://localhost:8000

### Терминал 2 - Frontend:
```bash
cd frontend
npm run dev
```
✅ Должен запуститься на http://localhost:5173

---

## 6. Первый вход

1. Открыть http://localhost:5173
2. Нажать "Войти через Twitch" или "Войти через VK"
3. Авторизоваться
4. Готово! 🎉

---

## 7. Получение OAuth credentials

### Twitch:
1. https://dev.twitch.tv/console/apps
2. "Register Your Application"
3. OAuth Redirect URLs: `http://localhost:8000/auth/twitch/callback`
4. Скопировать Client ID и Client Secret

### VK Live:
1. https://vk.com/apps?act=manage
2. Создать приложение
3. Redirect URI: `http://localhost:8000/auth/vk/callback`
4. Скопировать Client ID и Client Secret

### YouTube (опционально):
1. https://console.cloud.google.com/apis/credentials
2. Создать API Key
3. Включить YouTube Data API v3

### DonationAlerts (опционально):
1. https://www.donationalerts.com/application/clients
2. Создать приложение
3. Redirect URI: `http://localhost:8000/auth/donationalerts/callback`

---

## 8. Production Deployment

### 8.1 Обновить .env для production:
```bash
ENVIRONMENT=production
DEBUG=false
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### 8.2 Обновить OAuth Redirect URIs:
- Twitch: `https://api.yourdomain.com/auth/twitch/callback`
- VK: `https://api.yourdomain.com/auth/vk/callback`

### 8.3 Запустить через Docker:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 9. Проверка работы

### Backend:
```bash
curl http://localhost:8000/health
# Должен вернуть: {"status":"healthy"}
```

### Frontend:
Открыть http://localhost:5173 - должна загрузиться страница

### WebSocket:
После входа в систему - должны приходить сообщения из чата

---

## 10. Troubleshooting

### Backend не запускается:
```bash
# Проверить .env
cat bot_service/.env | grep SECRET_KEY

# Проверить БД
cd bot_service
alembic current
```

### Frontend не запускается:
```bash
# Проверить .env
cat frontend/.env

# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install
```

### OAuth не работает:
1. Проверить Client ID и Secret в .env
2. Проверить Redirect URI в настройках приложения
3. Проверить что BACKEND_URL правильный

---

## 11. Структура .env файлов

### Минимальный bot_service/.env:
```bash
SECRET_KEY="..."
TOKEN_ENCRYPTION_KEY="..."
DATABASE_URL=sqlite:///./data/bot_service.db
TWITCH_CLIENT_ID="..."
TWITCH_CLIENT_SECRET="..."
VK_CLIENT_ID="..."
VK_CLIENT_SECRET="..."
```

### Минимальный frontend/.env:
```bash
VITE_BOT_SERVICE_URL=http://localhost:8000
VITE_BOT_SERVICE_WS_URL=ws://localhost:8000
VITE_FRONTEND_URL=http://localhost:5173
```

---

## 12. Полезные команды

```bash
# Backend
cd bot_service
python main.py                    # Запуск
alembic upgrade head              # Обновить БД
alembic revision --autogenerate   # Создать миграцию

# Frontend
cd frontend
npm run dev                       # Запуск dev
npm run build                     # Сборка для production
npm run preview                   # Просмотр production сборки

# Database
cd bot_service
python -c "from core.database import init_db; init_db()"  # Инициализация
```

---

## 13. Что НЕ нужно переносить

❌ `node_modules/` - установится через npm install
❌ `__pycache__/` - создастся автоматически
❌ `.venv/` - создать новое виртуальное окружение
❌ `data/*.db` - создастся через alembic
❌ `logs/` - создастся автоматически

---

## 14. Что НУЖНО переносить

✅ `.env` файлы (с вашими credentials)
✅ `data/*.db` (если хотите сохранить данные)
✅ Весь остальной код

---

## Готово! 🎉

Проект должен работать на новой машине.

**Проблемы?** Проверьте:
1. Все ли зависимости установлены
2. Правильно ли заполнены .env файлы
3. Запущена ли БД (если PostgreSQL)
4. Доступны ли порты 8000 и 5173

---

**Версия:** 0.03  
**Дата:** 15 ноября 2025
