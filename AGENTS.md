# Repository Guidelines

Contribute with small, focused changes. If behavior changes, update the docs in `docs/` and this guide.

## Project Structure & Module Organization

- `bot_service/`: FastAPI backend. Layers include `api/` (routes), `services/` (logic), `repositories/` (data access), `core/` (config/auth), and `tests/`.
- `frontend/`: React + Vite app (`src/`) with assets in `public/`.
- ChatBox UI: settings modal in `frontend/src/components/ChatBoxSettingsModal.tsx`, preview in `frontend/src/features/chatbox/components/PreviewPanel.tsx` (keep preview/overlay behavior aligned).
- `tts_service/`: Advanced shared TTS service (`python main.py`).
- `tts_service_simple/`: Personal TTS microservice (`python run.py`).
- `deploy/`: Docker compose and deployment assets.
- `docs/`: architecture and developer guides.
- `scripts/`: project tooling (e.g., design system migration).
- `logs/`: runtime logs (for example `logs/bot_service.log`, `logs/tts_service.log`).

## Build, Test, and Development Commands

- Activate venv (Windows): `.\.venv\Scripts\Activate.ps1`.
- Backend (local): `cd bot_service; python main.py` (Uvicorn is launched from `main.py`).
- Migrations: `cd bot_service; alembic upgrade head`.
- Frontend (local): `cd frontend; npm install; npm run dev`.
- Frontend build: `cd frontend; npm run build`.
- Frontend lint/format/type-check: `npm run lint`, `npm run format`, `npm run type-check`.
- Frontend tests: `npm run test` or `npm run test:coverage`.
- TTS services: `cd tts_service; python main.py` and `cd tts_service_simple; python run.py`.
- Docker dev stack: `.\start-dev.ps1` (uses compose files in `deploy/`).
- API types: `cd frontend; npm run generate-api-types`.

## Coding Style & Naming Conventions

- Python: 4-space indent, max line length 120; format with `ruff format .`, lint with `ruff check .`.
- TypeScript/React: ESLint + Prettier via `npm run lint` and `npm run format`.
- Tests follow pytest naming in `bot_service/pytest.ini` (`test_*.py`, `Test*`, `test_*`).

## Testing Guidelines

- Backend: `pytest` in `bot_service/` with coverage; `--cov-fail-under=80` enforced.
- Frontend: Vitest (`npm run test`, `npm run test:run`, `npm run test:coverage`).
- Place tests next to features in `bot_service/tests/` or `frontend/src/`.

## Commit & Pull Request Guidelines

- Commits are a mix of Conventional Commits and short summaries. Prefer `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` with optional scopes (e.g., `fix(frontend): ...`).
- PRs should include: a short description, affected services, test commands run, and screenshots for UI changes.

## Security & Configuration

- Use per-service `.env` files: `bot_service/.env`, `tts_service/.env`, `tts_service_simple/.env`, `frontend/.env`. Never commit secrets.
- Deployment guidance lives in `docs/setup/DEPLOYMENT.md`.

## Agent-Specific Instructions

- Automated agents should read `docs/PROJECT_CONTEXT.md` before large changes.

## Behavior Notes

- ChatOverlay relies on `/api/chatbox/settings/by-token` returning `twitch_user_id` to load 7TV channel emotes. Keep this field in sync when touching chatbox settings.
- YouTube mini-player renders into the sidebar slot `#youtube-mini-player-slot` when present (GlobalPlayer uses a portal).
- Browser TTS playback is active only when `listening_mode` is `website`; when set to `obs`, in-app TTS playback is suppressed (mode is persisted in `tts_listening_mode`).
- YouTube queue bans set queue items to `status='banned'` and prevent re-adding the same video via `/api/youtube/queue/ban/{queue_id}`.
- Frontend polling intervals are adaptive (reduced outside relevant pages); background polling is disabled where supported.
- Drops config/rewards responses are cached for 60s server-side with invalidation on updates; dashboard quick actions refresh every 120s.
- Stream title/category changes broadcast `stream_info_updated` over WebSocket; Twitch stream info cache is kept in sync.
- Dashboard stream-info polling runs every 120s; stream-info cache applies to both Twitch and VK.
