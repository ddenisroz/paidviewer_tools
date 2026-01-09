# TTS_TTV Quickstart 🚀

**Время на запуск: 5-10 минут**

---

## Что это?

Сервис для стримеров: TTS-озвучка чата, YouTube-очередь, система баллов, интеграции с Twitch/VK.

---

## 1. Требования

- **Python 3.10+**
- **Node.js 18+**
- **PostgreSQL** (или SQLite для тестов)
- **GPU** (опционально, для F5-TTS)

---

## 2. Быстрый запуск

```powershell
# Клонируй проект
git clone <repo>
cd TTS_TTV_0.02

# Запусти скрипт миграции (создаёт venv, устанавливает зависимости)
.\scripts\migrate.ps1   # Windows
# или
./scripts/migrate.sh    # Linux/Mac
```

---

## 3. Настройка .env

Скопируй примеры и заполни:

```powershell
# Backend
cp bot_service/.env.example bot_service/.env

# Frontend (обычно не требует изменений)
cp frontend/.env.example frontend/.env
```

**Обязательные поля в `bot_service/.env`:**

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL строка подключения |
| `SECRET_KEY` | Сгенерируй: `openssl rand -hex 32` |
| `TWITCH_CLIENT_ID` | Из [Twitch Developer Console](https://dev.twitch.tv/) |
| `TWITCH_CLIENT_SECRET` | Там же |

---

## 4. Запуск сервисов

### Вариант A: Development (раздельно)

```powershell
# Terminal 1 — Backend
cd bot_service
.\.venv\Scripts\activate
python main.py
# → http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm run dev
# → http://localhost:5173
```

### Вариант B: Docker (production-ready)

```bash
docker-compose up -d
# → http://localhost:5173
```

---

## 5. Первый запуск

1. Открой http://localhost:5173
2. Нажми **"Войти через Twitch"**
3. Дай права боту
4. Готово! Включи TTS в настройках

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| `ModuleNotFoundError` | Активируй venv: `.\.venv\Scripts\activate` |
| `Connection refused` | Проверь что PostgreSQL запущен |
| TTS не работает | Проверь `TTS_SERVICE_URL` в .env |
| OAuth redirect error | Проверь `REDIRECT_URI` в Twitch Console |

---

## Полезные ссылки

- **Документация:** [docs/README.md](./README.md)
- **API Reference:** [docs/api/](./api/)
- **Архитектура:** [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- **Деплой:** [docs/setup/DEPLOYMENT.md](./setup/DEPLOYMENT.md)

---

**Нужна помощь?** Создай Issue в репозитории или загляни в [TTS_TROUBLESHOOTING.md](./guides/TTS_TROUBLESHOOTING.md)
