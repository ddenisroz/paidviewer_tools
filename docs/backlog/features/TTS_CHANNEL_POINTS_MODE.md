# TTS Channel Points Mode

Status: active.

## Purpose

Allow TTS execution to be controlled by channel points rewards and per-platform settings.

## Behavior

1. TTS mode can be configured per user settings.
2. Reward mapping supports Twitch reward id and VK reward title matching.
3. In unsupported or missing mapping states, runtime falls back to default mode.

## Data Contract

- Mode settings are persisted in user settings storage.
- Reward mapping updates must be validated and stored atomically.
- API responses should return both mode and active reward mapping.

## Security And Validation

1. Settings endpoints require authenticated user context.
2. User can modify only own settings unless admin flow is explicit.
3. Input validation must reject malformed reward identifiers.

## Regression Checklist

1. Reward-triggered TTS works for Twitch and VK with configured mappings.
2. Unconfigured rewards do not trigger TTS unexpectedly.
3. Mode updates are reflected in runtime without stale cache effects.
4. Invalid payloads return 400 with clear validation errors.

## Related Docs

- `docs/architecture/TTS_ARCHITECTURE.md`
- `docs/architecture/CACHING_SYSTEM.md`
- `docs/setup/LOCAL_TTS_INTEGRATION.md`
