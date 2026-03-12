# TTS Architecture

Last updated: 2026-03-12

## 1. Runtime Topology

- `frontend`: talks only to `bot_service` API/WS.
- `bot_service`: control plane (auth, settings, routing policy, fallback, websocket delivery).
- `tts-gateway`: advanced synthesis orchestrator for `f5` and `qwen`.
- `f5-tts-service`: provider-owned F5 synthesis + voice/admin APIs.
- `nano-qwen3tts-vllm`: provider-owned Qwen synthesis engine.

## 2. Deployment Topologies

- `self-hosted endpoint`: пользователь сам поднимает TTS-сервис и подключает его через `local_tts_endpoints`.
- `project-hosted direct worker`: отдельный воркер проекта, хостится вашей инфраструктурой и подключается по фиксированному upstream URL.
- `gateway-managed`: `bot_service -> tts-gateway -> project-hosted workers`.

Existing runtime flags `use_local`, `f5_local`, `qwen_local` are legacy naming for the self-hosted path and are intentionally preserved for now.

## 3. Provider Routing Rules

### Synthesis

- `gcloud`: internal path in `bot_service`.
- `f5`: gateway-managed first (`TTS_GATEWAY_URL`), project-hosted direct fallback if gateway is not configured, self-hosted endpoint optional.
- `qwen`: gateway-managed in managed mode; self-hosted endpoint is optional via compatibility adapter; without gateway, managed route is unavailable and runtime falls back to basic TTS.

### Voice/Admin

- `f5`: routed to provider voice/admin API.
- `qwen`: disabled by default (`501`) until `QWEN_VOICE_SERVICE_URL` is configured.
- `gcloud`: no custom voice CRUD in core.

## 4. Auth Model

Strict API-key for TTS upstream calls.

`bot_service` sends:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Keys are resolved by upstream type:

- gateway: `TTS_GATEWAY_API_KEY`
- f5 project-hosted direct worker: `F5_TTS_SERVICE_API_KEY`
- qwen project-hosted direct worker / voice: `QWEN_TTS_SERVICE_API_KEY` (reserved for staged qwen voice integration)
- self-hosted endpoint: per-user saved `api_key` from `local_tts_endpoints`

## 5. DB Ownership

`bot_service` DB stores:

- user/provider settings (`engine`, `advanced_provider`, `f5_mode`, `qwen_mode`, `use_local_tts`)
- provider-specific settings (`voice`, `qwen_voice`, `qwen_model`, gcloud voice pool/mood)
- local endpoint configs and endpoint API keys
- user voice overrides metadata (`tts_provider`-aware)

`use_local_tts` and provider `*_local` naming in runtime settings still refer to the self-hosted endpoint path.

Provider services store provider-local operational state (voice catalogs, provider internals).

## 6. Public Backend Surface

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- existing voice/admin routes remain stable (`/api/voices/*`, `/api/admin/voices*`)

Capability behavior:

- qwen voice CRUD unavailable -> explicit `501` with machine-readable detail
- frontend uses capabilities to disable unsupported actions

## 7. Frontend Boundary Hardening

- `VITE_TTS_SERVICE_URL` is deprecated and not required for runtime startup.
- No direct `ttsApiClient`; all runtime calls go through backend API client.
- Audio URL normalization is backend-safe (absolute passthrough, relative -> backend base URL).
- WebSocket fallback hardcodes to `:8000` were removed (`window.location.host` used).

## 8. Fallback Chain

1. Try selected advanced provider path.
2. If unavailable/error/timeout, use basic `gtts` fallback.
3. For self-hosted endpoint mode, missing/unhealthy endpoint immediately enters fallback path.

## 9. Operational Runbook Ports

Recommended local ports:

- gateway: `8010`
- f5 service: `8011`
- qwen engine: `8000`
- bot_service: `8000`

## 10. Known Prerequisites

- `tts-gateway` requires Redis configured (`TTS_GATEWAY_REDIS_URL`).
- `f5-tts-service` startup requires populated upstream/model assets (`vendor/F5-TTS`, weights).
- `nano-qwen3tts-vllm` practical runtime requires Linux/WSL2 toolchain (Triton/Flash-Attention).
