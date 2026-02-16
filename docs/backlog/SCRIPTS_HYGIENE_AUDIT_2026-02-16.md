# Scripts Hygiene Audit (2026-02-16)

## Scope
Audit of `bot_service/scripts` with focus on:
- root clutter reduction
- one-off script archiving
- operational safety classification

## Actions Applied
1. Moved one-off helpers to `bot_service/scripts/archive/legacy/`.
2. Kept operational scripts in `bot_service/scripts/`.
3. Updated script docs (`README_MAINTENANCE.md`, `archive/README.md`).

## Archived in This Pass

| Script | New Location | Risk if Removed from Active Folder | Reason |
|---|---|---:|---|
| `add_version_to_models.py` | `archive/legacy/` | Low | One-time versioning utility |
| `add_versioning.py` | `archive/legacy/` | Low | One-time migration helper |
| `remove_versioning.py` | `archive/legacy/` | Low | One-time rollback helper |
| `remove_guest_mode.py` | `archive/legacy/` | Low | Historical migration helper |
| `fix_indentation.py` | `archive/legacy/` | Low | Local formatting fix helper |
| `fix_unicode_checkmark.py` | `archive/legacy/` | Low | One-off text replacement helper |
| `fix_all_emoji.py` | `archive/legacy/` | Low | One-off emoji normalization helper |
| `find_emoji.py` | `archive/legacy/` | Low | Investigation helper |

## Kept Active (Operationally Relevant)

| Script | Risk Level | Notes |
|---|---:|---|
| `clear_database.py` | High | Destructive operation, keep guarded |
| `reset_db.py` | High | Destructive reset flow |
| `cleanup_users.py` | High | Potential data loss if misused |
| `make_admin.py` | Medium | Used by onboarding/admin docs |
| `check_admin.py` | Medium | Used by setup flow |
| `check_tts_status.py` | Medium | Used by troubleshooting docs |
| `init_blocked_bots.py` | Medium | Referenced in feature docs |
| Other `check_*` and DB diagnostics | Low/Medium | Useful for local ops and incident triage |

## Next Cleanup Candidates (Not Applied Yet)

| Candidate | Risk | Why deferred |
|---|---:|---|
| Consolidate `check_*` scripts into a single CLI | Medium | Requires interface design and docs migration |
| Move dangerous scripts into dedicated `scripts/dangerous/` | Medium | Needs team agreement and runbook updates |
| Add argparse + `--dry-run` to destructive scripts | Medium/High | Behavioral change, requires testing |
