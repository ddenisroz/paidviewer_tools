# Repo Split Guide (Core + F5_tts + Qwen)

This guide describes how to split the monorepo into independent repositories while keeping runtime compatibility.

## 1. Target repositories

1. `ttv-core`
- Contains: `bot_service/`, `frontend/`, shared docs, integration docker files.
- Owns provider routing (gcloud / f5 / qwen), fallback logic, admin UI, whitelist checks, moderation settings.

2. `f5-tts-service`
- Contains: `F5_tts/` only (plus service-level README, Dockerfiles, CI).
- Owns F5 synthesis, F5 voice storage, F5 health, worker pool.

3. `qwen3-tts-service` (or external upstream + adapter)
- Contains: Qwen runtime service and API adapter contract expected by `ttv-core`.
- If using external upstream, keep a thin adapter repo with stable API for `ttv-core`.

## 2. Naming and folder baseline

- In monorepo keep folder name `F5_tts/`.
- In extracted repo use root folder `F5_tts/` or flat service root (same code).
- Keep Docker service name `tts_service` only if you need backward compatibility in compose networks.

## 3. Contract freeze before split

Freeze and version endpoints used by `ttv-core`:

- `POST /api/tts/synthesize-channel`
- `GET /api/tts/voices`
- `POST /api/admin/voices/upload`
- `GET /health/live`
- `GET /health/ready`
- `GET /health` (legacy alias, compatibility)
- `GET /api/health` (legacy alias, compatibility)

Security contract:

- Primary: `Authorization: Bearer <service JWT>` with audience `f5_tts`
- Compatibility fallback: `X-Internal-Service-Key: <TTS_INTERNAL_API_KEY>`
- Shared signing secret consistency where required: `SECRET_KEY` (or dedicated `INTERNAL_SERVICE_JWT_SECRET`)

## 4. Extract `F5_tts` repository

1. Create new empty repository `f5-tts-service`.
2. Copy from monorepo:
- `F5_tts/**`
- `docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md`
- `deploy/docker/docker-compose.tts-simple.yml`
- `deploy/docker/docker-compose.tts-advanced.yml`
3. In copied compose files, keep paths local to new repo root (no `../../` links).
4. Add CI steps:
- `ruff check .`
- `ruff format --check .`
- service smoke test (`/health/live`, `/health/ready` + one synthesis dry-run)
5. Publish first image tag (example): `ghcr.io/<org>/f5-tts-service:<tag>`.

## 5. Prepare `ttv-core` after extraction

1. Remove local `F5_tts` build dependency from core compose files.
2. Point `TTS_SERVICE_URL`/`F5_TTS_SERVICE_URL` to deployed `f5-tts-service` URL.
3. Keep fallback chain in `bot_service`:
- provider (`f5` or `qwen`) fails -> fallback to base gcloud/basic TTS.
4. Keep provider-specific settings in core DB:
- gcloud voices/mood
- f5 mode (`local`/`cloud`) + endpoint
- qwen mode (`local`/`cloud`) + endpoint

## 6. Storage and DB boundaries

Minimum separation:

- F5 samples and voice metadata stored in F5 domain only.
- Qwen samples and voice metadata stored in Qwen domain only.
- Core DB stores only routing and user/provider settings, not provider-internal file paths.

Recommended schema split in core DB:

- `local_tts_providers` (provider type, mode, endpoint, auth)
- `local_tts_voices` (provider-scoped voice metadata)
- unique constraints include `provider` to avoid F5/Qwen collisions.

## 7. Environment variables by repo

`ttv-core`:

- `TTS_SERVICE_URL`
- `F5_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_URL`
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

- `DATABASE_URL` (required, explicit)
- `SECRET_KEY`
- `TTS_INTERNAL_API_KEY`
- `INTERNAL_SERVICE_JWT_SECRET` (optional; defaults to `SECRET_KEY`)
- `INTERNAL_SERVICE_JWT_ISSUER`
- `INTERNAL_SERVICE_JWT_AUDIENCE`
- `INTERNAL_SERVICE_JWT_ALLOWED_SUBJECTS`
- optional Redis/worker settings

`qwen3-tts-service`:

- provider runtime keys
- endpoint bind vars
- `TTS_INTERNAL_API_KEY` (if shared auth model is used)

## 8. Cutover plan (no-downtime)

1. Deploy `f5-tts-service` in parallel with monorepo service.
2. Run smoke checks from core host:
- `/health/live`
- `/health/ready`
- voice list API
- one synthesis request
3. Switch only `F5_TTS_SERVICE_URL` to new endpoint.
4. Monitor errors/latency for 24h.
5. Remove old monorepo F5 runtime only after stable window.

Rollback:

- Restore previous `F5_TTS_SERVICE_URL`.
- Restart `bot_service`.

## 9. Validation checklist

- No hardcoded absolute paths in `F5_tts`.
- `DATABASE_URL` required and explicit.
- Docker build works from service repo root.
- Core fallback to base TTS confirmed when F5/Qwen unavailable.
- Admin voice upload routes map to correct provider storage.
