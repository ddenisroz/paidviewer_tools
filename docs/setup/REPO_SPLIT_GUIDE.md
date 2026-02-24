# Repo Split Guide (ttv-core + f5-tts-service + qwen3-tts-service)

This guide describes how to split the monorepo into independent repositories while keeping runtime compatibility.

## 1. Target repositories

1. `ttv-core`
- Contains: `bot_service/`, `frontend/`, shared docs, integration docker files.
- Owns provider routing (gcloud / f5 / qwen), fallback logic, admin UI, and moderation settings.

2. `f5-tts-service`
- Contains only the F5 TTS service code, service docs, Dockerfiles, and CI.
- Owns F5 synthesis, voice storage, health checks, and worker pool.

3. `qwen3-tts-service` (or external upstream + adapter)
- Contains Qwen runtime service and API adapter expected by `ttv-core`.
- If using upstream directly, keep a thin adapter with stable API contract.

## 2. Naming baseline

- Keep extracted service naming as `f5-tts-service`.
- If backward compatibility is needed in Docker networks, keep service name `tts_service`.

## 3. Contract freeze before split

Freeze and version endpoints used by `ttv-core`:

- `POST /api/tts/synthesize-channel`
- `GET /api/tts/voices`
- `POST /api/admin/voices/upload`
- `GET /health/live`
- `GET /health/ready`
- `GET /health` (compatibility alias)
- `GET /api/health` (compatibility alias)

Security contract:

- Primary: `Authorization: Bearer <service JWT>` with audience `f5_tts`
- Compatibility fallback: `X-Internal-Service-Key: <TTS_INTERNAL_API_KEY>`
- Shared signing secret where required: `SECRET_KEY` or dedicated `INTERNAL_SERVICE_JWT_SECRET`

## 4. Extract `f5-tts-service`

1. Create a new empty repository `f5-tts-service`.
2. Copy F5 service files from current source into repo root.
3. Ensure repo includes:
- service runtime code
- `deploy/docker-compose.simple.yml`
- `deploy/docker-compose.advanced.yml`
- `README.md`, `docs/RUNBOOK.md`, `.env.example`, `.dockerignore`
4. Normalize compose paths to local repo root (no monorepo-relative links).
5. Add CI checks:
- `ruff check .`
- `ruff format --check .`
- smoke test (`/health/live`, `/health/ready`, synthesis dry-run)
6. Publish first image tag: `ghcr.io/<org>/f5-tts-service:<tag>`.

## 5. Prepare `ttv-core` after extraction

1. Remove local F5 build dependency from core compose files.
2. Point `F5_TTS_SERVICE_URL` to deployed `f5-tts-service` URL.
3. Keep fallback chain in `bot_service`:
- provider (`f5` or `qwen`) fails -> fallback to base gcloud/basic TTS.
4. Keep provider-specific settings in core DB:
- gcloud voices/mood
- f5 mode (`local` / `cloud`) + endpoint
- qwen mode (`local` / `cloud`) + endpoint

## 6. Storage and DB boundaries

Minimum separation:

- F5 samples and voice metadata are stored in F5 domain only.
- Qwen samples and voice metadata are stored in Qwen domain only.
- Core DB stores routing and settings, not provider-internal filesystem paths.

Recommended schema split in core DB:

- `local_tts_providers` (provider type, mode, endpoint, auth)
- `local_tts_voices` (provider-scoped voice metadata)
- include `provider` in unique constraints to avoid F5/Qwen collisions.

## 7. Environment variables by repo

`ttv-core`:

- `F5_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_URL`
- `F5_TTS_STORAGE_ROOT` (optional; only for local maintenance tasks)
- `TTS_INTERNAL_API_KEY`
- `INTERNAL_SERVICE_JWT_ENABLED`
- `INTERNAL_SERVICE_JWT_ISSUER`
- `INTERNAL_SERVICE_JWT_AUDIENCE_TTS`
- `INTERNAL_SERVICE_JWT_SECRET`
- `INTERNAL_SERVICE_JWT_TTL_SECONDS`
- `INTERNAL_SERVICE_MTLS_ENABLED`
- `INTERNAL_SERVICE_CA_CERT_PATH`
- `INTERNAL_SERVICE_CLIENT_CERT_PATH`
- `INTERNAL_SERVICE_CLIENT_KEY_PATH`

`f5-tts-service`:

- `DATABASE_URL` (required)
- `SECRET_KEY`
- `TTS_INTERNAL_API_KEY`
- `INTERNAL_SERVICE_JWT_SECRET` (optional; defaults to `SECRET_KEY`)
- `INTERNAL_SERVICE_JWT_ISSUER`
- `INTERNAL_SERVICE_JWT_AUDIENCE`
- `INTERNAL_SERVICE_JWT_ALLOWED_SUBJECTS`
- optional Redis/worker settings

`qwen3-tts-service`:

- runtime keys and bind vars
- `TTS_INTERNAL_API_KEY` (if shared auth model is used)

## 8. Cutover plan (no downtime)

1. Deploy `f5-tts-service` in parallel with current runtime.
2. Run smoke checks from core host:
- `/health/live`
- `/health/ready`
- voice list endpoint
- one synthesis request
3. Switch only `F5_TTS_SERVICE_URL` to new endpoint.
4. Monitor error rate and latency for 24h.
5. Remove old local F5 runtime after stable window.

Rollback:

- Restore previous `F5_TTS_SERVICE_URL`.
- Restart `bot_service`.

## 9. Validation checklist

- No hardcoded absolute paths.
- `DATABASE_URL` is required and explicit.
- Docker build works from service repo root.
- Core fallback to base TTS is confirmed when F5/Qwen are unavailable.
- Admin voice upload routes map to correct provider storage.
