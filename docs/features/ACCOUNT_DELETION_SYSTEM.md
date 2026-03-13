# Account Deletion System

Status: active.

## Purpose

Provide a safe account deletion flow with controlled data lifecycle.

## Deletion Levels

1. Soft delete (user initiated)
- user profile is marked deleted
- active sessions/tokens are revoked
- account no longer participates in runtime flows

2. Retention cleanup (background)
- delayed cleanup after retention period
- removes non-required personal data
- keeps minimal audit metadata required by policy

3. Admin delete (privileged)
- explicit admin action for support/compliance cases
- bypasses normal waiting period when policy allows
- runs through a deletion plan that cleans known dependent rows before removing `users`
- should be previewed first via operational tooling before destructive execution

## Security Requirements

1. Deletion endpoints require authenticated session.
2. User can delete only own account unless admin role.
3. Admin authority source: `users.role='admin'`.
4. All destructive operations must be audited in logs.

## Regression Checklist

1. Deleted users cannot authenticate with old sessions.
2. Related OAuth tokens are deactivated.
3. Background cleanup does not remove protected audit rows.
4. Admin delete path is role-gated and returns 403 for non-admin.

## Operational Notes

- For maintenance cleanup, prefer `python bot_service/scripts/delete_users.py --list`.
- Preview first:
  - `python bot_service/scripts/delete_users.py --user-id 42`
  - `python bot_service/scripts/delete_users.py --twitch some_channel`
- Execute only with explicit confirmation:
  - `python bot_service/scripts/delete_users.py --user-id 42 --yes`
- Do not use direct `DELETE FROM users ...` without clearing dependent rows.

## Related Docs

- `docs/architecture/AUTH_TYPE_SYSTEM.md`
- `docs/architecture/ROLES_REFERENCE.md`
- `docs/setup/DEPLOYMENT.md`
