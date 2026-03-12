# Dev Utilities

Temporary diagnostics and one-off maintenance scripts are stored here to keep
the repository root clean.

Current scripts:
- `audit_db_table_usage.py`
- `check_hardcoded_paths.py`
- `check_mojibake.py`
- `check_runtime_sqlite_policy.py`
- `check_user_status.py`
- `cleanup_workspace_caches.ps1`
- `debug_routes.py`
- `debug_vk.py`
- `fix_encoding.py`
- `list_users.py`
- `setup_public_domain.ps1`
- `test_memealerts_auth.py`
- `tts-smoke-preflight.ps1`
- `verify_api.py`

Run from repo root, for example:

```powershell
python scripts/dev/debug_vk.py
```

Recommended pre-commit checks for text/database hygiene:

```powershell
python scripts/dev/check_mojibake.py
python scripts/dev/check_hardcoded_paths.py
python scripts/dev/check_runtime_sqlite_policy.py
python scripts/dev/audit_db_table_usage.py --out docs/DB_TABLE_USAGE_AUDIT_2026-02-23.md
```

Workspace cleanup (dry-run by default):

```powershell
.\scripts\dev\cleanup_workspace_caches.ps1
.\scripts\dev\cleanup_workspace_caches.ps1 -Apply
```

Live smoke preflight:

```powershell
.\scripts\dev\tts-smoke-preflight.ps1 -Scenario all
```
