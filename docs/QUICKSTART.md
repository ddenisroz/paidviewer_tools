# Quickstart

## Requirements
- Python 3.10+
- Node.js 18+
- PostgreSQL (SQLite can be used for quick dev testing)
- GPU optional for F5-TTS

## 1) Bootstrap
```powershell
git clone <repo>
cd TTS_TTV_0.02

# Windows
.\scripts\migrate.ps1

# Linux/Mac
./scripts/migrate.sh
```

## 2) Configure env
Copy the examples and fill in required keys:
```powershell
cp bot_service/.env.example bot_service/.env
cp frontend/.env.example frontend/.env
cp tts_service/.env.example tts_service/.env
cp tts_service_simple/.env.example tts_service_simple/.env
```

Required backend fields (minimum):
- `DATABASE_URL`
- `SECRET_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Optional backend fields:
- `DEEPSEEK_API_KEY` (enables `!analyze`)
- `GOOGLE_CLOUD_API_KEY` (Google Cloud TTS + YouTube Data API)

## 3) Migrate database
```powershell
cd bot_service
alembic upgrade head
```

## 4) Start services
```powershell
# Backend
cd bot_service
python main.py

# Frontend
cd frontend
npm install
npm run dev

# TTS (choose one)
cd tts_service
python main.py

# or
cd tts_service_simple
python run.py
```

## 5) First run
1. Open `http://localhost:5173`
2. Sign in with Twitch
3. Enable TTS in settings

## Troubleshooting
- `ModuleNotFoundError`: activate venv `.\.venv\Scripts\Activate.ps1`
- `Connection refused`: check PostgreSQL is running
- OAuth redirect errors: confirm `REDIRECT_URI` in Twitch console
