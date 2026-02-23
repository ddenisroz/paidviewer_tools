# Encoding Repair Backlog (2026-02-23)

Status: closed for runtime/frontend/docs scope.

## Legacy-only residue (non-blocking)

- `bot_service/scripts/archive/legacy/add_versioning.py`
  - Contains legacy mojibake text in archived code.
  - Excluded by default from encoding gate because it is not runtime code.
- `bot_service/scripts/archive/legacy/remove_guest_mode.py`
  - Same legacy-only status.

## Completed in this pass

- Cleaned user-facing API mojibake in TTS and Drops endpoints.
- Cleaned major F5 service mojibake hotspots and internal logs/messages.
- Added strict reusable scan utility: `scripts/dev/check_mojibake.py`.
  - validates UTF-8 encoding,
  - checks replacement characters,
  - detects common mojibake chains,
  - skips `archive/legacy` paths by default.
- Converted `frontend/src/features/drops/components/DonationGrid.tsx` back to UTF-8.
- Removed locked `frontend/lint_output.txt` artifact.
- Updated extraction checklist with encoding validation step.

## How to Validate

1. Run scan:
   - `python scripts/dev/check_mojibake.py`
   - optional legacy check: `python scripts/dev/check_mojibake.py --include-legacy`
2. Ensure report prints:
   - `Encoding Issues: None`
   - `Suspicious Mojibake Lines: None` (for default non-legacy scope).
3. Re-run targeted tests:
   - `cd bot_service; pytest tests/test_api_tts.py tests/test_api_tts_engine.py tests/test_tts_provider_utils.py tests/test_tts_manager_fallback.py tests/test_security_regressions.py tests/test_migration.py -q`
4. Re-run frontend type-check:
   - `cd frontend; npm run type-check`

## Notes

- `tts_service/` directory is removed from filesystem; active service folder is `F5_tts/`.
- Archive/legacy files do not block release unless they are restored into runtime.
