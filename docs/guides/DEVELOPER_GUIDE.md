# Developer Guide

This document defines stable engineering contracts for daily development.

## Scope

Use this guide for:

- backend/frontend contribution rules
- security-sensitive auth contracts
- runtime behavior constraints that must not regress

## Runtime Surface

- `bot_service/` - FastAPI API, auth, business logic, repositories.
- `frontend/` - React + Vite UI.
- external upstreams:
  - `tts-gateway`
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`
- `deploy/` - docker compose and infra files.

## Dependency Manifests

- `bot_service/requirements.txt` - backend runtime only.
- `bot_service/requirements_dev.txt` - backend dev/test/tooling on top of runtime.
- `bot_service/requirements_celery.txt` - runtime + optional celery worker extras.
- `bot_service/requirements_no_torch.txt` - legacy alias to runtime requirements.

## Mandatory Auth Contracts

1. User OAuth entrypoints:
   - `/auth/twitch/login`
   - `/auth/vk/login` (plus `/auth/vk` alias)
2. User OAuth callbacks:
   - `/auth/twitch/callback`
   - `/auth/vk/callback`
3. Session auth is cookie-based (`session_id`).
4. Protected API auth source of truth is DB user state.
5. Admin authority source is `users.role='admin'`; `users.is_admin` is legacy compatibility only.
6. Guest mode is removed. Do not add anonymous auth flows or guest-only session branches.

## Bot OAuth Contracts

1. Login endpoints:
   - `/auth/twitch/bot/login`
   - `/auth/vk/bot/login`
2. Callback endpoints:
   - `/auth/twitch/bot/callback`
   - `/auth/vk/bot/callback`
3. Bot login requires admin session or short-lived `bot_oauth_token`.
4. Runtime bot tokens come from DB (`bot_tokens`), not legacy env fallback.

## WebSocket Contracts

1. Real-time sync uses WebSocket, not SSE.
2. Frontend keeps one leader socket per user across tabs.
3. Browser TTS playback works through dedicated `/tts-player` tab (`client_role=tts_player`).
4. Sink-aware TTS behavior must be preserved:
   - website mode requires active tts-player socket
   - OBS mode requires active OBS socket

## Backend Engineering Rules

1. Routes should remain thin; business logic belongs in `services/`.
2. DB access should go through `repositories/`.
3. Handle async errors explicitly; avoid fire-and-forget tasks without guards.
4. Keep request validation strict (Pydantic models, enums, bounded fields).
5. Do not log secrets/tokens/passwords.

## Frontend Engineering Rules

1. Keep API calls in service/query layers, not in random components.
2. Prevent duplicate requests (cache, memoization, debounce where needed).
3. Preserve single-leader WebSocket logic and reconnect semantics.
4. Keep admin pages aligned with semantic design tokens.

## Quality Gates

Backend:

```powershell
cd bot_service
ruff check .
pytest -q
```

Frontend:

```powershell
cd frontend
npm run lint
npm run type-check
npm run build
```

## Cleanup And Repo Hygiene

Canonical cleanup script:

```powershell
.\scripts\prepare-release.ps1
.\scripts\prepare-release.ps1 -ApplyCleanup
```

Before release-oriented PRs:

- remove generated caches/artifacts
- ensure no temporary files are tracked
- update docs for any behavior or contract changes

## Where To Update Docs When Changing Behavior

- auth/session changes -> `docs/architecture/AUTH_TYPE_SYSTEM.md`
- websocket behavior -> `docs/architecture/SHARED_WEBSOCKET.md`
- deployment/env -> `docs/setup/DEPLOYMENT.md`
- repo hygiene -> `docs/REPO_STRUCTURE.md` and `scripts/prepare-release.ps1`

