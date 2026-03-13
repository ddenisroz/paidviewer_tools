# TTS architecture

Last updated: 2026-03-13

## Runtime topology

- `frontend` общается только с `bot_service` API/WS
- `bot_service` — control plane: auth, settings, routing policy, fallback, websocket delivery
- `tts-gateway` — advanced synthesis orchestrator для `f5` и `qwen`
- `f5-tts-service` — F5 synthesis + voice/admin APIs
- `nano-qwen3tts-vllm` — Qwen synthesis engine

## Deployment topologies

- `self-hosted endpoint` — пользователь сам поднимает TTS и подключает его через `local_tts_endpoints`
- `project-hosted direct worker` — отдельный воркер проекта по фиксированному upstream URL
- `gateway-managed` — `bot_service -> tts-gateway -> project-hosted workers`

Флаги `use_local`, `f5_local`, `qwen_local` остаются legacy naming для self-hosted path.

## Provider routing rules

### Synthesis

- `gcloud` — внутренний путь в `bot_service`
- `f5` — gateway-managed first, direct project-hosted fallback при отсутствии gateway, self-hosted optional
- `qwen` — gateway-managed в managed mode; self-hosted через compatibility adapter; без gateway managed path unavailable

### Voice/Admin

- `f5` — routed to provider voice/admin API
- `qwen` — выключен по умолчанию (`501`) до настройки `QWEN_VOICE_SERVICE_URL`
- `gcloud` — custom voice CRUD в core не имеет

## Auth model

Для TTS upstream calls используется strict API-key:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Ключи резолвятся так:
- gateway: `TTS_GATEWAY_API_KEY`
- F5 project-hosted worker: `F5_TTS_SERVICE_API_KEY`
- Qwen project-hosted worker / voice: `QWEN_TTS_SERVICE_API_KEY`
- self-hosted endpoint: per-user `api_key` из `local_tts_endpoints`

## DB ownership

`bot_service` хранит:
- provider settings и routing flags
- local endpoint configs и API keys
- user voice overrides и TTS policy

Provider-сервисы хранят только provider-local operational state.

## Public backend surface

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- существующие voice/admin routes (`/api/voices/*`, `/api/admin/voices*`) остаются стабильными

## Fallback chain

1. Сначала пробуем выбранный advanced provider path
2. При ошибке или unavailable — fallback на basic `gtts`
3. Для self-hosted path неработающий endpoint сразу уводит в fallback

## Важные prereq

- `tts-gateway` требует Redis
- `f5-tts-service` требует `vendor/F5-TTS` и веса
- `nano-qwen3tts-vllm` practically требует Linux/WSL2 toolchain