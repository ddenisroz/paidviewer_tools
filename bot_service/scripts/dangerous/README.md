# Dangerous Scripts (Staging Area)

This folder marks scripts that can mutate or delete production data.

Current policy:
- keep destructive scripts callable from `bot_service/scripts/` until migration is fully validated
- use this folder as documentation/staging first

High-risk scripts currently in root:
- `clear_database.py`
- `cleanup_users.py`
- `reset_db.py`
- `reset_postgres_password.ps1`
- `setup_postgresql.ps1`
- `fix_postgres_setup.ps1`

Before running any of them:
1. Verify target environment (`dev` vs `prod`).
2. Ensure recent DB backup exists.
3. Prefer dry-run/read-only alternatives when available.

