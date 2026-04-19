# Контекст проекта

Последнее обновление: 2026-04-05

## Что это за репозиторий

Это основной продуктовый репозиторий Paidviewer для стримеров:

- `frontend` — пользовательский кабинет, OBS-related screens и админ-центр
- `bot_service` — центральный backend: авторизация, настройки, orchestration, бизнес-логика
- `tts_worker_agent` — официальный self-host runtime

Внешний cloud TTS-контур живёт в отдельных репозиториях:

- `tts-gateway`
- `f5-tts-service`
- `nano-qwen3tts-vllm`

`frontend` общается только с `bot_service`. Прямые обращения из frontend к внешним TTS runtime не считаются рабочим контрактом.

## Базовый runtime standard

- Python `3.12` для `paidviewer_tools`, `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`
- Node.js `20+` для `frontend`
- PostgreSQL и Redis обязательны для runtime

## Как сейчас устроен TTS

Официальных пользовательских режимов только два:

- `cloud` — `frontend -> bot_service -> tts-gateway -> provider runtime`
- `self_host` — `frontend -> bot_service -> provisioning/pairing -> tts_worker_agent -> local runtime`

Что важно:

- `tts_worker_agent` — основной self-host путь для обоих провайдеров
- raw endpoint сохранён только как compatibility fallback для поддержки и диагностики
- источник истины для routing и UI-поведения — backend status/health/capability contract

## Провайдеры

- `f5`
  - cloud и self-host используют тот же mode-first orchestration-контур, что и `qwen`
  - voice management поддерживается через backend/admin routes
- `qwen`
  - cloud и self-host идут через тот же orchestration-path
  - различия живут в provider adapter и capability flags
  - `QWEN_VOICE_STORAGE_DIR` должен жить в persistent volume
  - для Windows операторов штатный runtime-путь — Linux/WSL2
- `gcloud`
  - встроенный provider path внутри `bot_service`

## Платформы

- `Twitch` — GA-контур
- `VK Live` — GA-контур в единой capability-модели с Twitch

Для VK сейчас ожидается:

- `roles=true`
- `badges=true`
- `reply_context=true`
- `mention_context=true`
- `rewards=true`
- `bot_status=true`
- `moderation_actions=false`

Поддерживаемые VK роли в продуктовой модели: `owner`, `moderator`, `viewer`.

## Админка

Активный admin shell теперь только один:

- `/dashboard/admin`

Вкладки админки:

- `Overview`
- `Runtime`
- `TTS`
- `Accounts`
- `Channels`
- `Logs`

Legacy admin route `/dashboard/dolbaebadmintts/*` удалён из рабочего слоя.

## Авторизация и runtime-ограничения

- защищённый API использует cookie `session_id`
- guest mode удалён из рабочего слоя
- браузерная озвучка работает через `/tts-player`
- одновременно реально воспроизводит звук только одна активная вкладка `/tts-player`
- автозапуск `tts_worker_agent` — только opt-in; штатный сценарий по умолчанию предполагает ручной старт или явную установку с `-EnableAutostart`

## База данных

- runtime и production работают на PostgreSQL
- SQLite допустим только в тестах
- очистка хвостов и сирот делается через `bot_service/scripts/database_hygiene.py`
- безопасное удаление пользователей делается через `bot_service/scripts/delete_users.py`

## Что уже доведено

- frontend больше не ходит напрямую к TTS runtime
- TTS приведён к mode-first модели `cloud/self_host`
- command cooldowns вынесены в Redis-backed store
- YouTube reward-настройки нормализованы в один backend helper
- drops/streaks используют `source_event_id` и `stream_session_id`
- YouTube queue/runtime закрыт по `play now / next / reorder`
- админка переведена на ops-center shell и агрегированные read-models
- legacy admin route и неиспользуемые admin-страницы удалены
- новые session-scoped записи не должны появляться в user-only таблицах

## Гигиена репозитория

- активные текстовые файлы должны храниться в UTF-8 без mojibake
- временные runtime/debug артефакты не считаются частью продукта и не должны ехать в git
- `__pycache__/`, `.pytest_cache/`, `pytest-cache-files-*`, временные audio/log файлы должны очищаться перед фиксацией прогресса

## Что ещё открыто

- пройти staging/live smoke по матрице `cloud/self_host x f5/qwen`
- финально заморозить release image set
- отдельно подтвердить pre-existing dirty state в `f5-tts-service/vendor/F5-TTS` перед релизным freeze
