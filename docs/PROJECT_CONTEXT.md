# Контекст проекта

Последнее обновление: 2026-03-13

## Что это за репозиторий

Репозиторий содержит основной пользовательский продукт вокруг стримерских инструментов:

- `frontend` — dashboard и пользовательский интерфейс;
- `bot_service` — центральный backend, orchestration и бизнес-логика;
- внешние TTS-сервисы — `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`.

`frontend` общается только с `bot_service`. Прямые runtime URL внешних TTS-сервисов во frontend не допускаются.

## Актуальная модель TTS

В проекте поддерживаются три режима:

- `self-hosted endpoint` — пользователь сам поднимает TTS-сервис и подключает URL через настройки;
- `project-hosted worker` — отдельный внешний воркер под инфраструктурой проекта;
- `gateway-managed` — путь `bot_service -> tts-gateway -> project-hosted worker`.

Старые флаги `use_local`, `f5_local`, `qwen_local` пока сохранены только как совместимые имена для self-hosted режима.

## Провайдеры

- `f5`
  - managed synth: через `tts-gateway`;
  - self-hosted: поддерживается;
  - voice/admin CRUD: поддерживается через backend.
- `qwen`
  - managed synth: через `tts-gateway`;
  - self-hosted: работает через compatibility adapter;
  - voice/admin CRUD: пока `501`, если не задан `QWEN_VOICE_SERVICE_URL`.
- `gcloud`
  - встроенный backend fallback-путь.

## Auth и runtime-границы

- protected API использует cookie `session_id`;
- guest mode удалён из active runtime;
- browser TTS работает только через отдельную вкладку `/tts-player`;
- только одна активная вкладка `/tts-player` реально воспроизводит звук.

## База данных

- runtime и production работают на PostgreSQL;
- SQLite допустим только в тестах;
- orphan user-записи, legacy session-scoped хвосты и старые inactive sessions чистятся через `bot_service/scripts/database_hygiene.py`;
- точечное удаление пользователей делается через `bot_service/scripts/delete_users.py`.

## Что уже очищено

- frontend больше не ходит напрямую к TTS runtime;
- guest mode удалён из active runtime;
- active user-only слой не должен создавать новые session-scoped записи в `user_settings`, `tts_user_settings`, `local_tts_endpoints`, `filtered_words`, `tts_blocked_users`;
- YouTube queue переведён на user-only path в dashboard и runtime;
- active `drops` runtime переведён на user-only wrappers в bot, webhook и history entrypoints;
- `QueueHandlerMixin` — единственный активный путь для YouTube-команд `!sr`, `!skip`, `!clear`, `!queue`, `!wronglink`;
- голосование за `!skip` вынесено в `services/youtube/skip_vote_store.py`;
- пакет `bot_service/bots/command_handlers/*` больше не используется активным runtime.

## Что ещё открыто

- добить remaining compat-хвосты в dual-mode доменах;
- довести Qwen upstream до native parity;
- полностью пройти live smoke по всем topology-путям;
- продолжать сжимать active docs до короткого русского source of truth.
