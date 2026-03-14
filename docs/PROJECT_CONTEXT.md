# Контекст проекта

Последнее обновление: 2026-03-13

## Что это за репозиторий

Это основной продукт для стримеров:

- `frontend` — пользовательский интерфейс и личный кабинет
- `bot_service` — центральный backend: авторизация, настройки, бизнес-логика, оркестрация
- внешние TTS-сервисы — `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`

`frontend` общается только с `bot_service`. Прямые обращения из frontend к внешним TTS-сервисам не допускаются.

## Как сейчас устроен TTS

В проекте используются три режима:

- `self-hosted endpoint` — пользователь сам поднимает TTS-сервис и подключает его URL
- `project-hosted worker` — внешний воркер под инфраструктурой проекта
- `gateway-managed` — путь `bot_service -> tts-gateway -> project-hosted worker`

Старые флаги `use_local`, `f5_local`, `qwen_local` пока сохранены только как совместимые имена.

## Провайдеры

- `f5`
  - управляемый путь: через `tts-gateway`
  - собственный endpoint пользователя: поддерживается
  - управление голосами: поддерживается через backend
- `qwen`
  - управляемый путь: через `tts-gateway`
  - собственный endpoint пользователя: работает через слой совместимости
  - управление голосами: пока `501`, если не задан `QWEN_VOICE_SERVICE_URL`
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
- guest mode удалён из рабочего слоя
- новые session-scoped записи не должны появляться в `user_settings`, `tts_user_settings`, `local_tts_endpoints`, `filtered_words`, `tts_blocked_users`
- YouTube queue переведена на user-only путь
- рабочий слой drops переведён на user-only wrappers
- `QueueHandlerMixin` — единственный активный путь для YouTube-команд
- голосование за `!skip` вынесено в `services/youtube/skip_vote_store.py`
- пакет `bot_service/bots/command_handlers/*` больше не является частью рабочего слоя

## Что ещё открыто

- добить оставшиеся совместимые хвосты в смешанных доменах
- довести Qwen upstream до полного контракта
- пройти live smoke по основным TTS-путям
- дальше сжимать основную документацию до короткого русского источника правды
