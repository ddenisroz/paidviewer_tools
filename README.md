# TTS_TTV

Платформа для стримеров: dashboard, `bot_service`, TTS-интеграции, YouTube queue, drops, DonationAlerts, MemeAlerts и сопутствующие инструменты.

## С чего начать

- [docs/QUICKSTART.md](docs/QUICKSTART.md) — быстрый локальный запуск.
- [docs/STATUS_TRACKER.md](docs/STATUS_TRACKER.md) — текущее состояние проекта и что ещё открыто.
- [docs/README.md](docs/README.md) — индекс актуальной документации.
- [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — короткий снимок текущей архитектуры.
- [docs/setup/DEPLOYMENT.md](docs/setup/DEPLOYMENT.md) — активный контракт деплоя.
- [docs/architecture/ARCHITECTURE_GUIDE.md](docs/architecture/ARCHITECTURE_GUIDE.md) — архитектурная карта проекта.

## Быстрый локальный запуск

1. Создай и активируй виртуальное окружение:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Установи зависимости:

```powershell
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt
cd frontend
npm install
cd ..
```

3. Подготовь `.env`:

- `bot_service/.env`
- `frontend/.env`

Минимум для backend:
- `DATABASE_URL`
- `SECRET_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Если поднимаешь внешний TTS-контур:
- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY`
- опционально `QWEN_VOICE_SERVICE_URL`

4. Прогони миграции:

```powershell
cd bot_service
alembic upgrade head
cd ..
```

5. Запусти сервисы:

```powershell
# backend
cd bot_service
python main.py

# frontend
cd frontend
npm run dev
```

## Ключевой runtime-контракт

- `frontend` общается только с `bot_service`.
- Продвинутый TTS для `f5` и `qwen` идёт через внешние upstream-сервисы.
- Прямое runtime-использование `VITE_TTS_SERVICE_URL` не допускается.
- Browser TTS работает через отдельную вкладку `/tts-player`.

## Очистка перед коммитом и релизной отгрузкой

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

## База данных и maintenance

- Безопасное удаление пользователей: `bot_service/scripts/delete_users.py`
- Гигиена БД: `bot_service/scripts/database_hygiene.py`
- Maintenance-справка: `bot_service/scripts/README_MAINTENANCE.md`

## Лицензия

MIT