# TTS_TTV

Платформа для стримеров с `bot_service`, dashboard, TTS, YouTube queue, drops и интеграциями.

## С чего начать

- [docs/QUICKSTART.md](docs/QUICKSTART.md) — быстрый локальный запуск
- [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — текущая архитектура и границы
- [docs/STATUS_TRACKER.md](docs/STATUS_TRACKER.md) — что стабильно, что ещё открыто
- [docs/README.md](docs/README.md) — индекс активной документации

## Кратко про архитектуру

- `frontend` общается только с `bot_service`
- `bot_service` — центральный backend, auth, orchestration и бизнес-логика
- `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm` — внешние TTS-сервисы
- browser TTS работает только через отдельную вкладку `/tts-player`

## Быстрый локальный запуск

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt

cd frontend
npm install
cd ..
```

Подготовь:

- `bot_service/.env`
- `frontend/.env`

Запуск:

```powershell
cd bot_service
alembic upgrade head
python main.py

cd ..\frontend
npm run dev
```

## Полезные команды

Гигиена базы данных:

```powershell
.\.venv\Scripts\python.exe bot_service\scripts\database_hygiene.py
```

Безопасное удаление пользователей:

```powershell
.\.venv\Scripts\python.exe bot_service\scripts\delete_users.py --list
```

Очистка репозитория перед commit или release:

```powershell
.\scripts\prepare-release.ps1
.\scripts\prepare-release.ps1 -ApplyCleanup
```

## Документация

В `docs/` лежит только активный короткий слой. История, аудиты, временные планы и снятые с поддержки заметки живут в `docs/backlog/`.

## Лицензия

MIT
