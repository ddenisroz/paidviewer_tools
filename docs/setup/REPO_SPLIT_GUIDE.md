# Repo Split Guide (core + gateway + F5 + Qwen)

Last updated: 2026-02-25

## 1. Target Repositories

1. `ttv-core` (this repo)
- `bot_service/`, `frontend/`, shared docs, deploy overlays.
- Control-plane responsibilities: auth, moderation, queue orchestration, settings, provider routing policy.

2. `tts-gateway`
- Advanced synthesis orchestrator for `f5` + `qwen`.
- Scheduler/fairness, provider adapters, async job polling.

3. `f5-tts-service` (`phase1-bootstrap`)
- F5 provider runtime + provider-owned voice/admin APIs.

4. `nano-qwen3tts-vllm`
- Qwen inference engine.
- Voice CRUD API is out of scope in current phase; add separate qwen voice service later.

## 2. Contract Freeze (Core <-> Upstreams)

### Synthesis

- Core calls gateway endpoint:
  - `POST /api/tts/synthesize-channel`
- Health:
  - `GET /health/live`
  - `GET /health/ready`
  - `GET /health` (compat)

### Voice/Admin

- F5 voice/admin API stays provider-owned (`/api/tts/*`, `/api/admin/*`).
- Qwen voice/admin in core returns `501` until `QWEN_VOICE_SERVICE_URL` is configured.

### Auth

Strict API-key mode only for TTS upstreams.

Core sends both headers:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Legacy JWT/key settings are compatibility-only and not part of target TTS contract.

## 3. Core API Stability for Frontend

Frontend keeps stable backend-only boundary:

- no direct runtime dependency on `VITE_TTS_SERVICE_URL`
- health checks only via backend: `GET /api/tts/health`
- provider capability gating via backend: `GET /api/voices/providers/capabilities`
- audio URL resolution must be backend-safe (relative -> backend base URL)

## 4. Environment Ownership

### `ttv-core` (`bot_service`)

- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY` (reserved)
- `QWEN_VOICE_SERVICE_URL` (optional, enables qwen voice CRUD routing)

### `tts-gateway`

- `TTS_GATEWAY_API_KEYS`
- `TTS_GATEWAY_REDIS_URL`
- `TTS_GATEWAY_F5_URL`
- `TTS_GATEWAY_F5_API_KEY`
- `TTS_GATEWAY_QWEN_URL`
- `TTS_GATEWAY_QWEN_API_KEY`

### `f5-tts-service`

- `F5_TTS_SERVICE_API_KEYS`
- `F5_TTS_DATABASE_URL`
- optional model/runtime vars (`F5_TTS_*`)

### `nano-qwen3tts-vllm`

- runtime/model vars from repo docs
- runs as inference engine behind gateway

## 5. Current Phase Behavior

1. Synthesis routing:
- `f5` -> gateway (preferred) or direct fallback if gateway missing.
- `qwen` -> gateway only; without gateway core returns controlled unavailable status and falls back to basic TTS runtime path.

2. Voice routing:
- `f5` -> provider voice/admin endpoints.
- `qwen` -> `501` by default.
- if `QWEN_VOICE_SERVICE_URL` is set, qwen voice/admin routes switch automatically without frontend API changes.

## 6. Cutover Sequence

1. Deploy `f5-tts-service` + `nano-qwen3tts-vllm`.
2. Deploy `tts-gateway` with Redis and API keys.
3. Set core env (`TTS_GATEWAY_URL`, `TTS_GATEWAY_API_KEY`, provider URLs/keys).
4. Run smoke:
- synth `provider=f5` through gateway
- synth `provider=qwen` through gateway
- F5 voice CRUD via core
- qwen voice CRUD returns expected `501`
5. Enable optional qwen voice service later and set `QWEN_VOICE_SERVICE_URL`.

## 7. Rollback

1. Keep frontend unchanged (still backend-only).
2. For synthesis rollback:
- switch `TTS_GATEWAY_URL` off if needed.
- `f5` can still run direct.
- `qwen` cloud synthesis becomes unavailable until gateway returns.
3. Restart `bot_service` to apply env changes.

## 8. Validation Checklist

- No direct frontend runtime usage of `F5_TTS_SERVICE_URL`/`VITE_TTS_SERVICE_URL`.
- Backend exposes `GET /api/tts/health` and `GET /api/voices/providers/capabilities`.
- Qwen voice CRUD is capability-gated and returns explicit `501` detail when disabled.
- Compose/env files use strict API-key variable names for gateway/F5 upstreams.
