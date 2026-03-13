# Developer guide

Этот документ фиксирует стабильные инженерные контракты для ежедневной разработки.

## Границы runtime

- `bot_service/` — FastAPI API, auth, services, repositories, models
- `frontend/` — React + Vite UI
- внешние upstream-сервисы:
  - `tts-gateway`
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`
- `deploy/` — compose и инфраструктурные файлы

## Манифесты зависимостей

- `bot_service/requirements.txt` — только runtime backend
- `bot_service/requirements_dev.txt` — dev/test/tooling поверх runtime
- `bot_service/requirements_celery.txt` — runtime + optional celery extras
- `bot_service/requirements_no_torch.txt` — legacy alias на runtime requirements

## Обязательные auth-контракты

1. User OAuth entrypoints:
   - `/auth/twitch/login`
   - `/auth/vk/login` и alias `/auth/vk`
2. User OAuth callbacks:
   - `/auth/twitch/callback`
   - `/auth/vk/callback`
3. Session auth — cookie-based (`session_id`)
4. Source of truth для protected API — состояние пользователя в БД
5. Admin authority — `users.role = 'admin'`
6. Guest mode удалён и не должен возвращаться

## Bot OAuth-контракт

1. Login endpoints:
   - `/auth/twitch/bot/login`
   - `/auth/vk/bot/login`
2. Callback endpoints:
   - `/auth/twitch/bot/callback`
   - `/auth/vk/bot/callback`
3. Bot login требует admin session или short-lived `bot_oauth_token`
4. Runtime bot tokens читаются из БД, а не из legacy env fallback

## WebSocket-контракт

1. Real-time sync использует WebSocket, а не SSE
2. Frontend держит один leader socket на пользователя между вкладками
3. Browser TTS playback работает через отдельную вкладку `/tts-player`
4. Sink-aware TTS поведение нельзя ломать:
   - website mode требует активную вкладку `/tts-player`
   - OBS mode требует активный OBS socket

## Правила backend

1. Роуты остаются тонкими, логика живёт в `services/`
2. Работа с БД идёт через `repositories/`
3. Ошибки async-задач обрабатываются явно
4. Валидация запросов должна быть строгой
5. Нельзя логировать секреты, токены и пароли

## Правила frontend

1. API-вызовы держим в service/query-слое
2. Не плодим дублирующие запросы
3. Сохраняем single-leader WebSocket logic
4. В UI используем semantic design tokens, а не случайные цвета

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

Canonical cleanup:

```powershell
.\scripts\prepare-release.ps1
.\scripts\prepare-release.ps1 -ApplyCleanup
```

Перед release-oriented PR:
- удалить generated caches и artifacts
- убедиться, что нет временных файлов
- обновить docs, если менялся контракт или поведение