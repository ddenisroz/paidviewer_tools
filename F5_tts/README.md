# F5 TTS Service (`F5_tts`)

Advanced F5-based TTS backend used by `bot_service`.

This service is prepared to run as a standalone repository.

## What This Service Handles

- F5 synthesis endpoints (`/api/tts/*`)
- voice management endpoints (`/api/tts/voices/*`, `/api/admin/*`)
- user/global voice storage
- optional worker-pool mode with Redis

## What It Does Not Handle

- Google Cloud TTS runtime logic (handled in `bot_service`)
- Qwen cloud runtime logic (external provider service, routed from `bot_service`)

## Local Run (without Docker)

1. Create env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Start service:

```bash
python main.py
```

Default health endpoint: `http://localhost:8001/health`

## Docker Run

Single-node profile (no Redis worker-pool):

```bash
docker compose -f deploy/docker/docker-compose.tts-simple.yml up -d
```

Advanced profile (Redis + workers):

```bash
docker compose -f deploy/docker/docker-compose.tts-advanced.yml up -d
```

## Export Helper (for `F5_tts` split)

From repo root:

```powershell
.\scripts\dev\prepare_f5_tts_export.ps1
```

Default output folder: `artifacts/F5_tts_export`.
If the folder already exists, script creates a timestamped target.
Use `-CleanExisting` to overwrite existing target path.

## Required Environment Variables

Minimum:

- `SECRET_KEY` (must match `bot_service` secret)
- `DATABASE_URL`
- `TTS_HOST`, `TTS_PORT`

Recommended:

- `TTS_INTERNAL_API_KEY` for internal service auth
- `REDIS_URL` only when using worker-pool mode

See full list in `F5_tts/.env.example`.

## Contract Notes for `bot_service`

- `bot_service` expects stable endpoints for voices and synthesis in this service.
- When changing endpoint contracts, update:
  - `bot_service/services/voice_management_service.py`
  - `bot_service/api/tts/voices_routes.py`
  - frontend API wrappers

## Extraction Checklist (`F5_tts`)

- keep env and Docker startup reproducible
- keep API contract backward-compatible
- avoid project-root hardcoded paths
- keep requirements and CUDA notes explicit
- keep service-level docs updated
