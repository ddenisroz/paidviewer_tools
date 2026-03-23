# Быстрый запуск

Если сначала нужно понять структуру репозитория, открой [REPO_STRUCTURE.md](REPO_STRUCTURE.md). Если нужно понять текущее состояние проекта, открой [STATUS_TRACKER.md](STATUS_TRACKER.md).

## Требования

- Python 3.10+
- Node.js 22+
- PostgreSQL
- для полного TTS-контура дополнительно:
  - `tts-gateway`
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`

## 1. Подготовь репозиторий

```powershell
git clone <repo>
cd paidviewer_tools
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2. Установи зависимости

```powershell
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt

cd frontend
npm install
cd ..
```

## 3. Подготовь `.env`

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

## 4. Прогони миграции

```powershell
cd bot_service
alembic upgrade head
cd ..
```

## 5. Запусти сервисы

```powershell
# Терминал 1
cd bot_service
python main.py

# Терминал 2
cd frontend
npm run dev
```

## 6. Проверь базовый контур

1. Открой `http://localhost:5173`
2. Проверь backend: `http://localhost:8000/health`
3. Если подключён внешний TTS-контур:
   - `http://localhost:8000/api/tts/health?provider=f5`
   - `http://localhost:8000/api/tts/health?provider=qwen`

## 7. Если нужен live smoke TTS

Читай:

- [setup/LOCAL_TTS_INTEGRATION.md](setup/LOCAL_TTS_INTEGRATION.md)
- [setup/LIVE_SMOKE_RUNBOOK.md](setup/LIVE_SMOKE_RUNBOOK.md)
- [setup/LIVE_SMOKE_BEGINNER_GUIDE_RU.md](setup/LIVE_SMOKE_BEGINNER_GUIDE_RU.md)

## Очистка перед отгрузкой

Preview:

```powershell
.\scripts\prepare-release.ps1
```

Очистка:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup
```
