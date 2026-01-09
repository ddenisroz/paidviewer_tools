# Project Context

> For AI sessions. Humans see [QUICKSTART.md](./QUICKSTART.md).

## Stack
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL
- **Frontend:** React 19, Vite, TypeScript, Zustand
- **TTS:** F5-TTS (GPU) / Google Cloud TTS

## Architecture
```
api/ → services/ → repositories/ → DB
```
Services own logic, repos own queries.

## Key Files
- `bot_service/main.py` — entry
- `bot_service/core/config.py` — settings
- `frontend/src/App.tsx` — routes

## Current State
Clean architecture in progress. Some services still have `db.commit()` — being migrated to repositories.

## Run
```bash
cd bot_service && python main.py   # :8000
cd frontend && npm run dev         # :5173
```
