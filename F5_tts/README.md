# F5_tts Service

`F5_tts` is the F5 synthesis backend used by `bot_service`.

This folder is maintained in extraction-ready state for moving into a standalone repository (`f5-tts-service`).

## Service Scope

Handles:

- synthesis API (`/api/tts/*`)
- voice storage/management API (`/api/tts/voices/*`, `/api/admin/*`)
- health/readiness API (`/health/live`, `/health/ready`)
- optional Redis worker-pool mode

Out of scope:

- Google Cloud TTS runtime behavior
- Qwen provider runtime behavior
- frontend routing/UI logic

## Docs

- `docs/README.md`
- `docs/API_CONTRACT.md`
- `docs/DEPLOYMENT.md`
- `docs/RUNBOOK.md`
- `docs/MIGRATION_TO_STANDALONE.md`

## Local Run

```bash
cp .env.example .env
pip install -r requirements.txt
python main.py
```

Health:

- `GET http://localhost:8001/health/live`
- `GET http://localhost:8001/health/ready`

## Docker Run (inside `F5_tts/`)

Simple profile:

```bash
docker compose -f deploy/docker-compose.simple.yml up -d --build
```

Advanced profile (Redis + workers):

```bash
docker compose -f deploy/docker-compose.advanced.yml up -d --build
```

## Extraction Helper

From monorepo root:

```powershell
.\scripts\dev\prepare_f5_tts_export.ps1 -OutputDir artifacts/f5-tts-service -FlatLayout
```

This produces export bundle ready to initialize a dedicated repository.

## Integration Contract

- Primary internal auth: service JWT (`Authorization: Bearer ...`)
- Temporary compatibility: `X-Internal-Service-Key`
- `bot_service` depends on stable endpoint contracts; apply deprecation headers before breaking changes.
