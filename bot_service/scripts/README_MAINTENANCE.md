# Maintenance Scripts

This folder contains **active operational scripts** for backend diagnostics,
admin/bootstrap tasks, and DB maintenance.

## Active Categories

### Access and Admin
- `check_admin.py`
- `make_admin.py`
- `update_session_role.py`
- `add_user_to_whitelist.py`
- `check_user_whitelist.py`
- `normalize_admin_tables.py`

### Token and Auth Diagnostics
- `check_tokens.py`
- `check_bot_token.py`
- `check_twitch_token.py`
- `get_vk_token_manual.py`

### TTS Diagnostics
- `check_tts_enabled.py`
- `check_tts_status.py`
- `init_blocked_bots.py`

### Database and Session Utilities
- `db_console.py`
- `show_db_structure.py`
- `check_postgresql_data.py`
- `check_sessions.py`
- `find_n_plus_one.py`
- `fix_admin_session.py`

### Dangerous Maintenance (use with caution)
- `clear_database.py`
- `cleanup_users.py`
- `reset_db.py`
- `setup_postgresql.ps1`
- `reset_postgres_password.ps1`
- `check_postgres_connection.ps1`
- `fix_postgres_setup.ps1`

## Unified Checks Launcher

Use `run_check.py` to avoid memorizing exact script names:

```bash
cd bot_service
python scripts/run_check.py --list
python scripts/run_check.py tts-status 1
python scripts/run_check.py admin
```

This launcher is non-destructive and only proxies `check_*` diagnostics.

## Archived Scripts

One-off migration/fix scripts are moved under:
- `bot_service/scripts/archive/`
- `bot_service/scripts/archive/legacy/`

These are kept for reference and forensic rollback only; they are not part of
normal operations.
