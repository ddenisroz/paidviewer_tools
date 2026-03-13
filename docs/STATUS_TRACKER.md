# Status Tracker

Last updated: 2026-03-13

This file is the handoff summary for active development. Update it after each substantial implementation session.

## Overall Status

| Area | Status | Notes |
|---|---|---|
| Backend TTS contract migration | Done | `bot_service` uses strict API-key auth and provider-aware routing. |
| Frontend API-boundary hardening | Done | Frontend runtime no longer depends on direct `VITE_TTS_SERVICE_URL`. |
| Qwen staged integration | Done for current phase | Managed synthesis goes through the gateway-managed path, self-hosted endpoints work through a backend compatibility adapter, and voice CRUD remains `501` until separate qwen voice API exists. |
| Docs/env/compose alignment | Done | Active docs were rewritten to the current contract and old deployment notes were moved to `docs/backlog/`. |
| Backend dependency split | Done | Runtime, Celery, and contributor/dev dependencies are now separated into dedicated manifests. |
| Guest-mode cleanup | Done | Active auth/admin/frontend runtime no longer exposes guest-only branches or UI state. |
| Compose contract verification | Done for current phase | `docker compose config -q` is green for `dev` and `bot`; `prod` still requires its baseline DB/Redis/app env set. |
| External upstream code audit | Done for current phase | Direct clone/code audit completed for `tts-gateway`, `f5-tts-service`, and `nano-qwen3tts-vllm`; Qwen upstream gaps were documented. |
| Qwen self-hosted compatibility path | Done for current phase | `bot_service` now exposes compatibility warnings and supports self-hosted `qwen` endpoints through a backend adapter while native upstream parity is still pending. |
| Live smoke preflight tooling | Done | Added runbook + env/prereq preflight before first full live smoke. |
| Safe selective user cleanup | Done | Added transactional deletion preview + CLI maintenance script for targeted user cleanup without raw SQL. |
| Docs and legacy hygiene cleanup | Done for current phase | Active docs surface was reduced; stale plan/snapshot docs were moved to `docs/backlog/`, legacy account/user cleanup code was removed, and workspace cleanup now covers temp/log/cache artifacts. |
| Database hygiene tooling | Done for current phase | Added preview/cleanup path for orphan user-owned rows and retention cleanup for inactive sessions; background cleanup now uses the same retention policy. |
| Full live stack smoke | Pending | Requires Redis, F5 model assets, and Linux/WSL2 runtime for Qwen. |
| Frontend repo split | Not started | This repo is prepared for split, but extraction has not happened. |

## Closed And Working

| Task | Status | Evidence |
|---|---|---|
| Strict upstream auth for TTS services | Closed | `bot_service` sends `Authorization: Bearer <key>` and `X-API-Key`. |
| Split synthesis routing vs voice/admin routing | Closed | `f5/qwen` synthesis is routed separately from provider-owned voice/admin APIs. |
| Backend health endpoint for providers | Closed | `GET /api/tts/health?provider=f5|qwen|gcloud` is implemented. |
| Backend provider capability endpoint | Closed | `GET /api/voices/providers/capabilities` is implemented. |
| Qwen voice CRUD staged behavior | Closed | Returns explicit `501` with machine-readable detail when no `QWEN_VOICE_SERVICE_URL` is set. |
| Local endpoint saved `api_key` flow | Closed | Saved `local_tts_endpoints.api_key` is used in local health/synthesis. |
| Frontend health checks through backend only | Closed | `TtsContext` and API service call backend health instead of direct TTS URLs. |
| Audio URL resolution hardening | Closed | Runtime audio URLs are resolved through shared backend-safe utility. |
| Runtime hardcode cleanup in frontend WS code | Closed | Old `:8000` WebSocket fallback was removed. |
| Qwen UI capability gating | Closed | UI disables unsupported Qwen voice CRUD actions with explicit messaging. |
| Static guard against direct TTS runtime URLs in frontend | Closed | `frontend/scripts/check-no-direct-tts-url.mjs` is in place. |
| Compatibility compose overlays audit | Closed | `docker-compose.tts-advanced.yml` and `docker-compose.tts-simple.yml` now reflect current `f5-tts-service` env/DB contract. |
| Docker deployment handoff doc | Closed | `docs/setup/DOCKER_DEPLOYMENT.md` now starts with the current topology and compose entrypoints. |
| Active deployment docs cleanup | Closed | Old deployment docs were moved to `docs/backlog/` and replaced with concise active versions. |
| Root docs surface cleanup | Closed | Duplicate root-level docs (`ARCHITECTURE.md`, `FEATURES.md`, `DEVELOPER.md`, `CHANGELOG.md`) were moved to `docs/backlog/`; active root now keeps only core entrypoints. |
| Backend dependency manifest split | Closed | `bot_service/requirements.txt` is runtime-only, with `requirements_dev.txt`, `requirements_celery.txt`, and `requirements_no_torch.txt` aligned to the new boundary. |
| Guest-mode runtime cleanup | Closed | `bot_service` auth/admin flows and frontend admin types/UI no longer carry guest-only runtime branches. |
| Compose entrypoint validation | Closed | `docker-compose.dev.yml` and `docker-compose.bot.yml` pass `docker compose config -q`; prod-like compose docs now call out the baseline required env set. |
| Live smoke runbook and preflight script | Closed | `docs/setup/LIVE_SMOKE_RUNBOOK.md` and `scripts/dev/tts-smoke-preflight.ps1` define pre-testing topology matrix and env checks. |
| Safe user deletion tooling | Closed | `bot_service/scripts/delete_users.py` supports `--list`, dry-run preview, and explicit `--yes`; admin hard-delete routes now use the same cleanup plan. |
| Docs and legacy hygiene cleanup | Closed for current phase | `REPO_CLEANUP_PLAN`, admin endpoint status snapshot, and removed audio-priority note were moved to `docs/backlog/`; obsolete cleanup/account files were removed; release cleanup covers temp/log/cache dirs. |
| Database hygiene preview/cleanup tooling | Closed | `bot_service/scripts/database_hygiene.py` previews and cleans orphan `user_id` rows plus old inactive sessions; `DatabaseCleanupCore` and background session cleanup now share the same retention logic. |

## Verified Checks

Run backend commands from the project venv.

| Check | Result |
|---|---|
| `pytest -q tests/test_internal_service_auth.py tests/test_tts_provider_utils.py tests/test_tts_manager_fallback.py tests/test_api_tts.py tests/test_voice_functionality.py` | Passed |
| `pytest -q tests/test_api_tts.py tests/test_voice_functionality.py tests/test_all_systems.py` | Passed |
| `pytest -q tests/test_user_cleanup_service.py` | Passed |
| `pytest -q tests/test_database_cleanup_core.py` | Passed |
| `docker compose -f deploy/docker/docker-compose.dev.yml config -q` | Passed |
| `docker compose -f deploy/docker/docker-compose.bot.yml config -q` | Passed with unset-var warnings |
| `docker compose -f deploy/docker/docker-compose.prod.yml config -q` | Blocked until baseline prod env is set (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `SECRET_KEY`) |
| `npm run type-check` | Passed |
| `npm run test -- src/shared/utils/__tests__/audioUrlResolver.test.ts src/shared/utils/__tests__/constantsEnvContract.test.ts` | Passed |
| `npm run check:no-direct-tts-url` | Passed |
| `npm run build` | Passed |
| `.\scripts\dev\tts-smoke-preflight.ps1 -Scenario all` | Executed | Use before first live smoke; result depends on local env completeness and external prerequisites. |

## Upstream Runbook Verification

| Upstream repo | Status | Notes |
|---|---|---|
| `tts-gateway` | Audited directly | Commit `c703332`; auth/health/async job contract aligns with current `bot_service` synthesis boundary. |
| `f5-tts-service` (`phase1-bootstrap`) | Audited directly | Commit `7d02940`; provider + compat/admin APIs align, but runtime is still asset-gated (`vendor/F5-TTS`, weights, prewarm). |
| `nano-qwen3tts-vllm` | Audited directly with gaps | Commit `8889fb1`; no auth, no `/health` surface, no env-driven `API_KEY`/`PORT`, Linux/WSL2/NVIDIA required. |

## Open Tasks

| Task | Priority | Status | Notes |
|---|---|---|---|
| Run full local smoke for `gateway + redis + f5 + bot_service + frontend` | High | Ready | Needs real env values and running upstream services. |
| Remove remaining legacy `session_id` compat tails from feature domains | High | Open | Migration plan is tracked in `docs/backlog/SESSION_ID_LEGACY_REMOVAL_PLAN_2026-03-13.md`; active TTS/auth runtime is already user-only. |
| Complete Qwen upstream native contract parity | High | Open | Task list is tracked in `docs/backlog/QWEN_UPSTREAM_PARITY_TASKS_2026-03-12_RU.md`; current repo has a compatibility adapter, but upstream still needs native auth/health/status/synthesis parity. |
| Validate synth through gateway for `provider=f5` and `provider=qwen` | High | Blocked by upstream runtime | Depends on gateway/F5/Qwen stack being live. |
| Validate F5 voice CRUD end-to-end through `bot_service` | High | Blocked by F5 runtime | Requires working F5 service assets and DB. |
| Implement Qwen voice CRUD upstream | High | External dependency | Must be done in Qwen repo or separate qwen voice service, then wired via `QWEN_VOICE_SERVICE_URL`. |
| Decide and document `TTS_GATEWAY_QWEN_URL_POLICY=proxy` for browser-facing deployments | Medium | Open | Current gateway `auto` mode can return direct Qwen audio URLs when upstream host looks public. |
| Audit non-active historical docs for optional cleanup | Low | Open | Active surface is reduced; backlog can still be trimmed further later if desired. |
| Extract frontend into separate repo | Medium | Not started | API boundary is prepared; packaging, CI, and deployment split still need design. |

## Known Constraints

- `qwen` managed synthesis is gateway-managed only in this repo.
- `qwen` voice CRUD is intentionally unavailable here until a dedicated upstream voice API exists.
- `tts-gateway` requires Redis to run correctly.
- `f5-tts-service` needs vendor/model assets beyond code checkout.
- `nano-qwen3tts-vllm` is not a practical native Windows runtime; use Linux or WSL2.
- Current upstream `nano-qwen3tts-vllm` is usable in this repo through a compatibility adapter for self-hosted mode, but native upstream parity is still incomplete.

## Non-Negotiable Contracts

- Frontend runtime must talk only to `bot_service` API/WS.
- Do not restore direct runtime usage of `VITE_TTS_SERVICE_URL`.
- Provider voice catalog remains provider-owned; `bot_service` stores settings, overrides, and routing policy.
- For TTS upstreams, use strict API-key auth only.
- Any future Qwen voice service must preserve existing frontend API paths through `bot_service`.

## Recommended Next Sequence

0. Run `.\scripts\dev\tts-smoke-preflight.ps1 -Scenario all` and close any env-level failures.
1. Bring up Redis, `tts-gateway`, `f5-tts-service`, `nano-qwen3tts-vllm`, `bot_service`, and frontend with real env files.
2. Run provider health checks through backend.
3. Smoke synthesis for `f5` and `qwen` through gateway.
4. Smoke F5 voice CRUD through `bot_service`.
5. Leave Qwen CRUD in `501` state until the upstream voice service exists, or wire `QWEN_VOICE_SERVICE_URL` if that service is ready.
6. Close the native parity tasks in `docs/backlog/QWEN_UPSTREAM_PARITY_TASKS_2026-03-12_RU.md` so the compatibility adapter can be reduced later.

## Naming Clarification

- `self-hosted endpoint`: the user runs the TTS service on their own hardware and stores its URL in `local_tts_endpoints`.
- `project-hosted worker`: a separate runtime worker hosted by project infrastructure.
- `gateway-managed`: `bot_service` calls `tts-gateway`, and the gateway routes requests to project-hosted workers.
- Existing runtime flags `use_local`, `f5_local`, and `qwen_local` are legacy naming for the self-hosted path and are intentionally preserved for now.

## Handoff Notes For Other Agents

- Read `docs/PROJECT_CONTEXT.md` and this file first.
- Then read `docs/setup/LOCAL_TTS_INTEGRATION.md` and `docs/setup/REPO_SPLIT_GUIDE.md`.
- Treat current uncommitted repository changes as baseline unless the user says otherwise.
- If you change runtime contracts, update this file in the same session.

