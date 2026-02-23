# TTS_TTV

Dashboard and bot stack for streamers with TTS, chat tools, YouTube requests, and multi-platform integrations.

## Key Features
- AI TTS with multiple providers and per-user filters.
- YouTube media requests and queue management via chat commands.
- Chat overlay and moderation utilities.
- Points, rewards, and drops systems.
- Integrations for Twitch, VK Live, and DonationAlerts.
- Optional chat analysis command via DeepSeek (requires env setup).

## Project Layout
- `bot_service/` FastAPI backend (API, services, repositories, bots).
- `frontend/` React + Vite dashboard.
- `F5_tts/` Advanced F5 TTS service (prepared for extraction to standalone repository).
- `deploy/` Docker compose and deployment assets.
- `docs/` Architecture, setup, and feature docs.
- `scripts/` Project tooling and migrations.
- `scripts/dev/` One-off debug/diagnostic utilities.

## Quick Start (Local)
1. Configure env files:
   - `bot_service/.env`
   - `F5_tts/.env`
   - `frontend/.env`
   - Optional: set `DEEPSEEK_API_KEY` in `bot_service/.env` to enable `!analyze`
   - Optional: set `GOOGLE_CLOUD_API_KEY` in `bot_service/.env` for YouTube + Google Cloud TTS
2. Run migration/bootstrap:
   - Windows: `.\scripts\migrate.ps1`
   - Linux/Mac: `./scripts/migrate.sh`
3. Start services:
   - Backend: `cd bot_service; python main.py`
   - Frontend: `cd frontend; npm install; npm run dev`
   - TTS: `cd F5_tts; python main.py`

## Common Commands
- Backend: `ruff check .`, `ruff format .`, `pytest`
- Frontend: `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`

## Repository Hygiene
- Keep the repo free from local artifacts before commits:
  - remove dev-only browser traces (`.playwright-cli/`, `.playwright/`, `playwright-report/`)
  - do not commit cache/build/runtime outputs (`__pycache__/`, `.ruff_cache/`, `logs/`, `frontend/dist/`)
  - keep large one-off debug artifacts out of git (for example `*.har`)
- Fast cleanup helper: `.\scripts\cleanup-dev-artifacts.ps1`
  - optional flags: `-RemoveHarFiles -RemoveOutput -RemovePycache -RemoveTempAudio`
- Before pushing:
  - `ruff check bot_service`
  - `cd frontend; npm run type-check`

## Documentation
- `docs/README.md`
- `docs/QUICKSTART.md`
- `docs/FEATURES.md`
- `docs/setup/DEPLOYMENT.md`
- `docs/architecture/ARCHITECTURE_GUIDE.md`
- `bot_service/scripts/README_MAINTENANCE.md`

## License
MIT License
