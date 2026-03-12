# Local TTS Integration (Gateway + F5 + Qwen)

Last updated: 2026-03-12

Current implementation status lives in `docs/STATUS_TRACKER.md`.

## Goal

Зафиксировать три topology-модели TTS вокруг `bot_service`, сохраняя единый frontend boundary:

- frontend -> `bot_service` only
- self-hosted endpoint -> пользователь сам поднимает TTS и подключает URL через `local_tts_endpoints`
- project-hosted worker -> отдельный воркер проекта, хостится вашей инфраструктурой и подключается как фиксированный upstream URL
- gateway-managed -> `bot_service -> tts-gateway -> project-hosted workers`
- voice/admin CRUD -> provider-owned APIs (`f5` now, `qwen` later)

## Terminology

- `self-hosted endpoint`: пользовательский endpoint, который настраивается через экран Local TTS. Флаги `use_local`, `f5_local`, `qwen_local` пока остаются legacy naming именно для этого режима.
- `project-hosted worker`: отдельный runtime-воркер проекта. Это не self-hosted режим пользователя.
- `gateway-managed`: управляемый путь через `tts-gateway`; gateway маршрутизирует запросы в project-hosted workers.

## Runtime Contract

1. Auth mode for upstreams is strict API-key.
2. `bot_service` sends both headers:
   - `Authorization: Bearer <key>`
   - `X-API-Key: <key>`
3. Managed `qwen` synthesis requires configured gateway (`TTS_GATEWAY_URL`).
4. If `QWEN_VOICE_SERVICE_URL` is empty, qwen voice/admin CRUD returns `501` with machine-readable detail.
5. `local_tts_endpoints` в runtime означают self-hosted endpoints пользователей. Provider parity differs:
   - `f5`: saved endpoint `api_key` is used for health/synthesis and matches the upstream service contract.
   - `qwen`: current upstream engine accepts synthesis traffic, but native contract parity is not finished yet; `bot_service` uses a compatibility adapter for the self-hosted path until upstream auth/health/status/synthesis parity is implemented.

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

Current upstream gaps relevant to this repo:

- no strict API-key auth in repo code
- no `GET /health`, `/health/live`, or `/health/ready`
- no summary `GET /api/status` without `stream_id`
- current code does not read `API_KEY` or `PORT` env

Practical implication:

- gateway-managed Qwen remains the primary managed production path
- the project-hosted Qwen worker is expected behind gateway-managed routing
- self-hosted Qwen works through a backend compatibility adapter in this repo
- native upstream parity is still pending and tracked separately

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
   - For `f5` this maps to a real upstream auth contract.
   - For current `qwen` upstream code the key is effectively reserved, because auth is not enforced there yet.
   - The UI marks current `qwen` self-hosted path as a compatibility path and shows provider-specific warnings instead of presenting it as native parity with `f5`.
5. Enable self-hosted mode in TTS settings.
   - Backend/runtime flags remain `f5_local` / `qwen_local` for now as legacy naming.

## Smoke Checklist

1. `GET /api/tts/health?provider=f5` returns healthy.
2. `GET /api/tts/health?provider=qwen` returns healthy (or explicit gateway-required status).
3. Synthesis via backend/gateway works for `provider=f5` and `provider=qwen`.
4. F5 voice CRUD works via backend routes.
5. Qwen voice CRUD is blocked with explicit `501` UX until qwen voice upstream is configured.
6. Self-hosted Qwen connection checks use a compatibility probe because the upstream repo does not yet provide native `/health`.
7. Current backend/UI return Qwen-specific contract warnings when native parity is missing and the compatibility adapter is being used.
8. Upstream completion work is tracked in `docs/backlog/QWEN_UPSTREAM_PARITY_TASKS_2026-03-12_RU.md`.
