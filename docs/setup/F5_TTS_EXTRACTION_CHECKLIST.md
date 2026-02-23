# F5_tts Extraction Checklist

Last updated: 2026-02-23

This checklist tracks readiness to move `F5_tts/` into a standalone repository (`F5_tts`).

## 1. API Contract Freeze

- Keep stable endpoints used by `bot_service`:
  - `/api/tts/synthesize-channel`
  - `/api/tts/voices/*`
  - `/api/admin/voices/*`
  - `/health/live` and `/health/ready`
  - `/health` and `/api/health` (legacy compatibility aliases)
- Document request/response payloads for each public endpoint.
- Mark deprecated endpoints before removal.

## 2. Configuration and Env

- `F5_tts/.env.example` is complete and runnable.
- No hardcoded absolute paths.
- Required runtime secrets are explicit (`SECRET_KEY`, `DATABASE_URL`) and internal auth vars are explicit (`INTERNAL_SERVICE_JWT_*`, optional `TTS_INTERNAL_API_KEY` for compatibility).
- Redis settings are optional for single-node mode and required for worker-pool mode.

## 3. Docker and Runtime Profiles

- Single-node profile works: `deploy/docker/docker-compose.tts-simple.yml`.
- Advanced profile works: `deploy/docker/docker-compose.tts-advanced.yml`.
- `F5_tts/Dockerfile.prod` builds without local path assumptions.
- `.dockerignore` is present and excludes runtime artifacts.

## 4. Dependency Hygiene

- `F5_tts/requirements.txt` installs on clean environment.
- CUDA / Torch compatibility is documented.
- Optional dependencies are clearly separated from required ones.

## 5. Data and Storage Boundaries

- Voice/sample storage paths are service-local and configurable.
- Backups/logs/cache paths are externalized through Docker volumes.
- Provider-independent local storage behavior is documented.

## 6. Observability and Ops

- Liveness and readiness endpoints return service-ready signals (`/health/live`, `/health/ready`).
- Logs include synthesis failures and upstream errors.
- Minimal runbook exists (start, stop, health check, log check).

## 7. Integration with bot_service

- `bot_service` URLs configured via:
  - `TTS_SERVICE_URL`
  - `F5_TTS_SERVICE_URL`
  - `QWEN_TTS_SERVICE_URL`
- Service JWT auth verified (`Authorization: Bearer ...`, audience-scoped), with optional legacy key compatibility (`TTS_INTERNAL_API_KEY`).
- Provider-aware voice routing validated after extraction.

## 8. CI/CD Baseline (Target Repo)

- Lint + test pipeline.
- Docker build pipeline.
- Release tags and changelog flow.

## 9. Final Cutover Plan

1. Freeze API changes in current monorepo.
2. Copy `F5_tts/` to new repository.
3. Run smoke tests with existing `bot_service`.
4. Switch deployment references to new image/repo.
5. Remove duplicated service code from monorepo only after successful cutover window.

## 10. Encoding Sanity

- Run encoding scan before split/commit:
  - `python scripts/dev/check_mojibake.py --root F5_tts`
  - `python scripts/dev/check_mojibake.py --root bot_service/api`
- No user-facing API strings should contain mojibake markers (broken Cyrillic decode patterns).

