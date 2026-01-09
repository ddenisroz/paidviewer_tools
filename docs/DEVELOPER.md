# Dev Setup

```bash
# Backend
cd bot_service
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python main.py

# Frontend
cd frontend
npm install && npm run dev
```

## Structure
```
bot_service/
├── api/           # FastAPI routes
├── services/      # Business logic
├── repositories/  # DB access
└── integrations/  # Twitch, VK, TTS

frontend/
├── features/      # Feature modules
├── stores/        # Zustand
└── queries/       # TanStack Query
```

## Rules
1. Services don't touch DB directly — use repos
2. API routes don't contain logic — delegate to services
3. Components don't fetch — use queries

## Commands
```bash
ruff check .     # lint
black .          # format
npm run lint     # frontend
```
