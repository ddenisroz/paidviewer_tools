# Быстрый запуск

Если нужен только минимальный рабочий контур, подними `bot_service` и `frontend`. Расширенный TTS smoke и релизные проверки смотри в `LIVE_SMOKE_RUNBOOK.md` и `RELEASE_CHECKLIST.md`.

## Требования

- Python 3.11+
- Node.js 20+
- PostgreSQL
- для cloud TTS дополнительно:
  - `tts-gateway`
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`

## 1. Подготовь репозиторий

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt
```

```powershell
cd frontend
npm install
cd ..
```

## 2. Подготовь env

```powershell
Copy-Item bot_service/.env.example bot_service/.env
Copy-Item frontend/.env.example frontend/.env
```

Минимум для backend:

- `DATABASE_URL`
- `SECRET_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Если нужен cloud TTS:

- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY`

## 3. Прогони миграции

```powershell
cd bot_service
alembic upgrade head
cd ..
```

## 4. Запусти сервисы

```powershell
# Терминал 1
cd bot_service
python main.py

# Терминал 2
cd frontend
npm run dev
```

## 5. Проверь базовый контур

1. Открой `http://localhost:5173`
2. Проверь backend: `http://localhost:8000/health`
3. Если подключён cloud TTS:
   - `http://localhost:8000/api/tts/health?provider=f5`
   - `http://localhost:8000/api/tts/health?provider=qwen`

## 6. Перед релизом

- [release/RELEASE_CHECKLIST.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/release/RELEASE_CHECKLIST.md)
- [setup/LIVE_SMOKE_RUNBOOK.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/setup/LIVE_SMOKE_RUNBOOK.md)
- [setup/TTS_SUPPORT_RUNBOOK.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/setup/TTS_SUPPORT_RUNBOOK.md)
