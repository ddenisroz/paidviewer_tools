# Контекст проекта

Last updated: 2026-03-13

Этот файл нужен как короткий актуальный снимок проекта перед крупными изменениями.

## Что читать сначала

- `docs/STATUS_TRACKER.md`
- `docs/setup/LOCAL_TTS_INTEGRATION.md`
- `docs/setup/LIVE_SMOKE_RUNBOOK.md`
- `docs/setup/REPO_SPLIT_GUIDE.md`
- `docs/setup/DOCKER_DEPLOYMENT.md`
- `docs/architecture/TTS_ARCHITECTURE.md`

## Текущая стадия

- Контракт `frontend -> bot_service -> external TTS upstreams` внедрён.
- Runtime работает только для авторизованных пользователей. Guest mode удалён.
- `frontend` готовится к split, но пока остаётся в этом репозитории.
- `docker compose config -q` уже зелёный для `dev` и `bot`.
- Полный live smoke всё ещё зависит от внешних prereq:
  - Redis для `tts-gateway`
  - vendor/assets/weights для `f5-tts-service`
  - Linux/WSL2 runtime для `nano-qwen3tts-vllm`

## Актуальная TTS-модель

- `tts-gateway` — основной orchestrator для advanced synthesis.
- `f5` и `qwen` живут как внешние upstream-сервисы.
- `gcloud` остаётся встроенным managed fallback.

## Термины topology

- `self-hosted endpoint` — пользователь сам поднимает TTS-сервис и сохраняет свой URL в `local_tts_endpoints`.
- `project-hosted worker` — отдельный worker под инфраструктурой проекта.
- `gateway-managed` — `bot_service -> tts-gateway -> project-hosted workers`.

Флаги `use_local`, `f5_local`, `qwen_local` — это legacy naming для self-hosted режима и пока сохраняются.

## Текущий контракт провайдеров

- `f5`
  - managed synth: сначала через gateway
  - self-hosted: поддерживается
  - voice/admin CRUD: поддерживается через backend

- `qwen`
  - managed synth: через gateway
  - self-hosted: работает через compatibility adapter
  - voice/admin CRUD: пока `501`, пока не настроен `QWEN_VOICE_SERVICE_URL`

## Политика БД

- Runtime и production БД — PostgreSQL.
- SQLite допустим только в тестовом контуре.
- Orphan user-записи и старые inactive sessions чистятся через `bot_service/scripts/database_hygiene.py`.

## Важные ограничения

- Frontend должен общаться только с `bot_service` API/WS.
- Нельзя возвращать прямое runtime-использование `VITE_TTS_SERVICE_URL`.
- Upstream TTS auth — strict API-key (`Authorization` + `X-API-Key`).
- TTS blocked-users валидируют существование целевого пользователя.

## Что уже закрыто

- безопасное selective удаление пользователей через `bot_service/scripts/delete_users.py`
- preview и cleanup orphan user-записей и inactive sessions через `bot_service/scripts/database_hygiene.py`
- background cleanup inactive sessions использует ту же retention-логику

## Что ещё остаётся

- добить legacy `session_id` хвосты в dual-mode таблицах
- довести Qwen upstream до native parity
- пройти полный live smoke контур
- завершить docs и release hygiene