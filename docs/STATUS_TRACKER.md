# Статус проекта

Last updated: 2026-03-13

Это текущая handoff-сводка по проекту. Обновляй её после каждой заметной implementation-сессии.

## Общий статус

| Область | Статус | Комментарий |
|---|---|---|
| Backend TTS contract migration | Закрыто | `bot_service` использует strict API-key auth и provider-aware routing |
| Frontend API-boundary hardening | Закрыто | фронтенд больше не зависит от прямого `VITE_TTS_SERVICE_URL` |
| Qwen staged integration | Закрыто для текущей фазы | managed synth через gateway, self-hosted через compatibility adapter, voice CRUD = `501` |
| Docs/env/compose alignment | Закрыто для текущей фазы | активные документы и compose-контракт синхронизированы |
| Backend dependency split | Закрыто | runtime/dev/celery зависимости разделены |
| Guest-mode cleanup | Закрыто | active runtime больше не экспонирует guest mode |
| Safe selective user cleanup | Закрыто | есть preview + CLI для удаления пользователей |
| Database hygiene tooling | Закрыто для текущей фазы | есть preview/cleanup orphan rows и retention cleanup inactive sessions |
| Live smoke preflight tooling | Закрыто | есть runbook и env/preflight checks |
| Полный live smoke | Открыто | зависит от Redis, F5 assets и Qwen runtime |
| Frontend repo split | Не начато | границы подготовлены, но split ещё не выполнен |

## Что уже работает

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- `f5` voice CRUD через backend
- `qwen` voice CRUD возвращает явный `501`, если нет `QWEN_VOICE_SERVICE_URL`
- локальный TTS path сохраняет и использует `local_tts_endpoints.api_key`
- frontend health checks идут только через backend
- safe user deletion через `bot_service/scripts/delete_users.py`
- database hygiene через `bot_service/scripts/database_hygiene.py`

## Проверенные команды

| Команда | Результат |
|---|---|
| `pytest -q tests/test_user_cleanup_service.py` | passed |
| `pytest -q tests/test_database_cleanup_core.py` | passed |
| `docker compose -f deploy/docker/docker-compose.dev.yml config -q` | passed |
| `docker compose -f deploy/docker/docker-compose.bot.yml config -q` | passed с предупреждениями по unset vars |
| `npm run type-check` | passed |
| `npm run check:no-direct-tts-url` | passed |
| `npm run build` | passed |

## Открытые задачи

| Задача | Приоритет | Комментарий |
|---|---|---|
| Полный local smoke для `gateway + redis + f5 + bot_service + frontend` | Высокий | нужен живой внешний контур |
| Удаление remaining legacy `session_id` compat tails | Высокий | migration plan в `docs/backlog/SESSION_ID_LEGACY_REMOVAL_PLAN_2026-03-13.md` |
| Native parity для Qwen upstream | Высокий | задачи в `docs/backlog/QWEN_UPSTREAM_PARITY_TASKS_2026-03-12_RU.md` |
| Проверка synth через gateway для `f5` и `qwen` | Высокий | зависит от живых upstream-сервисов |
| F5 voice CRUD end-to-end | Высокий | нужен рабочий F5 runtime |
| Split frontend в отдельный repo | Средний | архитектурно подготовлено, организационно ещё нет |

## Жёсткие контракты

- Frontend runtime общается только с `bot_service` API/WS.
- Нельзя возвращать прямое runtime-использование `VITE_TTS_SERVICE_URL`.
- Provider voice catalog остаётся provider-owned.
- Для TTS upstreams используется strict API-key auth.
- Любой будущий Qwen voice service должен сохранять текущие frontend API paths через `bot_service`.

## Рекомендуемая следующая последовательность

1. Прогнать `scripts/dev/tts-smoke-preflight.ps1`.
2. Поднять Redis, `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`, `bot_service`, `frontend`.
3. Проверить provider health через backend.
4. Прогнать synth для `f5` и `qwen` через gateway.
5. Прогнать F5 voice CRUD через `bot_service`.
6. Закрывать Qwen native parity отдельной фазой в upstream.