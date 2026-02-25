# Developer Onboarding

This guide is for a first productive day in the repository.

## 1) Read Order

1. `README.md`
2. `docs/QUICKSTART.md`
3. `docs/REPO_STRUCTURE.md`
4. `docs/architecture/ARCHITECTURE_GUIDE.md`
5. `docs/guides/DEVELOPER_GUIDE.md`

## 2) Local Setup

Backend:

```powershell
cd bot_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python main.py
```

Frontend:

```powershell
cd frontend
npm install
cp .env.example .env
npm run dev
```

## 3) Verify Baseline

- Backend docs: `http://localhost:8000/docs`
- Frontend: `http://localhost:5173`
- Backend tests: `cd bot_service; pytest -q`
- Frontend checks: `cd frontend; npm run lint; npm run type-check`

## 4) Key Runtime Contracts

- User OAuth entrypoints: `/auth/twitch/login`, `/auth/vk/login`.
- User OAuth callbacks: `/auth/twitch/callback`, `/auth/vk/callback`.
- Session auth uses `session_id` cookie.
- Admin authority source is `users.role='admin'`; `is_admin` is compatibility only.
- Real-time sync is WebSocket (not SSE), with tab leader election on frontend.

## 5) First Contribution Checklist

1. Confirm feature scope and impacted services.
2. Implement minimal change set.
3. Add/adjust tests.
4. Run quality gates:
   - `cd bot_service; ruff check .; pytest -q`
   - `cd frontend; npm run lint; npm run type-check`
5. Update related docs in `docs/`.

## 6) Common Pitfalls

- Do not reintroduce guest/anonymous auth flows.
- Do not trust auth info from client path/query; validate session/user in backend.
- Do not hardcode local URLs/ports in runtime code.
- Keep cleanup artifacts out of commits (`__pycache__`, `.ruff_cache`, `dist`, `*.har`).

