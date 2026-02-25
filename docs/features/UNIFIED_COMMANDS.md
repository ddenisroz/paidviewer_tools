# Unified Commands

Status: active.

## Purpose

Keep command behavior consistent across Twitch and VK bot integrations.

## Command Model

1. Commands are parsed through a shared command handling layer.
2. Platform-specific adapters normalize message metadata before execution.
3. Permissions and role checks are applied uniformly.

## Expected Guarantees

1. Same command intent yields equivalent behavior on Twitch and VK.
2. Alias handling is deterministic.
3. Error responses are explicit and logged for debugging.

## Security Requirements

1. Command actions requiring elevated rights must verify admin/mod roles.
2. Input parameters must be validated before side effects.
3. External API calls from commands must use timeouts and bounded retries.

## Regression Checklist

1. Core commands execute on both Twitch and VK.
2. Permission-restricted commands reject unauthorized users.
3. Command parsing handles malformed input without crashing handlers.
4. Logging does not leak tokens or secrets from command context.

## Related Docs

- `docs/architecture/ROLES_REFERENCE.md`
- `docs/architecture/BOT_TOKEN_MANAGEMENT.md`
- `docs/guides/BOT_OAUTH_SETUP_GUIDE.md`
