# TTS Architecture

Last updated: 2026-02-25

## 1. Runtime Topology

- `frontend`: talks only to `bot_service` API/WS.
- `bot_service`: control plane (auth, settings, routing policy, fallback, websocket delivery).
- `tts-gateway`: advanced synthesis orchestrator for `f5` and `qwen`.
- `f5-tts-service`: provider-owned F5 synthesis + voice/admin APIs.
- `nano-qwen3tts-vllm`: provider-owned Qwen synthesis engine.

## 2. Provider Routing Rules

### Synthesis

- `gcloud`: internal path in `bot_service`.
- `f5`: gateway-first (`TTS_GATEWAY_URL`), direct fallback if gateway is not configured.
- `qwen`: gateway-only in cloud mode; without gateway, route is unavailable and runtime falls back to basic TTS.

### Voice/Admin

- `f5`: routed to provider voice/admin API.
- `qwen`: disabled by default (`501`) until `QWEN_VOICE_SERVICE_URL` is configured.
- `gcloud`: no custom voice CRUD in core.

## 3. Auth Model

Strict API-key for TTS upstream calls.

`bot_service` sends:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Keys are resolved by upstream type:

- gateway: `TTS_GATEWAY_API_KEY`
- f5 direct: `F5_TTS_SERVICE_API_KEY`
- qwen direct/voice: `QWEN_TTS_SERVICE_API_KEY` (reserved for staged qwen voice integration)
- local endpoint: per-user saved `api_key` from `local_tts_endpoints`

## 4. DB Ownership

`bot_service` DB stores:

- user/provider settings (`engine`, `advanced_provider`, `f5_mode`, `qwen_mode`, `use_local_tts`)
- provider-specific settings (`voice`, `qwen_voice`, `qwen_model`, gcloud voice pool/mood)
- local endpoint configs and endpoint API keys
- user voice overrides metadata (`tts_provider`-aware)

Provider services store provider-local operational state (voice catalogs, provider internals).

## 5. Public Backend Surface

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- existing voice/admin routes remain stable (`/api/voices/*`, `/api/admin/voices*`)

Capability behavior:

- qwen voice CRUD unavailable -> explicit `501` with machine-readable detail
- frontend uses capabilities to disable unsupported actions

## 6. Frontend Boundary Hardening

- `VITE_TTS_SERVICE_URL` is deprecated and not required for runtime startup.
- No direct `ttsApiClient`; all runtime calls go through backend API client.
- Audio URL normalization is backend-safe (absolute passthrough, relative -> backend base URL).
- WebSocket fallback hardcodes to `:8000` were removed (`window.location.host` used).

## 7. Fallback Chain

1. Try selected advanced provider path.
2. If unavailable/error/timeout, use basic `gtts` fallback.
3. For local mode, missing/unhealthy local endpoint immediately enters fallback path.

## 8. Operational Runbook Ports

Recommended local ports:

- gateway: `8010`
- f5 service: `8011`
- qwen engine: `8000`
- bot_service: `8000`

## 9. Known Prerequisites

- `tts-gateway` requires Redis configured (`TTS_GATEWAY_REDIS_URL`).
- `f5-tts-service` startup requires populated upstream/model assets (`vendor/F5-TTS`, weights).
- `nano-qwen3tts-vllm` practical runtime requires Linux/WSL2 toolchain (Triton/Flash-Attention).
