# Контекст проекта

Последнее обновление: 2026-03-16

## Что это за репозиторий

Это основной продукт для стримеров:

- `frontend` — пользовательский интерфейс и личный кабинет
- `bot_service` — центральный backend: авторизация, настройки, бизнес-логика, оркестрация
- внешние TTS-сервисы — `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`

`frontend` общается только с `bot_service`. Прямые обращения из frontend к внешним TTS-сервисам не допускаются.

## Как сейчас устроен TTS

Официальных пользовательских режимов только два:

- `cloud` — `frontend -> bot_service -> tts-gateway -> provider runtime`
- `self_host` — `frontend -> bot_service pairing/provisioning -> tts_worker_agent -> local runtime`

Что важно:

- `tts_worker_agent` — основной и рекомендуемый self-host путь для обоих провайдеров
- ручной raw endpoint сохранён только как compatibility fallback для поддержки и диагностики
- старые флаги `use_local`, `f5_local`, `qwen_local` и старые термины остаются только для совместимости
- источник истины для routing — mode-first контракт `official_mode`, `recommended_path`, `provider_matrix`, capability flags и status/health ответы backend-а

## Провайдеры

- `f5`
  - cloud и self-host используют тот же mode-first orchestration-контур, что и `qwen`
  - управление голосами поддерживается через backend
- `qwen`
  - cloud и self-host используют тот же orchestration-path, а различия живут в provider adapter/capabilities
  - ручной self-host endpoint всё ещё работает через compatibility adapter, но пользовательский прод-путь — через `tts_worker_agent`
  - управление голосами поддерживается через backend/admin routes upstream-а
  - admin/global voices доступны при настроенном `QWEN_TTS_SERVICE_URL` или `QWEN_VOICE_SERVICE_URL`
  - рекомендуемый общий env для согласования backend catalog и runtime allowlist: `QWEN_ALLOWED_MODELS`
  - cloud model catalog должен отражать runtime `/api/models`, отфильтрованный backend allowlist `QWEN_CLOUD_ALLOWED_MODELS` при его наличии
- self-host model catalog не режется backend allowlist-ом и отражает runtime пользовательского compatibility endpoint-а как есть
  - `QWEN_VOICE_STORAGE_DIR` должен жить в общем persistent volume, чтобы sample-ы переживали смену `base` / `voice_design` / `custom_voice` runtime
- `gcloud`
  - встроенный путь внутри `bot_service`

## Авторизация и ограничения runtime

- защищённый API использует cookie `session_id`
- guest mode удалён из рабочего слоя
- браузерная озвучка работает только через вкладку `/tts-player`
- одновременно реально воспроизводит звук только одна активная вкладка `/tts-player`

## База данных

- runtime и production работают на PostgreSQL
- SQLite допустим только в тестах
- очистка мусора и старых хвостов делается через `bot_service/scripts/database_hygiene.py`
- безопасное удаление пользователей делается через `bot_service/scripts/delete_users.py`

## Что уже очищено

- frontend больше не ходит напрямую к TTS runtime
- админка использует единый shell c вкладками `Обзор`, `Боты`, `Голоса`, `Пользователи`, `Каналы`, `Логи`, `Мониторинг`
- прямые admin routes `/dashboard/dolbaebadmintts/channels` и `/dashboard/dolbaebadmintts/logs` должны оставаться рабочими вместе с query-tab навигацией
- guest mode удалён из рабочего слоя
- новые session-scoped записи не должны появляться в `user_settings`, `tts_user_settings`, `local_tts_endpoints`, `filtered_words`, `tts_blocked_users`
- YouTube queue переведена на user-only путь
- рабочий слой drops переведён на user-only wrappers
- `QueueHandlerMixin` — единственный активный путь для YouTube-команд
- голосование за `!skip` вынесено в `services/youtube/skip_vote_store.py`
- пакет `bot_service/bots/command_handlers/*` больше не является частью рабочего слоя

## Гигиена репозитория

- рабочие текстовые файлы должны храниться в UTF-8 без битых строк и mojibake
- runtime/debug артефакты (`tmp_runtime_logs/`, root-level `Qwen_logs.txt`, `bot_log.txt`, `F5_log.txt`) не считаются частью продукта и не должны попадать в git
- `__pycache__/`, `pytest-cache-files-*`, `.ruff_cache/`, временные audio/log файлы должны очищаться перед фиксацией прогресса

## Что ещё открыто

- пройти staging/live smoke по матрице `cloud/self_host x f5/qwen`
- довести CI и quality gates до полностью зелёного статуса
- дальше сжимать основную документацию до короткого русского источника правды
