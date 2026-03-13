# Руководство разработчика

Это короткий набор стабильных инженерных правил.

## Границы системы

- `bot_service/` — backend, auth, services, repositories, models
- `frontend/` — React + Vite UI
- `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm` — внешние TTS upstream-сервисы
- `deploy/` — compose и deployment assets

## Зависимости

- `bot_service/requirements.txt` — runtime backend
- `bot_service/requirements_dev.txt` — dev/test/tooling поверх runtime
- `bot_service/requirements_celery.txt` — optional celery extras
- `bot_service/requirements_no_torch.txt` — legacy alias на runtime requirements

## Нельзя ломать

- user OAuth:
  - `/auth/twitch/login`
  - `/auth/vk/login`
  - `/auth/twitch/callback`
  - `/auth/vk/callback`
- cookie-based auth через `session_id`
- источник admin-прав — `users.role = 'admin'`
- real-time sync через WebSocket
- single-leader логика shared WebSocket между вкладками
- browser TTS только через `/tts-player`

## Правила backend

- роуты должны оставаться тонкими;
- логика живёт в `services/`;
- доступ к БД идёт через `repositories/`;
- секреты, токены и пароли не логируются;
- новые guest или anonymous auth flows не добавляются.

## Правила frontend

- UI не ходит напрямую к TTS runtime;
- сетевые вызовы держим в service/query слое;
- не плодим дублирующие запросы;
- используем semantic design tokens вместо случайных цветов.

## Quality gates

### Backend

```powershell
cd bot_service
ruff check .
pytest -q
```

### Frontend

```powershell
cd frontend
npm run lint
npm run type-check
npm run build
```

## Repo hygiene

Перед PR, который готовит отгрузку:

- очистить generated caches и artifacts;
- убедиться, что нет временных файлов;
- обновить документацию, если менялся контракт или поведение.

```powershell
.\scripts\prepare-release.ps1
.\scripts\prepare-release.ps1 -ApplyCleanup
```
