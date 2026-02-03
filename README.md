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
- `tts_service/` Advanced shared TTS service.
- `tts_service_simple/` Lightweight personal TTS service.
- `deploy/` Docker compose and deployment assets.
- `docs/` Architecture, setup, and feature docs.
- `scripts/` Project tooling and migrations.

## Quick Start (Local)
1. Configure env files:
   - `bot_service/.env`
   - `tts_service/.env`
   - `tts_service_simple/.env`
   - `frontend/.env`
2. Run migration/bootstrap:
   - Windows: `.\scripts\migrate.ps1`
   - Linux/Mac: `./scripts/migrate.sh`
3. Start services:
   - Backend: `cd bot_service; python main.py`
   - Frontend: `cd frontend; npm install; npm run dev`
   - TTS: `cd tts_service; python main.py` (or `tts_service_simple`)

## Common Commands
- Backend: `ruff check .`, `ruff format .`, `pytest`
- Frontend: `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`

## Documentation
- `docs/README.md`
- `docs/QUICKSTART.md`
- `docs/FEATURES.md`
- `docs/setup/DEPLOYMENT.md`
- `docs/architecture/ARCHITECTURE_GUIDE.md`

## License
MIT License
