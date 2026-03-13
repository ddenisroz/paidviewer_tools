# Быстрый запуск

Если структура репозитория кажется неочевидной, сначала открой `docs/REPO_STRUCTURE.md`. Если перед изменениями нужно понять текущее состояние проекта, открой `docs/STATUS_TRACKER.md`.

## Требования

- Python 3.10+
- Node.js 22+
- PostgreSQL
- для полного TTS-контура дополнительно:
  - `tts-gateway`
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`

## 1. Подготовка репозитория

```powershell
git clone <repo>
cd TTS_TTV_0.02
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2. Установка зависимостей

```powershell
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt
cd frontend
npm install
cd ..
```

## 3. Настройка окружения

```powershell
Copy-Item bot_service/.env.example bot_service/.env
Copy-Item frontend/.env.example frontend/.env
```

Минимально для backend:

- `DATABASE_URL`
- `SECRET_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Если используешь внешний TTS-контур:

- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY`
- опционально `QWEN_VOICE_SERVICE_URL`

## 4. Миграции

```powershell
cd bot_service
alembic upgrade head
cd ..
```

## 5. Запуск

```powershell
# Терминал 1: backend
cd bot_service
python main.py

# Терминал 2: frontend
cd frontend
npm run dev
```

## 6. Внешний TTS-контур

Подробный runbook лежит в `docs/setup/LOCAL_TTS_INTEGRATION.md`.

Базовая схема портов:

```text
tts-gateway: 8010
f5-tts-service: 8011
nano-qwen3tts-vllm: 8000
bot_service: 8000
frontend: 5173
```

## 7. Проверка

1. Открой `http://localhost:5173`
2. Проверь backend: `http://localhost:8000/health`
3. Проверь provider health через backend:
   - `http://localhost:8000/api/tts/health?provider=f5`
   - `http://localhost:8000/api/tts/health?provider=qwen`
4. Авторизуйся и открой dashboard

## Troubleshooting

- `ModuleNotFoundError` — не активировано `.venv`
- ошибка БД — проверь `DATABASE_URL` и статус PostgreSQL
- OAuth redirect mismatch — проверь callback URL в консоли Twitch/VK
- проблемы с внешним TTS — смотри `docs/setup/LOCAL_TTS_INTEGRATION.md`

## Очистка workspace перед релизом

Preview:

```powershell
.\scripts\prepare-release.ps1
```

Очистка:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup
```

Очистка + проверки:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup -RunChecks
```