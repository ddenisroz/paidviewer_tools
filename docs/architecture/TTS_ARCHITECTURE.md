# TTS архитектура

Последнее обновление: 2026-03-13

## Runtime topology

- `frontend` общается только с `bot_service` API и WebSocket;
- `bot_service` — центральный backend: auth, settings, routing policy, fallback, websocket delivery;
- `tts-gateway` — orchestrator синтеза для `f5` и `qwen`;
- `f5-tts-service` — F5 synthesis и voice/admin API;
- `nano-qwen3tts-vllm` — Qwen synthesis engine.

## Deployment topologies

- `self-hosted endpoint` — пользователь сам поднимает TTS и подключает его через `local_tts_endpoints`;
- `project-hosted direct worker` — отдельный воркер проекта по фиксированному upstream URL;
- `gateway-managed` — `bot_service -> tts-gateway -> project-hosted workers`.

Флаги `use_local`, `f5_local`, `qwen_local` остаются старыми именами для self-hosted path.

## Правила маршрутизации провайдеров

### Синтез

- `gcloud` — внутренний путь в `bot_service`;
- `f5` — сначала gateway-managed, затем прямой project-hosted fallback, self-hosted optional;
- `qwen` — gateway-managed в управляемом режиме; self-hosted через слой совместимости.

### Voice/Admin

- `f5` — routed to provider voice/admin API;
- `qwen` — выключен по умолчанию (`501`) до настройки `QWEN_VOICE_SERVICE_URL`;
- `gcloud` — custom voice CRUD в core не имеет.

## Модель авторизации

Для TTS upstream calls используется strict API-key:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Ключи резолвятся так:

- gateway: `TTS_GATEWAY_API_KEY`
- F5 project-hosted worker: `F5_TTS_SERVICE_API_KEY`
- Qwen project-hosted worker или voice: `QWEN_TTS_SERVICE_API_KEY`
- self-hosted endpoint: per-user `api_key` из `local_tts_endpoints`

## Владение данными

`bot_service` хранит:

- provider settings и routing flags;
- local endpoint configs и API keys;
- user voice overrides и TTS policy.

Provider-сервисы хранят только provider-local operational state.

## Публичный backend-контракт

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- существующие voice/admin routes (`/api/voices/*`, `/api/admin/voices*`) остаются стабильными

## Цепочка резервных путей

1. Сначала пробуется выбранный advanced provider path.
2. При ошибке или unavailable идёт переход на basic `gtts`.
3. Для self-hosted path неработающий endpoint сразу уводит в резервный путь.

## Важные prerequisites

- `tts-gateway` требует Redis;
- `f5-tts-service` требует `vendor/F5-TTS` и веса;
- `nano-qwen3tts-vllm` практически требует Linux или WSL2.
