# Bot Token Management

## Current architecture

Bot tokens are managed through OAuth and stored in database table `bot_tokens`.

- Twitch bot token source: DB only
- VK bot token source: DB only
- Runtime env fallback is not used

## Token providers

- Twitch bot OAuth:
  - `auth/twitch_bot_oauth.py`
  - `services/twitch_bot_oauth_service.py`
- VK bot OAuth:
  - `auth/vk_bot_oauth.py`
  - `services/vk_bot_oauth_service.py`

## Authorization entry points

- Direct admin OAuth start:
  - `GET /auth/twitch/bot/login`
  - `GET /auth/vk/bot/login`

- One-time links (for another browser/profile):
  - `GET /api/admin/bot/twitch/login-link`
  - `GET /api/admin/bot/vk/login-link`

## Status and control APIs

- Token status:
  - `GET /api/admin/bot/twitch/token-status`
  - `GET /api/admin/bot/vk/token-status`

- Forced refresh:
  - `POST /api/admin/bot/twitch/refresh-token`
  - `POST /api/admin/bot/vk/refresh-token`

## Validation and monitoring

- Validator service: `services/bot_token_validator.py`
- Startup validation happens before bot connect.
- Periodic monitoring runs every hour.
- If token is invalid, startup logs actionable fix steps.

## Refresh strategy

- Automatic:
  - proactive refresh on startup for expiring token
  - scheduled refresh in background task
- Manual:
  - admin refresh endpoints above
  - bot process restart after successful refresh

## Startup integration

- `startup/bot_initializer.py` starts Twitch and VK bots from active channels in DB.
- If token is not configured, platform bot is skipped and service continues.

## Security model

- Access to bot OAuth initiation requires admin session.
- One-time links are signed, short-lived, and platform-scoped.
- Tokens are encrypted before persistence.

## Operational checklist

1. Ensure at least one admin account exists (`users.role='admin'`).
2. Login to app admin panel and open bot connect tab.
3. Authorize Twitch bot and VK bot accounts.
4. Verify both token status endpoints return `configured=true`.
5. Confirm startup logs show both bots connected to expected channels.
