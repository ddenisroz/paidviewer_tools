# Local TTS Integration (Gateway + F5 + Qwen)

Last updated: 2026-02-25

## Goal

Connect external/local TTS providers to `bot_service` while keeping a single frontend boundary:

- frontend -> `bot_service` only
- `f5`/`qwen` synthesis -> `tts-gateway` (gateway-first)
- voice/admin CRUD -> provider-owned APIs (`f5` now, `qwen` later)

## Runtime Contract

1. Auth mode for upstreams is strict API-key.
2. `bot_service` sends both headers:
   - `Authorization: Bearer <key>`
   - `X-API-Key: <key>`
3. `qwen` cloud synthesis requires configured gateway (`TTS_GATEWAY_URL`).
4. If `QWEN_VOICE_SERVICE_URL` is empty, qwen voice/admin CRUD returns `501` with machine-readable detail.
5. Local per-user endpoints (`local_tts_endpoints`) can still be used for `f5` and `qwen` local mode; saved endpoint `api_key` is used for health/synthesis.

## Required Backend Env

In `bot_service/.env`:

```env
TTS_GATEWAY_URL=http://localhost:8010
TTS_GATEWAY_API_KEY=<gateway-key>

F5_TTS_SERVICE_URL=http://localhost:8011
F5_TTS_SERVICE_API_KEY=<f5-key>

QWEN_TTS_SERVICE_URL=http://localhost:8000
QWEN_TTS_SERVICE_API_KEY=<qwen-key-or-empty>

# optional (enables qwen voice CRUD routing)
QWEN_VOICE_SERVICE_URL=

LOCAL_TTS_ALLOWED_HOSTS=localhost,127.0.0.1,::1,host.docker.internal,f5_tts,tts_service,qwen_tts,qwen_service
LOCAL_TTS_ALLOWED_CIDRS=127.0.0.0/8,::1/128
```

## Upstream Repositories and Runbook

- Gateway: https://github.com/ddenisroz/tts-gateway.git
- F5 service (`phase1-bootstrap`): https://github.com/ddenisroz/f5-tts-service/tree/phase1-bootstrap
- Qwen engine: https://github.com/calldatfate/nano-qwen3tts-vllm.git

### 1) `tts-gateway` (port `8010`)

```bash
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8010
```

Required env before startup:

- `TTS_GATEWAY_API_KEYS`
- `TTS_GATEWAY_REDIS_URL` (Redis must be reachable)
- `TTS_GATEWAY_F5_URL` / `TTS_GATEWAY_F5_API_KEY`
- `TTS_GATEWAY_QWEN_URL` / `TTS_GATEWAY_QWEN_API_KEY`

### 2) `f5-tts-service` (port `8011`)

```bash
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8011
```

Required env before startup:

- `F5_TTS_SERVICE_API_KEYS`
- `F5_TTS_DATABASE_URL`
- optional but typical: `HUGGINGFACE_TOKEN`

Note: service startup also expects populated upstream engine assets (`vendor/F5-TTS`, model files).

### 3) `nano-qwen3tts-vllm` (port `8000`)

Recommended install flow:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pip install -e .
.venv\Scripts\python api_server.py
```

Important: the project requires Linux/WSL2 runtime for Triton/Flash-Attention in practical deployments.

## UI/API Usage

### Health checks (through backend)

- `GET /api/tts/health?provider=f5|qwen|gcloud`

### Provider capabilities (for UI gating)

- `GET /api/voices/providers/capabilities`

### Voice endpoints (stable API paths)

- `GET/POST/PUT/DELETE /api/voices/*`
- `/api/admin/voices*`

Behavior now:

- `provider=f5`: normal CRUD
- `provider=qwen`: `501` until `QWEN_VOICE_SERVICE_URL` is configured

## Local Endpoint UI Flow

1. Open Local TTS settings.
2. Choose provider (`f5` or `qwen`).
3. Save endpoint (`http(s)://host[:port]`, no path/query/credentials).
4. Optionally save endpoint API key.
5. Enable local mode in TTS settings (`f5_local` / `qwen_local`).

## Smoke Checklist

1. `GET /api/tts/health?provider=f5` returns healthy.
2. `GET /api/tts/health?provider=qwen` returns healthy (or explicit gateway-required status).
3. Synthesis via backend/gateway works for `provider=f5` and `provider=qwen`.
4. F5 voice CRUD works via backend routes.
5. Qwen voice CRUD is blocked with explicit `501` UX until qwen voice upstream is configured.
