# Bot OAuth Auto Refresh

## Runtime model

- Bot auth is DB-only through `bot_tokens`.
- Runtime does not use `TWITCH_BOT_TOKEN` or `VK_LIVE_USER_TOKEN` env fallback.
- Bot OAuth is started by:
  - `GET /auth/twitch/bot/login`
  - `GET /auth/vk/bot/login`
- Admin can generate short-lived one-time login links:
  - `GET /api/admin/bot/twitch/login-link`
  - `GET /api/admin/bot/vk/login-link`

## Access model

- Bot OAuth endpoints require admin app session.
- One-time links are signed JWTs with 10-minute TTL and platform binding.
- Callback redirects to admin bots tab:
  - `/dashboard/dolbaebadmintts?tab=bots`

## Refresh lifecycle

### Automatic refresh

- Background task: `refresh_bot_oauth_tokens` (every 1 hour).
- Startup path performs proactive refresh when token is close to expiry (15 minutes).
- Services used:
  - `services/twitch_bot_oauth_service.py`
  - `services/vk_bot_oauth_service.py`

### Manual refresh

- Twitch: `POST /api/admin/bot/twitch/refresh-token`
- VK: `POST /api/admin/bot/vk/refresh-token`
- Manual refresh restarts the corresponding bot process after success.

## Startup behavior

- At startup service loads active channels from DB.
- Twitch and VK bots are initialized with current DB tokens.
- If token is missing or invalid, bot startup is skipped and clear fix hints are logged.

## Health and status endpoints

- Twitch token status: `GET /api/admin/bot/twitch/token-status`
- VK token status: `GET /api/admin/bot/vk/token-status`

Typical fields:
- `configured`
- `bot_login`
- `expires_at`
- `days_left`
- `hours_left`
- `seconds_left`
- `needs_refresh`
- `has_refresh_token`

## Security notes

- Tokens are encrypted at rest in DB.
- OAuth `state` is validated in callback.
- One-time link token cannot be reused across platforms.
- Use HTTPS and secure cookies in production.

## Operator flow (recommended)

1. Login to app as admin.
2. Open `/dashboard/dolbaebadmintts?tab=bots`.
3. Generate one-time link for Twitch or VK.
4. Open link in any browser/profile and login as bot account.
5. Verify `configured=true` and bot runtime status in admin page.
