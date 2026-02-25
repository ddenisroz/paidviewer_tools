# Docs Tech Debt Audit (2026-02-25)

This note tracks remaining documentation debt after active docs cleanup.

## Findings

1. `docs/api/ADMIN_PANEL_ENDPOINTS_STATUS.md`
- Contains `TODO: Реализовать` blocks.
- Status table is partially speculative and can drift from code.

2. Admin page route naming in docs (`/dashboard/dolbaebadmintts`)
- Path is currently real in code, but name is operationally poor.
- Requires product decision before renaming (route migration + redirects).

## Resolved In This Cleanup

1. Rewritten in clean UTF-8 and aligned to current contracts:
- `docs/features/ACCOUNT_DELETION_SYSTEM.md`
- `docs/features/ADMIN_BLOCKING_AND_WHITELIST.md`
- `docs/features/TTS_CHANNEL_POINTS_MODE.md`
- `docs/features/UNIFIED_COMMANDS.md`

2. Removed stale references in active docs:
- missing `CURRENT_STATUS.md`
- removed module path `bot_service/api/tts_api.py`
- deprecated cleanup command `cleanup-dev-artifacts.ps1`

## Recommended Next Steps

1. Move low-value historical feature notes to `docs/backlog/`.
2. Add lightweight docs lint in CI:
   - fail on references to missing files in `docs/`
   - fail on known stale patterns (`tts_api.py`, `CURRENT_STATUS.md`)
