# Deployment

Last updated: 2026-02-23

## Prerequisites

- Docker + Docker Compose v2.
- NVIDIA runtime (if GPU synthesis is required).
- Filled `.env` (start from `.env.example`).

## Environment

Required:

- `SECRET_KEY`
- `DATABASE_URL` (PostgreSQL)

Recommended:

- `TTS_INTERNAL_API_KEY` (compatibility fallback)
- `INTERNAL_SERVICE_JWT_SECRET`
- `INTERNAL_SERVICE_JWT_ISSUER`
- `INTERNAL_SERVICE_JWT_AUDIENCE`
- `INTERNAL_SERVICE_JWT_ALLOWED_SUBJECTS`

Advanced mode only:

- `REDIS_URL`
- `GPU_REDIS_URL`

## Standalone Compose Profiles

From `F5_tts/` root:

### Simple (single API instance, PostgreSQL, no worker pool)

```bash
docker compose -f deploy/docker-compose.simple.yml up -d --build
```

### Advanced (API + Redis + workers)

```bash
docker compose -f deploy/docker-compose.advanced.yml up -d --build
```

## Health Validation

```bash
curl -f http://localhost:8001/health/live
curl -f http://localhost:8001/health/ready
```

## Security Baseline

- Do not expose PostgreSQL/Redis ports publicly.
- Keep secrets in environment or orchestrator secret store.
- Use service JWT as primary inter-service auth.
- Keep internal fallback key only for transition period.

