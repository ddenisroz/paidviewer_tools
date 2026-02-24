# TTS_TTV

Streamer platform: dashboard + bot service + TTS integrations (Twitch, VK, DonationAlerts, YouTube queue, drops).

## Start Here
- [docs/QUICKSTART.md](docs/QUICKSTART.md): fastest local setup.
- [docs/REPO_STRUCTURE.md](docs/REPO_STRUCTURE.md): what each top-level folder is for.
- [docs/guides/REPO_CLEANUP_PLAN.md](docs/guides/REPO_CLEANUP_PLAN.md): what is already cleaned and what remains.
- [docs/setup/DEPLOYMENT.md](docs/setup/DEPLOYMENT.md): production deployment.
- [docs/architecture/ARCHITECTURE_GUIDE.md](docs/architecture/ARCHITECTURE_GUIDE.md): architecture deep dive.

## Minimal Local Run (required path)
1. Configure env files:
- `bot_service/.env`
- `frontend/.env`
- optional external TTS service env (if used): separate `F5_tts` repository.

2. Run DB bootstrap:
- Windows: `.\scripts\migrate.ps1`
- Linux/Mac: `./scripts/migrate.sh`

3. Start app:
- Backend: `cd bot_service; python main.py`
- Frontend: `cd frontend; npm install; npm run dev`

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
