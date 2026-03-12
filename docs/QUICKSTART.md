# Quickstart

If repository layout is unclear, read `docs/REPO_STRUCTURE.md` first.
If you need current migration status before making changes, read `docs/STATUS_TRACKER.md`.

## Requirements

- Python 3.10+
- Node.js 22+
- PostgreSQL
- Optional external TTS stack:
  - `tts-gateway`
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`

## 1) Bootstrap

```powershell
git clone <repo>
cd TTS_TTV_0.02
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2) Install dependencies in venv

```powershell
python -m pip install --upgrade pip
python -m pip install -r bot_service/requirements.txt
python -m pip install -r bot_service/requirements_dev.txt
cd frontend
npm install
cd ..
```

## 3) Configure environment

```powershell
Copy-Item bot_service/.env.example bot_service/.env
Copy-Item frontend/.env.example frontend/.env
```

Minimum backend env values for a basic run:

- `DATABASE_URL`
- `SECRET_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Advanced TTS env values when using the new upstream stack:

- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY`
- optional: `QWEN_VOICE_SERVICE_URL`

## 4) Run migrations

```powershell
cd bot_service
alembic upgrade head
```

## 5) Start services

```powershell
# Terminal 1: backend
.\.venv\Scripts\Activate.ps1
cd bot_service
python main.py

# Terminal 2: frontend
cd frontend
npm run dev
```

## 6) Optional external TTS stack

Use separate environments per external repo. Current upstream runbook is documented in `docs/setup/LOCAL_TTS_INTEGRATION.md`.

Supported runtime topology:

```powershell
tts-gateway (8010) -> f5-tts-service (8011) + nano-qwen3tts-vllm (8000)
```

## 7) Verify

1. Open `http://localhost:5173`
2. Sign in with Twitch or VK
3. Open settings and verify TTS controls are available
4. Check backend health: `http://localhost:8000/health`
5. Check provider health through backend:
   - `http://localhost:8000/api/tts/health?provider=f5`
   - `http://localhost:8000/api/tts/health?provider=qwen`

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
