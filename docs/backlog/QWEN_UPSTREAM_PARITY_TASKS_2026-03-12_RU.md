# Qwen Upstream Parity Tasks

Дата: 2026-03-12

## Цель

Довести `nano-qwen3tts-vllm` до native contract parity с ожиданиями `bot_service`, чтобы direct local `qwen` работал без backend compatibility adapter.

Сейчас в этом репозитории direct local `qwen` уже поддержан через compatibility path, но это временный слой совместимости. Ниже список того, что нужно сделать именно в upstream `qwen`, чтобы перейти на правильный нативный контракт.

## P0

1. Добавить strict API-key auth для всех machine endpoints.
   - Ожидаемый контракт: `Authorization: Bearer <key>` и `X-API-Key: <key>`.
   - Минимум: `POST /api/prepare`, `GET /api/stream/{stream_id}`, `GET /api/status/{stream_id}`, `POST /api/cancel/{stream_id}`.

2. Добавить стандартные health endpoints.
   - Нужны: `GET /health`, `GET /health/live`, `GET /health/ready`.
   - `GET /health` должен быть summary endpoint с понятным JSON-ответом.
   - `GET /health/ready` должен отражать готовность runtime, а не только факт поднятого FastAPI процесса.

3. Прочитать и реально применять env-настройки `API_KEY` и `PORT`.
   - Сейчас код upstream их не применяет как ожидает локальная интеграция.
   - Порт сервера не должен быть захардкожен только в `8000`.

4. Добавить summary status endpoint.
   - Нужен `GET /api/status` без `stream_id`.
   - Он должен возвращать хотя бы состояние runtime, активную модель, queue depth и базовые counters.

## P1

5. Зафиксировать versioned synth contract для интеграции с `bot_service`.
   Варианты:
   - либо добавить совместимый endpoint `POST /api/tts/synthesize-channel`
   - либо официально описать стабильный contract `prepare -> stream` как provider API для внешних интеграторов

6. Добавить machine-readable metadata в ответы synth/status/health.
   - `service`
   - `status`
   - `version`
   - `model`
   - `queue_depth`
   - `supports_streaming`

7. Ужесточить CORS.
   - Убрать `allow_origins=["*"]` для production/machine режима.
   - UI/demo mode должен быть отделён от интеграционного API режима.

8. Развести demo UI и service mode.
   - HTML root `/` не должен быть единственным признаком живого сервиса.
   - Нужен явный machine-first режим работы.

## P2

9. Добавить voice-management story для Qwen.
   - Отдельный `QWEN_VOICE_SERVICE_URL`, если voice CRUD остаётся отдельным сервисом.
   - Или отдельный documented API, если voice management будет жить в том же repo.

10. Добавить upstream test coverage под этот контракт.
   - auth tests
   - health tests
   - env contract tests
   - prepare/stream/status/cancel API tests

11. Обновить README и `.env.example`.
   - Явно задокументировать auth, health, status, port binding, Linux/WSL2 prerequisites.

## Что можно будет удалить после закрытия списка

- backend compatibility adapter для direct local `qwen` в `bot_service`
- compatibility warnings в UI local TTS
- специальные local health probes под `prepare/status/root`

## Критерий завершения

`bot_service` должен иметь возможность:

1. Проверить `qwen` через нативный `GET /health`.
2. Отправить auth headers и получить корректную проверку ключа.
3. Получить summary status без знания `stream_id`.
4. Использовать direct local `qwen` без compatibility adapter и без специальных веток в коде.
