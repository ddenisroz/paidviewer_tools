# Developer Setup

```bash
# Backend
cd bot_service
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

## Structure (high level)
```
bot_service/
  api/           FastAPI routes
  services/      Business logic
  repositories/  DB access
  integrations/  Twitch, VK, TTS

frontend/
  features/      Feature modules
  store/         Zustand state
  queries/       TanStack Query hooks
```

## Rules
1. Services do not access the DB directly - use repositories.
2. API routes contain no business logic - delegate to services.
3. Components do not fetch data - use query hooks.

## Commands
```bash
ruff check .
ruff format .
npm run lint
```
