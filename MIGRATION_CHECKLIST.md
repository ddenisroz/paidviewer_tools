# ✅ Чеклист переноса на новую машину

## Перед переносом (старая машина)

- [ ] Сделать backup базы данных (если нужны данные)
  ```bash
  cp bot_service/data/bot_service.db backup_$(date +%Y%m%d).db
  ```
- [ ] Сохранить .env файлы в безопасное место
- [ ] Запушить последние изменения в Git
  ```bash
  git add -A
  git commit -m "backup before migration"
  git push
  ```

---

## На новой машине

### 1. Установить зависимости
- [ ] Python 3.10+ установлен
- [ ] Node.js 18+ установлен
- [ ] Git установлен
- [ ] PostgreSQL установлен (если используется)

### 2. Клонировать проект
- [ ] `git clone https://github.com/ddenisroz/twitch-tts-bot.git`
- [ ] `cd twitch-tts-bot`

### 3. Backend
- [ ] `cd bot_service`
- [ ] Скопировать .env с старой машины ИЛИ создать новый:
  - [ ] `cp .env.example .env`
  - [ ] Заполнить SECRET_KEY
  - [ ] Заполнить TOKEN_ENCRYPTION_KEY
  - [ ] Заполнить TWITCH_CLIENT_ID и SECRET
  - [ ] Заполнить VK_CLIENT_ID и SECRET
  - [ ] Проверить DATABASE_URL
- [ ] `pip install -r requirements.txt`
- [ ] Восстановить БД (если нужно):
  - [ ] Скопировать backup.db в `data/bot_service.db`
  - ИЛИ создать новую: `alembic upgrade head`
- [ ] Проверить запуск: `python main.py`

### 4. Frontend
- [ ] `cd frontend`
- [ ] `cp .env.example .env` (обычно defaults подходят)
- [ ] `npm install`
- [ ] Проверить запуск: `npm run dev`

### 5. Проверка
- [ ] Backend доступен: http://localhost:8000/health
- [ ] Frontend доступен: http://localhost:5173
- [ ] OAuth работает (войти через Twitch/VK)
- [ ] WebSocket подключается (видны сообщения чата)
- [ ] TTS работает (озвучивает сообщения)

---

## Production deployment

### Дополнительно для production:
- [ ] Обновить ENVIRONMENT=production в .env
- [ ] Обновить BACKEND_URL и FRONTEND_URL
- [ ] Настроить PostgreSQL (если не SQLite)
- [ ] Обновить OAuth Redirect URIs на production URL
- [ ] Настроить Nginx (если нужен)
- [ ] Настроить SSL сертификаты
- [ ] Запустить через Docker: `docker-compose -f docker-compose.prod.yml up -d`

---

## Что переносить

### ✅ Обязательно:
- Весь код (через git clone)
- .env файлы (вручную, НЕ коммитить в git!)

### ⚠️ Опционально:
- База данных (data/*.db) - если нужны старые данные
- Логи (logs/) - если нужна история

### ❌ НЕ переносить:
- node_modules/ - установится через npm install
- __pycache__/ - создастся автоматически
- .venv/ - создать новое окружение
- temp/ - временные файлы

---

## Troubleshooting

### Backend не запускается:
- [ ] Проверить Python версию: `python --version` (должен быть 3.10+)
- [ ] Проверить .env существует: `ls -la bot_service/.env`
- [ ] Проверить зависимости: `pip list | grep fastapi`
- [ ] Проверить БД: `ls -la bot_service/data/`

### Frontend не запускается:
- [ ] Проверить Node версию: `node --version` (должен быть 18+)
- [ ] Проверить .env существует: `ls -la frontend/.env`
- [ ] Очистить кэш: `rm -rf node_modules package-lock.json && npm install`

### OAuth не работает:
- [ ] Проверить Client ID и Secret в .env
- [ ] Проверить Redirect URI в настройках приложения (должен совпадать с BACKEND_URL)
- [ ] Проверить CORS_ORIGINS включает FRONTEND_URL

---

## Время выполнения

- Установка зависимостей: ~5 минут
- Настройка .env: ~5 минут
- Проверка работы: ~5 минут

**Итого:** ~15 минут

---

**Готово!** Проект перенесен на новую машину ✅
