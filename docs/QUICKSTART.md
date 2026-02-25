# Quickstart

If repository layout is unclear, read `docs/REPO_STRUCTURE.md` first.

## Requirements

- Python 3.10+
- Node.js 22+
- PostgreSQL
- Optional: external `F5_tts` repository for advanced F5 TTS

## 1) Bootstrap

```powershell
git clone <repo>
cd TTS_TTV_0.02
```

## 2) Configure environment

```powershell
cp bot_service/.env.example bot_service/.env
cp frontend/.env.example frontend/.env
```

Minimum backend env values:

- `DATABASE_URL`
- `SECRET_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

## 3) Run migrations

```powershell
cd bot_service
alembic upgrade head
```

## 4) Start services

```powershell
# Terminal 1: backend
cd bot_service
python main.py

# Terminal 2: frontend
cd frontend
npm install
npm run dev
```

Optional external TTS service:

```powershell
cd <F5_tts-repo>
python main.py
```

## 5) Verify

1. Open `http://localhost:5173`
2. Sign in with Twitch or VK
3. Open settings and verify TTS controls are available
4. Check backend health: `http://localhost:8000/health`

## Troubleshooting

- `ModuleNotFoundError`: activate venv (`.\.venv\Scripts\Activate.ps1`)
- OAuth redirect mismatch: verify callback URLs in provider consoles
- DB connection errors: check `DATABASE_URL` and PostgreSQL status

## Workspace Cleanup (Release-Oriented)

Preview only:

```powershell
.\scripts\prepare-release.ps1
```

Apply cleanup:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup
```

Cleanup + checks:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup -RunChecks
```

Also clean bytecode inside `.venv`:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup -IncludeVenvCaches
```
