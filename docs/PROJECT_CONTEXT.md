# Project Context

Last updated: 2026-03-12

This document gives automation agents a compact, current snapshot of the repository.

## Read Order For Agents

- `docs/STATUS_TRACKER.md`
- `docs/setup/LOCAL_TTS_INTEGRATION.md`
- `docs/setup/LIVE_SMOKE_RUNBOOK.md`
- `docs/setup/REPO_SPLIT_GUIDE.md`
- `docs/setup/DOCKER_DEPLOYMENT.md`
- `docs/architecture/TTS_ARCHITECTURE.md`

## Current Delivery Phase

- Backend/frontend contract migration for `tts-gateway + f5-tts-service + nano-qwen3tts-vllm` is implemented in this repo.
- Local code-level validation is green.
- Active auth/TTS runtime is authenticated-user only. Guest mode is removed from active backend/frontend flows.
- Compose entrypoints were validated at config level:
  - `deploy/docker/docker-compose.dev.yml` passes `docker compose config -q`
  - `deploy/docker/docker-compose.bot.yml` passes config validation, but warns until runtime secrets are supplied
  - `deploy/docker/docker-compose.prod.yml` remains blocked until required database/redis/app env values are provided
- Full live stack smoke is still pending external prerequisites:
  - Redis for `tts-gateway`
  - populated model/vendor assets for `f5-tts-service`
  - Linux or WSL2 runtime for `nano-qwen3tts-vllm`
- Frontend split preparation is at API-boundary stage, not at repository extraction stage yet.

## Current TTS Direction

- `tts-gateway` is the primary advanced-provider orchestrator.
- Deployment topology terms in this repo:
  - `self-hosted endpoint`: пользователь сам поднимает TTS-сервис и подключает его через `local_tts_endpoints`; текущие флаги `use_local`, `f5_local`, `qwen_local` являются legacy naming именно для этого режима.
  - `project-hosted direct worker`: отдельный воркер проекта, хостится вашей инфраструктурой и подключается как фиксированный upstream (`F5_TTS_SERVICE_URL`; для Qwen direct path в core runtime сейчас не является основным).
  - `gateway-managed`: `bot_service -> tts-gateway -> project-hosted workers`.
- Advanced provider model is provider-aware and includes:
  - `gcloud` (Google Cloud TTS)
  - `f5` (advanced F5 provider)
  - `qwen` (Qwen 3 TTS provider)
- Basic Google TTS remains the fallback path when advanced synthesis fails.
- Self-hosted endpoints are supported for both `f5` and `qwen`.
- Managed `f5` synthesis is gateway-managed first, with project-hosted direct fallback if gateway is unavailable.
- Managed `qwen` synthesis is gateway-managed only in this repo.
- Qwen voice CRUD is staged: default `501` until `QWEN_VOICE_SERVICE_URL` is configured.

## Repository Naming

- Advanced F5 TTS service is externalized into a separate repository/deployment.
- Legacy root directory `tts_service/` has been removed.
- Docker compose files may still use legacy service-name aliases (`tts_service`) for network compatibility.

## Database Policy

- Production/runtime database is PostgreSQL.
- SQLite is allowed only in explicit test contexts.

## Key Integration Rules

- TTS upstream auth is strict API-key (`Authorization` + `X-API-Key`).
- Authenticated user state is the only active runtime identity model for TTS/user settings flows.
- Existing `local`/`cloud` flags in settings are retained as runtime naming, but operationally they map to self-hosted endpoint vs managed path.
- Qwen managed synthesis is gateway-managed only.
- Qwen voice CRUD is intentionally disabled by default in this repo and returns `501` until `QWEN_VOICE_SERVICE_URL` is configured.
- Google Cloud keeps voice selection controls.
- Whitelist and bot-service safety controls apply to advanced providers.
- TTS blocked-user additions now validate that the target viewer exists: Twitch uses Helix with local-history fallback, VK uses known local users/chat history; unknown users are rejected instead of being silently added.
- Frontend runtime must talk only to `bot_service` API/WS. Do not restore direct runtime `VITE_TTS_SERVICE_URL` usage.

## Useful Docs

- `docs/STATUS_TRACKER.md`
- `docs/setup/REPO_SPLIT_GUIDE.md`
- `docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md`
- `docs/setup/LOCAL_TTS_INTEGRATION.md`
- `docs/setup/LIVE_SMOKE_RUNBOOK.md`
- `docs/setup/DOCKER_DEPLOYMENT.md`
- `docs/architecture/TTS_ARCHITECTURE.md`

## Update Discipline

- After each substantial implementation session, update `docs/STATUS_TRACKER.md`.
- If a runtime contract changes, update the relevant setup/architecture doc in the same session.
