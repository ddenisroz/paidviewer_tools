# Статус проекта

Последнее обновление: 2026-03-13

Это короткая рабочая сводка, а не changelog.

## Сейчас стабильно

- контракт `frontend -> bot_service -> external TTS upstreams`;
- runtime только для авторизованных пользователей;
- guest mode удалён из active runtime;
- безопасное удаление пользователей через `bot_service/scripts/delete_users.py`;
- очистка orphan user-записей, legacy session-scoped хвостов и старых inactive sessions через `bot_service/scripts/database_hygiene.py`;
- active docs отделены от backlog;
- YouTube queue и active drops runtime переведены на user-only слой;
- `QueueHandlerMixin` — единственный active runtime для queue-команд YouTube.

## Критичные контракты

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- `GET /api/local-tts/config?provider=f5|qwen`
- `POST /api/local-tts/test-connection`
- `POST /api/local-tts/config`
- `POST /api/local-tts/toggle?provider=f5|qwen`
- `POST /api/tts/settings`
- `POST /api/tts/synthesize`

## Runtime-заметки

- browser TTS требует активную вкладку `/tts-player`;
- OBS mode требует активный OBS socket;
- frontend не должен использовать прямой runtime URL TTS-сервиса;
- self-hosted Qwen пока работает через compatibility path;
- пакет `bot_service/bots/command_handlers/*` больше не считается active runtime.

## Ближайшие задачи

1. Добить docs/scripts hygiene и остатки legacy runtime.
2. Пройти live smoke `gateway-managed F5`.
3. Пройти live smoke `self-hosted F5`.
4. Затем вернуться к `qwen` и внешним upstream-задачам.

## Последние важные изменения

- DB hygiene расширен на `youtube_queue` и session-scoped `drops_*` таблицы.
- Голосование за `!skip` вынесено в `services/youtube/skip_vote_store.py`.
- Legacy `song_request_handler.py` и пакет `bot_service/bots/command_handlers/*` выведены из активного слоя и оставлены только как технические placeholders до физического удаления.
