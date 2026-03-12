# TTS_TTV

Streamer platform: dashboard + bot service + TTS integrations (Twitch, VK, DonationAlerts, YouTube queue, drops).

## Start Here
- [docs/QUICKSTART.md](docs/QUICKSTART.md): fastest local setup.
- [docs/STATUS_TRACKER.md](docs/STATUS_TRACKER.md): current delivery status, closed work, and open tasks.
- [docs/README.md](docs/README.md): authoritative docs index (active vs historical).
- [docs/REPO_STRUCTURE.md](docs/REPO_STRUCTURE.md): what each top-level folder is for.
- [docs/guides/REPO_CLEANUP_PLAN.md](docs/guides/REPO_CLEANUP_PLAN.md): what is already cleaned and what remains.
- [docs/setup/DEPLOYMENT.md](docs/setup/DEPLOYMENT.md): production deployment.
- [docs/architecture/ARCHITECTURE_GUIDE.md](docs/architecture/ARCHITECTURE_GUIDE.md): architecture deep dive.

## Minimal Local Run (required path)
1. Create and activate a project venv:
- `python -m venv .venv`
- Windows PowerShell: `.\.venv\Scripts\Activate.ps1`

2. Install project dependencies:
- Backend runtime: `python -m pip install -r bot_service/requirements.txt`
- Backend contributor extras: `python -m pip install -r bot_service/requirements_dev.txt`
- Frontend: `cd frontend; npm install`

3. Configure env files:
- `bot_service/.env`
- `frontend/.env`
- optional external TTS stack (recommended split):
  - `TTS_GATEWAY_URL` + `TTS_GATEWAY_API_KEY` -> `tts-gateway`
  - `F5_TTS_SERVICE_URL` + `F5_TTS_SERVICE_API_KEY` -> `f5-tts-service`
  - `QWEN_TTS_SERVICE_URL` + `QWEN_TTS_SERVICE_API_KEY` -> `nano-qwen3tts-vllm`
  - optional qwen voice CRUD extension: `QWEN_VOICE_SERVICE_URL`

4. Run DB bootstrap:
- Windows: `.\scripts\migrate.ps1`
- Linux/Mac: `./scripts/migrate.sh`

5. Start app:
- Backend: `cd bot_service; python main.py`
- Frontend: `cd frontend; npm run dev`

Frontend runtime contract:
- frontend should know only backend API/WS URLs (`VITE_BOT_SERVICE_URL`, `VITE_BOT_SERVICE_WS_URL`).
- direct runtime `VITE_TTS_SERVICE_URL` usage is deprecated.

## What Is Core vs Noise

| Path | Role | Required for runtime |
|---|---|---|
| `bot_service/` | FastAPI backend (API, auth, services, repositories, models, bots) | Yes |
| `frontend/` | React + Vite dashboard | Yes |
| `deploy/` | Docker compose and nginx configs | Yes for container deploy |
| `docs/` | Documentation | No runtime, but required for maintenance |
| `scripts/` | Tooling and migrations | No runtime, operational |
| `logs/` | Local runtime logs | No |
| `.github/` | CI workflows | No local runtime |
| `.husky/` | Git pre-commit hooks | No runtime, keep in repo |
| `.venv/` | Local Python virtual environment | No runtime artifact in git |

## Why You See Folders Like `.benchmarks`, `artifacts`, `__pycache__`

These are local or generated artifacts, not business logic.

| Folder/File | Why it appears | Keep in git | Safe to delete |
|---|---|---|---|
| `.benchmarks/` | pytest benchmark output | No | Yes |
| `artifacts/` | local test/CI-like output bundle | No | Yes |
| `**/__pycache__/` | Python bytecode cache | No | Yes |
| `bot_service/.ruff_cache/` | ruff lint cache | No | Yes |
| `bot_service/.pytest_cache/` | pytest cache | No | Yes |
| `bot_service/pytest-cache-files-*` | pytest temporary cache dirs | No | Yes |
| `frontend/dist/` | frontend build output | No | Yes |
| `logs/` | local logs | No | Yes (if logs not needed) |
| `.venv/` | local Python environment and package bytecode | No | Yes (recreate with venv/pip install) |

## Cleanup Commands
- Canonical script (single entrypoint): `.\scripts\prepare-release.ps1`
- Dry-run (shows exactly what will be deleted): `.\scripts\prepare-release.ps1`
- Apply cleanup: `.\scripts\prepare-release.ps1 -ApplyCleanup`
- Apply cleanup + checks: `.\scripts\prepare-release.ps1 -ApplyCleanup -RunChecks`
- Also clean `.venv` bytecode caches: `.\scripts\prepare-release.ps1 -ApplyCleanup -IncludeVenvCaches`

By default this script targets generated artifacts only:
- `artifacts/`, `.benchmarks/`, `playwright-report/`, `.playwright*/`
- `frontend/dist`, `frontend/coverage`, `frontend/.vite`, `frontend/.vitest`
- `.pytest_cache`, `.ruff_cache`, `.mypy_cache`, `htmlcov`
- `**/__pycache__/`, `*.pyc`, `*.pyo` (project roots; optional `.venv` via flag)
- `*.har`

## Quality Gates Before Push
- Backend: `cd bot_service; ruff check .; pytest -q`
- Frontend: `cd frontend; npm run lint; npm run type-check; npm run build`

## License
MIT
