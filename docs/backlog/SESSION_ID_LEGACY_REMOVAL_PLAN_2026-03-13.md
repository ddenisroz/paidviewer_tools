# Legacy `session_id` Removal Plan

Date: 2026-03-13
Status: Backlog

## Why This Exists

Active runtime is authenticated-user only, but several tables still keep historical dual-mode schema:
- `user_id`
- `session_id`

This was originally used for anonymous/session-scoped settings. Guest mode is removed from active flows, but the schema and some compat code still remain.

## Current Dual-Mode Tables

- `user_settings`
- `tts_user_settings`
- `tts_blocked_users`
- `filtered_words`
- `local_tts_endpoints`
- `youtube_queue`
- `drops_configs`
- `drops_rewards`
- `user_streaks`
- `drops_history`
- `mythical_drops_sessions`
- `stream_sessions`
- `user_tokens`

## Phase 1: Data Hygiene

- Add preview/cleanup for orphan `user_id` rows.
- Add retention cleanup for inactive `user_sessions`.
- Keep session-scoped rows untouched by default.
- Goal: stop data drift without destructive schema changes.

## Phase 2: Runtime Audit

- Find every active code path that still reads/writes `session_id` in the tables above.
- Classify each use:
  - active runtime dependency
  - compat fallback
  - dead code
- Confirm whether any real non-user data still exists in production/dev DBs.

## Phase 3: Write-Path Freeze

- Stop creating new session-scoped rows in user-only flows.
- Ensure all settings/config writes are keyed only by `user_id`.
- Add tests that fail if user runtime writes new `session_id` rows.

## Phase 4: Data Migration

- Back up DB.
- Convert remaining valid session-scoped records to `user_id` where a safe mapping exists.
- For unmappable rows:
  - archive if needed
  - otherwise delete as legacy leftovers

## Phase 5: Schema Hardening

- Drop `session_id` from tables that are confirmed user-only.
- Add missing `ForeignKey` constraints where they are still absent, especially:
  - `user_settings.user_id`
  - `tts_user_settings.user_id`
- Add cascade/on-delete behavior only after delete flows are fully verified.

## Phase 6: Compat Cleanup

- Remove `session_id == -1` / guest cleanup assumptions from maintenance code.
- Remove session-scoped branches from repositories/services/routes that no longer need them.
- Update docs and maintenance scripts to user-only language.

## Exit Criteria

- No active runtime write-path creates session-scoped settings/config rows.
- Dual-mode tables are either migrated to user-only or explicitly documented as historical.
- `user_settings` and `tts_user_settings` have real FK protection against future orphan rows.
