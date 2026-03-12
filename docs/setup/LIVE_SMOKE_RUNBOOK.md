# Live Smoke Runbook

Last updated: 2026-03-12

Current implementation status lives in `docs/STATUS_TRACKER.md`.

## Goal

Run the first end-to-end smoke for the current TTS topology without mixing
contract checks, upstream gaps, and infrastructure mistakes into one result.

This runbook uses three topology terms:

- `self-hosted endpoint`: user-owned TTS endpoint configured through `local_tts_endpoints`
- `project-hosted worker`: dedicated TTS runtime hosted by project infrastructure
- `gateway-managed`: `bot_service -> tts-gateway -> project-hosted workers`

Existing runtime flags `use_local`, `f5_local`, and `qwen_local` remain legacy
naming for the self-hosted path.

## Scope For First Smoke

Required:

1. `gateway-managed` synthesis for `f5`
2. `gateway-managed` synthesis for `qwen`
3. `self-hosted endpoint` for `f5`
4. `self-hosted endpoint` for `qwen` through compatibility path
5. `qwen` voice CRUD returning expected `501`

Optional in the same session:

1. `project-hosted direct worker` fallback for `f5` when gateway is disabled
2. F5 voice CRUD end-to-end through `bot_service`

Out of scope for this first smoke:

1. Native self-hosted `qwen` parity without compatibility adapter
2. Qwen voice CRUD success path
3. Frontend repo split work

## Preflight

Run the local preflight before starting services:

```powershell
.\scripts\dev\tts-smoke-preflight.ps1 -Scenario all
```

What must be green before the first smoke:

- `bot_service/.env` exists and contains core runtime keys
- `frontend/.env` exists and points to `bot_service`
- `bot_service` has TTS upstream URLs/API keys for the managed path
- `LOCAL_TTS_ALLOWED_HOSTS` / `LOCAL_TTS_ALLOWED_CIDRS` are configured for self-hosted endpoint tests

What the preflight cannot fully prove:

- Redis is actually reachable from `tts-gateway`
- F5 assets/weights/vendor files are really present in external repo checkout
- Qwen runtime is actually running in Linux/WSL2 with GPU/toolchain support
- per-user self-hosted endpoint config already exists in DB
- the chosen user is authenticated and whitelisted for self-hosted toggles

## Upstream Prerequisites

Before starting `bot_service`, make sure the external stack is ready:

### `tts-gateway`

- Redis reachable
- gateway API keys configured
- F5 and Qwen upstream URLs configured

### `f5-tts-service`

- API keys configured
- DB configured
- upstream engine assets present (`vendor/F5-TTS`, weights, prewarm dependencies)

### `nano-qwen3tts-vllm`

- Linux or WSL2 runtime
- model/runtime dependencies installed
- current upstream contract limitations understood:
  - no native `/health`
  - no strict auth parity
  - no summary `/api/status`

## Launch Order

Recommended order:

1. PostgreSQL
2. Redis
3. `f5-tts-service`
4. `nano-qwen3tts-vllm`
5. `tts-gateway`
6. `bot_service` migrations
7. `bot_service`
8. `frontend`

Minimal checks during startup:

1. `bot_service` responds on `/health`
2. frontend loads and authenticates against `bot_service`
3. gateway process is alive before managed synth tests

## Stable Entry Points

Use these backend entry points during smoke:

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- `GET /api/local-tts/config?provider=f5|qwen`
- `POST /api/local-tts/test-connection`
- `POST /api/local-tts/config`
- `POST /api/local-tts/toggle?provider=f5|qwen`
- `POST /api/tts/settings`
- `POST /api/tts/synthesize`

Voice CRUD expectations:

- `f5`: normal provider-owned voice/admin path
- `qwen`: expected `501` until `QWEN_VOICE_SERVICE_URL` exists

## Scenario Matrix

### S1. Gateway-Managed F5

Settings payload:

```json
{
  "engine": "f5tts",
  "advancedProvider": "f5",
  "f5Mode": "cloud",
  "useLocalTTS": false
}
```

Checks:

1. `GET /api/tts/health?provider=f5` -> `healthy=true`
2. `POST /api/tts/settings` with payload above -> success
3. `POST /api/tts/synthesize` with sample text -> success

Expected result:

- synthesis works through managed path
- returned audio is served by `bot_service` or provider path expected by current contract

### S2. Gateway-Managed Qwen

Settings payload:

```json
{
  "engine": "qwen",
  "advancedProvider": "qwen",
  "qwenMode": "cloud",
  "useLocalTTS": false
}
```

Checks:

1. `GET /api/tts/health?provider=qwen` -> `healthy=true` if gateway path is live
2. `POST /api/tts/settings` with payload above -> success
3. `POST /api/tts/synthesize` with sample text -> success

Expected result:

- synthesis works through gateway-managed path
- frontend remains backend-only, with no direct upstream URL dependency

### S3. Self-Hosted F5 Endpoint

Checks:

1. `POST /api/local-tts/test-connection` with `provider=f5`
2. `POST /api/local-tts/config` with self-hosted endpoint URL
3. `POST /api/local-tts/toggle?provider=f5`
4. `POST /api/tts/settings`

Settings payload:

```json
{
  "engine": "f5tts",
  "advancedProvider": "f5",
  "f5Mode": "local",
  "useLocalTTS": true
}
```

Expected result:

- health and toggle succeed
- synth requests use user-configured self-hosted endpoint

### S4. Self-Hosted Qwen Endpoint

Checks:

1. `POST /api/local-tts/test-connection` with `provider=qwen`
2. `POST /api/local-tts/config` with self-hosted endpoint URL
3. `POST /api/local-tts/toggle?provider=qwen`
4. `POST /api/tts/settings`

Settings payload:

```json
{
  "engine": "qwen",
  "advancedProvider": "qwen",
  "qwenMode": "local",
  "useLocalTTS": true
}
```

Expected result:

- connection succeeds with Qwen compatibility warning
- message mentions self-hosted compatibility path
- synth requests work through `/api/prepare -> /api/stream/{id}` adapter

### S5. Qwen Voice CRUD Guard

Checks:

1. `GET /api/voices/providers/capabilities`
2. open Qwen voice management UI
3. call a Qwen voice/admin route through `bot_service`

Expected result:

- Qwen capability is marked unavailable for CRUD
- backend returns explicit `501`
- UI shows capability-aware disabled state instead of broken actions

## Pass Criteria

The first smoke is considered successful when:

1. `f5` and `qwen` managed synthesis both work through the gateway-managed path
2. `f5` self-hosted endpoint works
3. `qwen` self-hosted endpoint works through compatibility path with expected warnings
4. `qwen` voice CRUD returns expected `501`
5. frontend remains backend-only during the whole run

## Acceptable Known Results

These are not failures in the first smoke:

1. Qwen self-hosted path shows compatibility warnings
2. Qwen voice CRUD returns `501`
3. `project-hosted direct worker` for Qwen is not exercised as a success path

## Follow-Up After First Smoke

If the smoke passes:

1. run F5 voice CRUD end-to-end
2. test gateway failure behavior for `f5` direct fallback
3. move Qwen upstream parity tasks into the external repo backlog

If the smoke fails:

1. separate infra failure from contract failure
2. record the failing topology (`self-hosted`, `project-hosted direct worker`, or `gateway-managed`)
3. keep `qwen` compatibility issues separate from gateway/F5 regressions
