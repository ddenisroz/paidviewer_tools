# Project Audit Report

Date: 2026-03-12

## Summary

This repository has a coherent target architecture, but it is still carrying a large amount of historical debt.

What is working well:

- The current TTS direction is understandable and mostly consistent across active docs and runtime code.
- `bot_service` is clearly acting as the control plane.
- Frontend runtime has been successfully hardened to use only backend API/WS boundaries.
- Provider-aware TTS routing for `f5`, `qwen`, and `gcloud` is implemented and covered by targeted tests.

What is risky:

- `bot_service` still ships an oversized dependency set that mixes runtime, ML, test, and tooling concerns.
- Auth and role contracts still contain unresolved guest-mode residue despite active guidance saying guest mode is removed.
- The active docs set is not uniformly trustworthy; some files still have stale paths and mojibake.
- Meta/system tests contain legacy expectations and warn instead of failing, which reduces confidence in the test layer.
- Deployment inputs are not reproducible enough because upstream images and branch references are not pinned.

Overall assessment:

- Architecture direction: good
- Runtime contract clarity: medium/good
- Split readiness: medium
- Documentation trustworthiness: medium/low
- Dependency hygiene: low
- Test trustworthiness: medium/low

No confirmed critical production-breaking defect was found in the inspected scope, but there are several high-priority issues that should be addressed before further repo split or self-hosted rollout work.

## Scope And Method

Inspected locally:

- `docs/`, `README.md`, env examples, compose files
- `bot_service/api`, `bot_service/services`, `bot_service/core`, `bot_service/tests`
- `frontend/src`, frontend API boundary utilities, TTS pages and contexts
- dependency manifests for backend and frontend

Verified commands:

- `frontend`: `npm run check:no-direct-tts-url`
- `frontend`: `npm run type-check`
- `frontend`: `npm run build`
- `bot_service`: `..\.venv\Scripts\python.exe -m pytest -q tests/test_internal_service_auth.py tests/test_tts_provider_utils.py tests/test_tts_manager_fallback.py tests/test_api_tts.py tests/test_voice_functionality.py`
- `bot_service`: `..\.venv\Scripts\python.exe -m pytest -q tests/test_all_systems.py`

Important limitation:

- The external repositories `tts-gateway`, `f5-tts-service`, and `nano-qwen3tts-vllm` were audited only through this repo's integration surface, docs, compose files, and UI references.
- A line-by-line upstream code audit was not possible from this workspace.

## Repository Map

Observed scale:

- `bot_service/api`: 70 files
- `bot_service/services`: 63 files
- `frontend/src`: 374 files
- `bot_service/tests`: 41 files
- `docs`: 78 files
- `startup/router_registry.py` registers 44 routers

Current effective system map:

| Area | Role | Current state |
|---|---|---|
| `frontend/` | React + Vite dashboard and widgets | Runtime boundary to backend only is working |
| `bot_service/` | Control plane: auth, settings, moderation, integrations, routing, WS | Large and central; still overloaded |
| `tts-gateway` | Advanced synthesis orchestrator | Treated as external dependency, gateway-first contract is clear |
| `f5-tts-service` | Provider-owned F5 runtime and voice/admin APIs | External, current docs assume provider ownership |
| `nano-qwen3tts-vllm` | Qwen inference runtime | External, synthesis only; voice CRUD intentionally staged out |

Key stable interfaces reviewed:

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- `/api/voices/*`
- `/api/admin/voices*`
- `/api/tts/*`
- `/api/local-tts/*`
- `/auth/twitch/*`, `/auth/vk/*`
- `/auth/twitch/bot/*`, `/auth/vk/bot/*`
- `/ws/chat/{user_id}`

## Verified Signals

Verified positive signals:

- `frontend/scripts/check-no-direct-tts-url.mjs` forbids `F5_TTS_SERVICE_URL` and `VITE_TTS_SERVICE_URL` in runtime frontend code.
- `frontend/src/services/api/client.ts` and `frontend/src/shared/utils/urlUtils.ts` route frontend runtime through backend API/WS env only.
- `bot_service/services/tts/provider_utils.py` and `bot_service/api/tts/settings_routes.py` match the documented Qwen staged behavior:
  - Qwen synthesis requires gateway
  - Qwen voice CRUD returns explicit `501` detail until `QWEN_VOICE_SERVICE_URL` is set
- Targeted TTS/backend contract tests passed.
- Frontend type-check and production build passed.

Warnings seen during verification:

- Pytest emitted cache write warnings:
  - `PytestCacheWarning`
  - `WinError 5` while creating `.pytest_cache`
- Frontend build initially failed inside sandbox with `spawn EPERM`; it passed when re-run outside sandbox. This was an environment execution restriction, not a repo build failure.

## Findings

### HIGH-01: `bot_service` dependency boundary is still monolithic

Area: dependencies, architecture, split readiness

Evidence:

- `bot_service/requirements.txt` contains 220 packages.
- It mixes runtime packages with heavy ML packages and dev/test/tooling packages.
- Examples in the single runtime file:
  - `torch==2.8.0+cu128`
  - `torchaudio==2.8.0+cu128`
  - `torchvision==0.23.0+cu128`
  - `bitsandbytes==0.48.1`
  - `f5-tts==1.1.9`
  - `gradio==5.49.0`
  - `wandb==0.22.2`
  - `pytest==8.4.2`
  - `pytest-cov==7.0.0`
  - `ruff==0.14.5`
  - `pip_audit==2.9.0`
- `docs/STATUS_TRACKER.md` already lists this as an open task.

Impact:

- Core backend installation is heavier than necessary.
- Windows/local setup remains more fragile.
- The current dependency story works against the repo split strategy.
- It is harder to reason about what `bot_service` actually needs at runtime.

Recommended action:

1. Split backend dependencies into at least:
   - runtime
   - dev/test
   - optional operational tooling
2. Remove provider-local ML dependencies from `bot_service` where the code now depends on external upstreams instead.
3. Publish a minimal supported runtime set for `bot_service`.

Split relevance: core, deploy

### HIGH-02: Guest mode is declared removed, but legacy guest behavior still exists in code and types

Area: auth, contracts, docs, frontend

Evidence:

- Active guidance says guest mode should not exist:
  - `AGENTS.md`: guest mode is deprecated/removed
  - `docs/guides/DEVELOPER_ONBOARDING.md`: do not reintroduce guest/anonymous auth flows
  - `docs/guides/TTS_TROUBLESHOOTING.md`: "No more guest sessions or basic auth"
- Legacy guest residue still exists:
  - `frontend/src/constants/index.ts` exposes `VK_GUEST_START`, `VK_GUEST_VERIFY`, and `USER_MODES.GUEST`
  - `bot_service/auth/auth.py` still returns synthetic guest users for session data without a real user id
  - `bot_service/core/permissions.py` still defines `AppRole.GUEST`
  - `frontend/src/types/admin.d.ts` still models admin session data with `session_type: 'active_user' | 'guest'`
  - `bot_service/tests/test_permissions.py` still treats guest as a first-class role
- No active `/auth/.../guest/*` backend routes were found in the inspected API/auth modules, which means the public contract and the internal legacy model are already diverging.

Impact:

- Auth behavior is no longer decision-complete for maintainers.
- Engineers can accidentally preserve or re-expose deprecated guest flows.
- Docs and code are currently teaching different truths.

Recommended action:

1. Make a single explicit decision:
   - fully remove guest support, or
   - document it as legacy-compatible but unsupported for new work
2. If removal is the direction, remove in this order:
   - frontend constants and dead UI types
   - backend fallback guest user creation paths
   - guest role permission model
   - stale tests and docs
3. If compatibility must remain, update active docs to say so and narrow where guest behavior is still allowed.

Split relevance: core, frontend, docs

### HIGH-03: The active docs surface is not uniformly trustworthy

Area: documentation

Evidence:

- `docs/README.md` says docs with obsolete paths, removed endpoints, or mojibake must be rewritten or moved to `docs/backlog/`.
- Active docs still contain stale or contradictory material:
  - `docs/guides/DEVELOPER_GUIDE.md` still lists `F5_tts/` as part of runtime surface, but that folder is not present in the repository.
  - `docs/features/VK_CHANNEL_POINTS_IMPLEMENTATION.md` contains clear mojibake and references `bot_service/api/twitch_api.py`, which does not exist.
  - `docs/architecture/VALIDATION_SYSTEM.md` still documents `guestModeSchema`.
- The source-of-truth subset in root docs is reasonably good, but the broader active docs tree is not consistently curated.

Impact:

- Developers can follow the wrong file path or the wrong architectural assumption.
- Split and deployment work becomes slower because docs need to be manually verified against code.
- The docs index promises stronger hygiene than the repository currently enforces.

Recommended action:

1. Narrow the "active docs" definition further and enforce it.
2. Move stale feature and architecture notes with historical detail into `docs/backlog/`.
3. Add a docs hygiene check for:
   - removed file paths
   - known stale env names
   - mojibake markers
4. Rewrite `DEVELOPER_GUIDE.md` to the actual current topology.

Split relevance: docs

### HIGH-04: The meta/system test layer contains stale expectations and low-signal checks

Area: tests, quality gates

Evidence:

- `bot_service/tests/test_all_systems.py` still checks for:
  - `VITE_TTS_SERVICE_URL`
  - `docs/CURRENT_STATUS.md`
  - `docs/DEVELOPER_GUIDE.md`
  - `api/twitch_api.py`
  - `features/drops/drops_service.py`
- `bot_service/tests/test_migration.py` still expects `VITE_TTS_SERVICE_URL` in frontend env examples.
- The current repository no longer uses that frontend env variable in runtime.
- These tests largely print warnings instead of failing on stale assumptions.
- In contrast, targeted TTS/backend tests passed, which means the higher-signal contract tests and the stale meta tests currently disagree about what "healthy" means.

Impact:

- The suite gives a false sense of coverage.
- Historical drift can survive indefinitely because warning-style tests do not block regressions.
- Contributors cannot easily tell which tests enforce the current architecture.

Recommended action:

1. Quarantine or remove stale meta tests.
2. Replace them with explicit contract tests for:
   - backend-only frontend boundary
   - provider capability endpoint
   - Qwen `501` staging behavior
   - env example completeness for current contracts only
3. Make stale-reference checks fail, not warn.

Split relevance: core, frontend, docs

### MEDIUM-01: Upstream versioning and deployment reproducibility are weak

Area: deploy, external integrations

Evidence:

- Compose files default to floating upstream images:
  - `tts-gateway:latest`
  - `f5-tts-service:latest`
  - `nano-qwen3tts-vllm:latest`
- F5 references are tied to a branch name:
  - `docs/setup/LOCAL_TTS_INTEGRATION.md`
  - `frontend/src/features/tts/pages/LocalTTSSettingsPage.tsx`
  - both point to `f5-tts-service/tree/phase1-bootstrap`
- `deploy/docker/docker-compose.prod.yml` still encodes a more complex worker topology (`tts_worker_1` through `tts_worker_4`) that is not described in the active docs set.

Impact:

- Reproducing a known-good integration state is difficult.
- Upstream breakage can appear without a corresponding change in this repo.
- Operators do not have a single compatibility matrix.

Recommended action:

1. Pin upstream images by tested tags or digests.
2. Replace branch references with release tags or commit SHAs where possible.
3. Add an integration compatibility matrix to `docs/STATUS_TRACKER.md`:
   - gateway version
   - f5 service version
   - qwen version
   - compose profile tested

Split relevance: external, deploy

### MEDIUM-02: There is still visible encoding and text hygiene debt

Area: docs, developer experience

Evidence:

- `docs/features/VK_CHANNEL_POINTS_IMPLEMENTATION.md` contains mojibake.
- `bot_service/auth/auth.py` and several TS type/comment blocks display encoding artifacts in inspection output.
- `deploy/docker/docker-compose.prod.yml` still has mojibake in comments.

Impact:

- Lowers trust in docs and comments.
- Makes review, search, and maintenance harder.
- Raises the chance of accidental stale-file usage.

Recommended action:

1. Normalize active docs and comments to UTF-8.
2. Move historical encoded files to `docs/backlog/` or rewrite them.
3. Add a lightweight encoding hygiene pass before release-oriented work.

Split relevance: docs, hygiene

### MEDIUM-03: Frontend build works, but bundle size remains a medium-term risk

Area: frontend performance

Evidence:

- Production build passed.
- Large generated chunks were observed, including approximately:
  - `dash.all.min-*.js`: ~992 kB
  - `index-*.js`: ~606 kB
  - `hls-*.js`: ~521 kB
- Route-level lazy loading exists, but media/player dependencies still dominate some output.

Impact:

- Slower initial page loads or lower cache efficiency on media-heavy paths.
- Harder future frontend extraction and deployment optimization.

Recommended action:

1. Audit vendor chunking for video/player libraries.
2. Separate media-heavy routes more aggressively.
3. Add build-size thresholds for major chunks after the split plan stabilizes.

Split relevance: frontend

### LOW-01: Local test cache hygiene is noisy

Area: developer workflow

Evidence:

- Pytest runs passed but emitted `.pytest_cache` write warnings with `WinError 5`.
- Workspace contains temporary pytest cache folders like `pytest-cache-files-*`.

Impact:

- Noisy local verification.
- Can obscure real warnings.

Recommended action:

1. Fix permissions or readonly flags around pytest cache handling.
2. Ensure temporary cache paths are consistently ignored and cleaned.
3. If necessary, disable cache provider in specific constrained environments.

Split relevance: hygiene

## Strengths To Preserve

These areas are in good enough shape to preserve as baseline contracts:

- Backend-only frontend runtime boundary
- Provider capability endpoint
- Gateway-first provider routing
- Explicit Qwen staged behavior via `501`
- Local endpoint SSRF hardening via allowed host/CIDR validation
- Stable backend health entrypoints

## Recommended Work Sequence

### Quick Wins: 1-2 Days

1. Rewrite or move stale active docs:
   - `docs/guides/DEVELOPER_GUIDE.md`
   - `docs/features/VK_CHANNEL_POINTS_IMPLEMENTATION.md`
   - `docs/architecture/VALIDATION_SYSTEM.md`
2. Quarantine stale meta tests:
   - `bot_service/tests/test_all_systems.py`
   - `bot_service/tests/test_migration.py`
3. Document current guest-mode status explicitly in one place.
4. Pin upstream image tags in compose examples.

### Medium-Term: 1-3 Weeks

1. Split `bot_service` dependencies into runtime vs dev/test/tooling.
2. Remove or formally contain guest legacy paths.
3. Replace stale meta tests with contract tests aligned to the split architecture.
4. Add docs linting for stale paths and mojibake.
5. Build an explicit compatibility matrix for upstream TTS services.

### External Phase

1. Audit `tts-gateway` repository directly:
   - auth contract
   - Redis dependency
   - provider adapters
   - health/readiness behavior
2. Audit `f5-tts-service` repository directly:
   - voice/admin API contract
   - worker topology
   - storage/model requirements
3. Audit `nano-qwen3tts-vllm` repository directly:
   - auth behavior
   - health contract
   - Linux/WSL runtime constraints
4. Decide whether Qwen voice CRUD should live in:
   - a dedicated voice service
   - the Qwen repo itself
   - a provider-owned extension behind `QWEN_VOICE_SERVICE_URL`

## Assumptions And Defaults Used In This Audit

- Target architecture in current active docs is the intended direction.
- `bot_service` is the long-term control plane and should become leaner, not fatter.
- Frontend extraction is planned but not complete.
- Qwen voice CRUD is intentionally staged and not considered a bug by itself.
- Upstream repos are external dependencies, not internal implementation details of this repo.

## Final Assessment

The project is not in architectural chaos. The main contracts around advanced TTS routing, backend ownership, and frontend boundary hardening are moving in the right direction and are already reflected in passing targeted checks.

The real blockers are not the core TTS design. They are dependency layering, test drift, documentation trust, and unresolved legacy auth residue. Those are exactly the kinds of issues that make future split, self-hosted deployment, and multi-repo coordination expensive.

If the next work phase removes those blockers first, the repository is in a workable position to continue the TTS platform split without destabilizing the current product surface.
