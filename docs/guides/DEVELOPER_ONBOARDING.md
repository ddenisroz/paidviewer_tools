# Онбординг разработчика

Это короткий маршрут первого продуктивного дня в репозитории.

## Что читать по порядку

1. [README.md](../../README.md)
2. [docs/QUICKSTART.md](../QUICKSTART.md)
3. [docs/REPO_STRUCTURE.md](../REPO_STRUCTURE.md)
4. [docs/PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)
5. [docs/guides/DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

## Локальная настройка

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt
Copy-Item bot_service/.env.example bot_service/.env
cd bot_service
alembic upgrade head
python main.py
```

### Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

## Что проверить после старта

- backend: `http://localhost:8000/docs`
- frontend: `http://localhost:5173`
- backend tests: `cd bot_service; pytest -q`
- frontend checks: `cd frontend; npm run lint; npm run type-check`

## Чеклист первой правки

1. Уточни scope и затронутые сервисы.
2. Сделай минимальный change set.
3. Добавь или поправь тесты.
4. Прогони quality gates.
5. Обнови связанную документацию.

## Частые ошибки

- не возвращать guest mode;
- не доверять auth-данным из client path или query;
- не хардкодить локальные URL и порты;
- не коммитить кэши, build output и временные файлы.
