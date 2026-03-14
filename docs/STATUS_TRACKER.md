# Статус проекта

Последнее обновление: 2026-03-13

Это короткая рабочая сводка, а не журнал изменений.

## Сейчас стабильно

- контракт `frontend -> bot_service -> внешние TTS-сервисы`
- runtime только для авторизованных пользователей
- guest mode удалён
- безопасное удаление пользователей через `bot_service/scripts/delete_users.py`
- очистка orphan-записей, старых session-хвостов и неактивных сессий через `bot_service/scripts/database_hygiene.py`
- основная документация отделена от backlog
- YouTube queue и рабочий слой drops переведены на user-only модель
- `QueueHandlerMixin` — единственный активный runtime для YouTube-команд очереди
- backend test suite зелёный: `501 passed, 8 skipped`

## Критичные контракты

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- `GET /api/local-tts/config?provider=f5|qwen`
- `POST /api/local-tts/test-connection`
- `POST /api/local-tts/config`
- `POST /api/local-tts/toggle?provider=f5|qwen`
- `POST /api/tts/settings`
- `POST /api/tts/synthesize`

## Важные runtime-заметки

- браузерная озвучка требует активную вкладку `/tts-player`
- режим OBS требует активный OBS socket
- frontend не должен использовать прямые URL TTS-сервисов
- self-hosted Qwen пока работает через слой совместимости

## Ближайшие задачи

1. Дочистить active docs, служебные сообщения и оставшиеся legacy-хвосты в runtime
2. Пройти live smoke для `gateway-managed F5`
3. Пройти live smoke для `self-hosted F5`
4. После этого вернуться к `qwen` и внешним upstream-задачам

## Последние важные изменения

- DB hygiene расширен на `youtube_queue` и session-scoped таблицы `drops_*`
- голосование за `!skip` вынесено в `services/youtube/skip_vote_store.py`
- старый пакет `bot_service/bots/command_handlers/*` выведен из рабочего слоя
