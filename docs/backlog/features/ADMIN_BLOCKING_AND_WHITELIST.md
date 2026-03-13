# Admin Blocking And Whitelist

Status: active.

## Purpose

Define admin controls that restrict or allow TTS/bot behavior by user/channel policy.

## Core Rules

1. Whitelist controls access to privileged TTS features.
2. Blocklist denies feature usage even if other checks pass.
3. Policy checks are enforced in backend services, not only in UI.

## Admin Contracts

1. Only admin role can manage whitelist/blocklist entries.
2. Admin authority source: `users.role='admin'`.
3. Changes should invalidate relevant caches and be visible quickly in runtime.

## Runtime Expectations

1. Non-whitelisted channels fall back to safe/default TTS behavior.
2. Blocked users are denied generation requests with explicit errors.
3. Policy checks are applied consistently across Twitch and VK flows.

## Regression Checklist

1. Non-admin cannot change policy entries.
2. Whitelist update affects new requests without restart.
3. Blocked users cannot bypass with direct API calls.
4. Audit logs include actor, target, and action type.

## Related Docs

- `docs/architecture/ROLES_REFERENCE.md`
- `docs/architecture/TTS_ARCHITECTURE.md`
- `docs/guides/BOT_OAUTH_SETUP_GUIDE.md`
