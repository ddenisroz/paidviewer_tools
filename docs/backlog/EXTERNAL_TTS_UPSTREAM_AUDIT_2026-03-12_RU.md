# Внешний аудит upstream TTS репозиториев

Дата: 2026-03-12

## Scope

Аудит выполнен по реальному коду upstream-репозиториев, а не только по следам интеграции в `ttv-core`.

Локально были клонированы и просмотрены следующие upstream checkout'ы:

- `tts-gateway` @ `c703332a076e2658cb60504cbf4ed45397a5b1c1`
- `f5-tts-service` (`phase1-bootstrap`) @ `7d029406954596a6057051bd9896e91b98664302`
- `nano-qwen3tts-vllm` @ `8889fb1732917df86351851b5f6685da2bb020c3`

Путь локального audit workspace:

- `tmp/upstream-audit/tts-gateway`
- `tmp/upstream-audit/f5-tts-service`
- `tmp/upstream-audit/nano-qwen3tts-vllm`

## Executive Summary

Картина разделилась на три уровня зрелости:

1. `tts-gateway` выглядит как уже сформированный отдельный orchestration service и хорошо совпадает с текущим `bot_service` synthesis-контрактом.
2. `f5-tts-service` тоже хорошо совпадает с ожидаемой ролью provider-owned сервиса: есть отдельный provider API `/v1`, compat voice/admin layer `/api/tts/*` и `/api/admin/*`, строгий API-key auth, health endpoints и явные runtime prerequisites.
3. `nano-qwen3tts-vllm` пока скорее inference engine, чем полноценно согласованный self-hosted upstream для текущего `bot_service` local-mode контракта. Главные gaps: нет auth, нет `/health/live|ready`, нет env-driven `API_KEY`/`PORT` contract, а local endpoint flow в текущем core ожидает именно такие поверхности.

Вывод:

- для cloud/gateway-mode стек уже достаточно понятен и управляем;
- для direct/self-hosted Qwen текущий upstream нельзя считать production-aligned без дополнительного hardening или adapter layer.

## По репозиториям

### `tts-gateway`

Что подтверждено по коду:

- Основной контракт синтеза:
  - `POST /api/tts/synthesize-channel`
  - `GET /api/tts/jobs/{job_id}`
- Health/admin surface:
  - `GET /health/live`
  - `GET /health/ready`
  - `GET /health`
  - `GET /api/admin/stats`
- Строгий API-key auth:
  - принимает `Authorization: Bearer <key>`
  - принимает `X-API-Key: <key>`
- Реализует:
  - Redis-backed job store
  - async polling
  - idempotency
  - fairness scheduling
  - circuit breaker
  - provider adapters для `f5` и `qwen`

Что важно операционно:

- Redis обязателен.
- Qwen adapter работает через `POST /api/prepare` + `GET /api/stream/{id}`.
- Есть режим `TTS_GATEWAY_QWEN_URL_POLICY=auto`, который при публично выглядящем Qwen URL может вернуть клиенту прямой `audio_url` upstream-а, а не proxy URL gateway.

Оценка:

- Репозиторий в хорошем состоянии для роли orchestration layer.
- Это на текущий момент самый зрелый внешний upstream из трёх.

### `f5-tts-service`

Что подтверждено по коду:

- Provider API:
  - `POST /v1/synthesize`
- Health:
  - `GET /health/live`
  - `GET /health/ready`
  - compat `GET /health`
  - compat `GET /api/health`
- Compat APIs:
  - `/api/tts/synthesize-channel`
  - `/api/tts/voices*`
  - `/api/tts/user/voices*`
  - `/api/tts/user/tts-limits*`
  - `/api/tts/enable|disable|status`
  - `/api/admin/voices*`
  - `/api/admin/stats`
- Auth:
  - strict API-key only
  - `Authorization` или `X-API-Key`
- Persistence:
  - file-store fallback
  - PostgreSQL mode
  - есть Alembic migrations

Что важно операционно:

- Startup жёстко зависит от:
  - `vendor/F5-TTS`
  - RU weights (`models/F5-TTS_RUSSIAN` или explicit checkpoint/vocab)
  - успешного prewarm
- Voice upload path зависит от audio toolchain (`ffmpeg`/decode path).
- Auto-transcription зависит от `faster-whisper`.

Оценка:

- Это действительно provider-owned сервис, а не временный shim.
- Главный риск не в API-контракте, а в deployment readiness и тяжёлом runtime bootstrap.

### `nano-qwen3tts-vllm`

Что подтверждено по коду:

- Реальный API surface:
  - `POST /api/prepare`
  - `GET /api/stream/{stream_id}`
  - `GET /api/status/{stream_id}`
  - `POST /api/cancel/{stream_id}`
  - `GET /` возвращает HTML UI
- Внутри есть собственная fair queue по tenant'ам.
- Требует Linux/WSL2 + CUDA/NVIDIA runtime.
- Dockerfile базируется на `nvidia/cuda`.

Что не подтверждено, потому что этого нет в коде:

- нет `GET /health`
- нет `GET /health/live`
- нет `GET /health/ready`
- нет auth middleware для `Authorization`/`X-API-Key`
- нет использования `API_KEY` env
- нет использования `PORT` env, server запускается на жёстком `8000`

Что важно операционно:

- `CORS` открыт как `allow_origins=["*"]`.
- Root endpoint одновременно является demo/web UI.
- Это engine-first сервис, а не готовый secure upstream boundary для self-hosted users.

Оценка:

- В роли engine behind gateway репозиторий понятен.
- В роли прямого self-hosted upstream для текущего `bot_service` local-mode контракта он пока не готов.

## Findings

### EXT-HIGH-01: `nano-qwen3tts-vllm` не реализует upstream auth

Area:

- external
- security
- qwen

Evidence:

- В `api_server.py` нет auth dependency/middleware для `Authorization`/`X-API-Key`.
- Код expose'ит `POST /api/prepare`, `GET /api/stream/{id}`, `POST /api/cancel/{id}` без проверки ключа.
- `CORS` открыт на `*`.

Impact:

- Если self-hosted Qwen endpoint доступен по сети, любой клиент с доступом к хосту может генерировать, читать и отменять streams.
- Текущий `bot_service` честно передает auth headers, но upstream их игнорирует.

Recommended action:

1. Добавить strict API-key middleware в upstream repo.
2. Если это не планируется быстро, считать current Qwen endpoint допустимым только за gateway/private-network boundary.

### EXT-HIGH-02: текущий Qwen upstream не совпадает с local health contract в `bot_service`

Area:

- external
- contract
- self-hosted

Evidence:

- `bot_service` local endpoint flow использует:
  - `GET {endpoint}/health`
  - optional `GET {endpoint}/api/status`
- `nano-qwen3tts-vllm` в коде имеет только:
  - `GET /api/status/{stream_id}`
  - и не имеет `GET /health`

Impact:

- Текущий direct/self-hosted Qwen flow в `Local TTS` настройках не имеет upstream parity.
- Проверка подключения и сохранение health metadata для Qwen работают не так, как описано в active docs/UI.

Recommended action:

1. Либо добавить в upstream:
   - `GET /health`
   - `GET /health/live`
   - `GET /health/ready`
   - optional summary `GET /api/status`
2. Либо не рекламировать direct local Qwen как feature-parity path и пометить его experimental.
3. Альтернатива: поставить между `bot_service` и Qwen тонкий compatibility adapter/shim.

### EXT-HIGH-03: `nano-qwen3tts-vllm` игнорирует `API_KEY` и `PORT`, хотя deploy/docs уже ими оперируют

Area:

- external
- deploy
- config

Evidence:

- В `docker-compose.yml` и локальных docs фигурируют `API_KEY`/port `8000`.
- В `api_server.py` код запускается через `uvicorn.run(app, host="0.0.0.0", port=8000)`.
- В коде нет чтения `API_KEY` и нет env-driven настройки порта.

Impact:

- Возникает ложное ощущение, что upstream уже parameterized для self-hosted deployment.
- Compose/env слои обещают больше, чем реально делает код.

Recommended action:

1. Добавить явный config layer в upstream Qwen repo.
2. Пока этого нет, в active docs фиксировать `QWEN_TTS_SERVICE_API_KEY` как reserved/ignored by current upstream implementation.

### EXT-MEDIUM-01: `tts-gateway` может вернуть браузеру прямой Qwen `audio_url`

Area:

- external
- architecture
- browser boundary

Evidence:

- `QwenAdapter` поддерживает `TTS_GATEWAY_QWEN_URL_POLICY=auto`.
- Если stream URL выглядит публично достижимым, gateway возвращает passthrough URL вместо proxy-файла gateway.

Impact:

- Browser/runtime может начать тянуть audio напрямую с Qwen upstream.
- Это не ломает synthesis-контракт полностью, но размывает boundary `frontend -> bot_service` и может осложнить deploy/CORS/security assumptions.

Recommended action:

1. Для browser-facing production/self-hosted stack'ов предпочесть `TTS_GATEWAY_QWEN_URL_POLICY=proxy`.
2. Явно задокументировать это в deploy/runbook.

### EXT-MEDIUM-02: `f5-tts-service` остаётся asset-gated runtime

Area:

- external
- deploy
- operational readiness

Evidence:

- Engine prewarm hard-fail'ится без `vendor/F5-TTS`.
- Без checkpoint/vocab/weights startup не считается готовым.
- README и engine code это подтверждают.

Impact:

- `uv sync` или сборка контейнера не означают готовый runtime.
- Live smoke блокируется не кодом `bot_service`, а asset/bootstrap prerequisites upstream-а.

Recommended action:

1. Держать это как явный deploy prerequisite.
2. Перед cutover иметь проверенный asset bootstrap checklist.

## Alignment Summary

### Уже хорошо совпадает с `ttv-core`

- `tts-gateway` synthesis contract
- `tts-gateway` strict API-key auth
- `f5-tts-service` provider API `/v1/synthesize`
- `f5-tts-service` compat voice/admin layer
- `f5-tts-service` health endpoints

### Частично совпадает

- `nano-qwen3tts-vllm` как gateway-internal engine для `prepare/stream/cancel`

### Пока не совпадает

- direct/self-hosted Qwen local-mode contract
- Qwen auth expectations
- Qwen health expectations
- Qwen env/config expectations

## Recommended Next Sequence

### 1. Сразу

1. Зафиксировать результаты этого внешнего аудита в active docs.
2. Пометить current self-hosted direct Qwen как experimental, а не parity feature.
3. Для browser-facing deployments рекомендовать `TTS_GATEWAY_QWEN_URL_POLICY=proxy`.

### 2. Следующий технический шаг

1. Определить стратегию для Qwen:
   - либо harden сам `nano-qwen3tts-vllm`
   - либо держать его pure engine behind gateway
   - либо добавить отдельный compatibility/voice-service слой

### 3. Если harden upstream Qwen

Минимальный пакет:

1. strict API-key auth
2. `GET /health`
3. `GET /health/live`
4. `GET /health/ready`
5. env-driven `PORT`
6. env-driven `API_KEY`
7. optional summary status endpoint без `stream_id`

## Bottom Line

Для `gateway + f5` внешний split уже выглядит инженерно правдоподобным и сопровождаемым.

Для `qwen` текущий upstream ещё не дотягивает до обещанного self-hosted/local-mode контракта этого проекта. Его стоит считать либо:

- gateway-internal inference engine,

либо

- экспериментальным self-hosted компонентом до появления auth/health/config hardening.
