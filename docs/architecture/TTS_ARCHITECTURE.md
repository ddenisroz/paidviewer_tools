# TTS Architecture

Last updated: 2026-02-23

## 1. Current Provider Model

The project uses one runtime manager (`bot_service/services/tts/tts_manager.py`) with four synthesis paths:

- `gtts` (basic Google TTS): always available fallback.
- `gcloud` (Google Cloud TTS): advanced cloud provider with voice pool + mood.
- `f5` (advanced provider): cloud or local endpoint.
- `qwen` (advanced provider): cloud or local endpoint.

Advanced provider selection is done in the frontend and stored in user settings.

## 2. Routing and Fallback Logic

Runtime order:

1. Resolve engine/provider from user settings.
2. Try selected advanced provider (`gcloud` or `f5/qwen`).
3. If advanced synthesis fails, fallback to basic `gtts`.

Fallback is mandatory. If local endpoint is selected but unavailable, runtime falls back to `gtts`.

## 3. User Settings Contract

Main settings fields (table `tts_user_settings`):

- `engine`: `gtts | gcloud | f5tts | qwen`
- `advanced_provider`: `f5 | gcloud | qwen`
- `f5_mode`: `cloud | local`
- `qwen_mode`: `cloud | local`
- `use_local_tts`: boolean override for local mode
- `voice`: active voice name for provider-based engines
- `gcloud_voices`: selected Google Cloud voices
- `gcloud_mood`: `neutral | sad | happy`
- `qwen_voice`, `qwen_model`: optional Qwen runtime preferences

## 4. Local Endpoint Model

Local endpoints are provider-scoped in `local_tts_endpoints`:

- `provider = f5` for local F5 instance
- `provider = qwen` for local Qwen instance

This allows one user to configure both local providers independently.

## 5. Voice Storage and Separation

Voice management is provider-aware:

- User voice overrides are stored in `user_voice_settings.tts_provider`.
- API calls support `provider=f5|qwen` and route to provider-specific services.
- Sample and voice operations are isolated by provider upstream.

Google Cloud (`gcloud`) is not part of uploadable custom voice flow. It uses provider-managed cloud voices (`gcloud_voices`).

## 6. API Surface (Core)

Settings and status:

- `GET /api/tts/settings`
- `POST /api/tts/settings`
- `POST /api/tts/engine`
- `GET /api/tts/status`

Google Cloud:

- `GET /api/tts/gcloud/voices`
- `POST /api/tts/gcloud/voices`
- `POST /api/tts/gcloud/preview`

Voice management (provider-aware):

- `GET /api/voices/global?provider=f5|qwen`
- `GET /api/voices/user/custom?provider=f5|qwen`
- `POST /api/user/voices/upload?provider=f5|qwen`
- `PUT /api/voices/user/settings/{voice_id}?provider=f5|qwen`

## 7. Docker Profiles

Available compose profiles in `deploy/docker/`:

- `docker-compose.tts-advanced.yml`: `tts_service` + Redis + workers.
- `docker-compose.tts-simple.yml`: single-node `tts_service` (no Redis/worker pool).
- `docker-compose.bot.yml`: backend/frontend/database side.

## 8. Inter-Service Auth and Health

Internal auth for `bot_service -> F5_tts` now supports:

- primary: short-lived service JWT in `Authorization: Bearer <token>`
- compatibility fallback: `X-Internal-Service-Key`
- optional transport hardening: mTLS client certs for internal HTTPS calls (`INTERNAL_SERVICE_MTLS_*` in `bot_service`)

Health endpoints:

- `GET /health/live` for liveness
- `GET /health/ready` for readiness

Legacy alias `/health` remains for compatibility where still used.

## 9. F5_tts Extraction Readiness

`F5_tts` is the source directory for future standalone `F5_tts` repository.

Before extraction, keep:

- hardcoded project-relative paths removed or configurable,
- clear `.env.example` and Docker startup path,
- dependency list in sync (`requirements*.txt`),
- external API contract stable (`/api/tts/*`, `/api/admin/*`).

## 10. Frontend Behavior (Advanced TTS)

Advanced provider dropdown has three options:

- `F5 TTS`
- `Qwen 3 TTS`
- `Google Cloud TTS`

Sub-settings by provider:

- `gcloud`: voice pool + mood.
- `f5` / `qwen`: cloud vs local mode.

Browser vs OBS sink behavior remains shared across providers.
