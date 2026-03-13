# F5 TTS Extraction Checklist

Last updated: 2026-02-24

This checklist tracks readiness for `f5-tts-service` as an independent repository and deployable service.

## 1. API Contract Freeze

- Keep stable endpoints used by `bot_service`:
  - `/api/tts/synthesize-channel`
  - `/api/tts/voices/*`
  - `/api/admin/voices/*`
  - `/health/live` and `/health/ready`
  - `/health` and `/api/health` (compatibility aliases)
- Document request/response payloads for public endpoints.
- Mark deprecated endpoints before removal.

## 2. Configuration and Env

- `f5-tts-service/.env.example` is complete and runnable.
- No hardcoded absolute paths.
- Required runtime secrets are explicit: `SECRET_KEY`, `DATABASE_URL`.
- Internal auth variables are explicit: `INTERNAL_SERVICE_JWT_*` and optional compatibility key `TTS_INTERNAL_API_KEY`.
- Redis settings are optional for single-node mode and required for worker-pool mode.

## 3. Docker and Runtime Profiles

- Standalone single-node profile works: `deploy/docker-compose.simple.yml`.
- Standalone advanced profile works: `deploy/docker-compose.advanced.yml`.
- `Dockerfile.prod` builds from service repo root without monorepo path assumptions.
- `.dockerignore` excludes runtime artifacts and caches.

## 4. Dependency Hygiene

- `requirements.txt` installs in a clean environment.
- CUDA/Torch compatibility matrix is documented.
- Optional dependencies are clearly separated from required ones.

## 5. Data and Storage Boundaries

- Voice/sample storage paths are service-local and configurable.
- Logs/cache/backups are externalized via Docker volumes.
- Storage behavior is documented for both local and cloud deployments.

## 6. Observability and Ops

- Liveness/readiness endpoints return service-ready signals.
- Logs include synthesis failures and upstream errors.
- Runbook includes start/stop/health/log and incident recovery steps.

## 7. Integration with bot_service

- `bot_service` URLs configured via:
  - `F5_TTS_SERVICE_URL`
  - `QWEN_TTS_SERVICE_URL`
- Service JWT auth verified (`Authorization: Bearer ...`, audience-scoped), with optional legacy key compatibility (`TTS_INTERNAL_API_KEY`).
- Provider-aware routing works after extraction (F5 vs Qwen).

## 8. CI/CD Baseline (Target Repo)

- Lint + tests pipeline is green.
- Docker build pipeline is green.
- Security scan and smoke checks run on PR.
- Release tagging/changelog flow is defined.

## 9. Final Cutover Plan

1. Freeze API changes in current monorepo.
2. Ensure `f5-tts-service` repository contains full service code + docs.
3. Run smoke tests against current `bot_service`.
4. Switch deployment to `f5-tts-service` image/repo.
5. Monitor synthesis errors/latency for cutover window.
6. Remove duplicated local service code from monorepo only after stable window.

## 10. Encoding Sanity

- Run encoding scan before split/commit:
  - `python scripts/dev/check_mojibake.py --root bot_service/api`
  - `python scripts/dev/check_mojibake.py --root docs`
- No user-facing API strings should contain mojibake markers.
