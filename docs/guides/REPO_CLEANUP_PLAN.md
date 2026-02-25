# Repo Cleanup Plan

This plan tracks what is already cleaned and what remains as technical debt.

## Already Cleaned

- Removed local artifact folders from workspace:
  - `artifacts/`
  - `.benchmarks/`
  - `bot_service/.ruff_cache/`
  - `bot_service/**/__pycache__/`
- Removed unused duplicate frontend components:
  - `frontend/src/components/chatbox/*`
  - active source remains in `frontend/src/features/chatbox/components/*`
- Moved historical docs out of active root:
  - `docs/DEV_LOG.md` -> `docs/backlog/DEV_LOG_2025_HISTORY.md`
  - `docs/DB_TABLE_USAGE_AUDIT_2026-02-23.md` -> `docs/backlog/DB_TABLE_USAGE_AUDIT_2026-02-23.md`

## Keep (Intentional)

- `.husky/`: pre-commit quality hooks.
- `.github/workflows/`: CI contract.
- `docs/backlog/`: historical notes (not runtime source of truth).
- `.venv/`: local environment only (can be recreated, not committed).

## Next Cleanup Candidates

1. Duplicate utility namespaces in frontend:
- `frontend/src/utils/*` and `frontend/src/shared/utils/*` are both used.
- Risk: medium (broad import graph).
- Action: migrate to one namespace in small batches with type-check after each batch.

2. Legacy guest/auth residues:
- Guest-related constants and fallback paths remain in parts of backend/frontend.
- Risk: medium/high (auth contract).
- Action: remove only after explicit contract decision and migration notes.

3. Docs reduction:
- Move stale historical implementation details from active guides to `docs/backlog/`.
- Risk: low.
- Action: keep only current contracts in active docs.

## One-Command Workspace Prep

Preview (safe dry-run):

```powershell
.\scripts\prepare-release.ps1
```

Apply cleanup:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup
```

Optional checks:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup -RunChecks
```

Include `.venv` bytecode caches too:

```powershell
.\scripts\prepare-release.ps1 -ApplyCleanup -IncludeVenvCaches
```
