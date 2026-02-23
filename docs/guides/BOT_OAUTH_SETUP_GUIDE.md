# Bot OAuth Setup Guide

## Scope

This guide explains how to configure bot authorization for Twitch and VK Live in production and local development.

Runtime model:
- Bot tokens are stored in DB (`bot_tokens`).
- Runtime does not use legacy env bot token fallback.
- Bot OAuth is admin-controlled.
- If `bot_tokens` is missing, backend may auto-bootstrap from active admin OAuth user token.

## Prerequisites

1. At least one app user with admin role.
2. Backend and frontend env values configured.
3. OAuth app credentials for Twitch and VK Live.

## Step 1: Verify admin account

Use an existing admin user or promote one via DB/script:

```bash
cd bot_service
python scripts/check_admin.py
python scripts/make_admin.py <user_id>
```

Source of truth: `users.role='admin'`.

## Step 2: Configure OAuth applications

### Twitch

- Create/update app at `https://dev.twitch.tv/console/apps`.
- Add redirect URL:
  - Local: `http://localhost:8000/auth/twitch/bot/callback`
  - Prod: `https://<your-domain>/auth/twitch/bot/callback`
- Bot OAuth requests these scopes:
  - `chat:read`
  - `chat:edit`
  - `channel:moderate`
  - `moderation:read`
  - `channel:read:polls`
  - `channel:manage:polls`
  - `channel:manage:predictions`
  - `channel:manage:redemptions`
  - `channel:manage:broadcast`
  - `clips:edit`
  - `whispers:read`
  - `whispers:edit`

### VK Live

- Configure app in VK Live developer console.
- Add redirect URL:
  - Local: `http://localhost:8000/auth/vk/bot/callback`
  - Prod: `https://<your-domain>/auth/vk/bot/callback`

## Step 3: Configure backend env

Example (`bot_service/.env`):

```bash
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

TWITCH_CLIENT_ID=<twitch_client_id>
TWITCH_CLIENT_SECRET=<twitch_client_secret>

VK_CLIENT_ID=<vk_client_id>
VK_CLIENT_SECRET=<vk_client_secret>

# Optional self-healing bootstrap (recommended true)
BOT_TOKEN_AUTO_BOOTSTRAP_ENABLED=true
BOT_TOKEN_AUTO_BOOTSTRAP_ADMIN_ONLY=true
BOT_TOKEN_AUTO_BOOTSTRAP_REQUIRE_REFRESH_TOKEN=false
```

## Step 4: Start services

```bash
cd bot_service
python main.py

cd ../frontend
npm run dev
```

## Step 5: Authorize bot accounts

1. Login to app as admin.
2. Open admin bot tab:
   - `http://localhost:5173/dashboard/dolbaebadmintts?tab=bots`
3. For each platform (`Twitch`, `VK Live`):
   - Click `Create link`.
   - Open link in any browser/profile.
   - Login as the bot account on provider side.
   - Complete OAuth consent.

After callback, tokens are saved in DB and bot runtime is restarted.

## One-time link flow (different browser/profile)

If admin session and bot provider session must be separated:

- `GET /api/admin/bot/twitch/login-link`
- `GET /api/admin/bot/vk/login-link`

Response includes temporary URL (10 minutes TTL).

## Validation and operations

### Status endpoints

- Twitch: `GET /api/admin/bot/twitch/token-status`
- VK: `GET /api/admin/bot/vk/token-status`

### Manual refresh endpoints

- Twitch: `POST /api/admin/bot/twitch/refresh-token`
- VK: `POST /api/admin/bot/vk/refresh-token`

### Expected fields

- `configured`
- `bot_login`
- `days_left`
- `hours_left`
- `seconds_left`
- `needs_refresh`
- `has_refresh_token`

## Auto refresh behavior

- Background job checks tokens every hour.
- Startup also performs proactive refresh for near-expiry tokens (15 minutes before expiry).
- If refresh fails, re-authorize via bot OAuth flow.

UI note:
- Tokens with a short lifetime (for example Twitch bot tokens on the order of hours) can have `days_left=0` while still valid; use `seconds_left`/`hours_left` for precise display.

## Troubleshooting

### Admin access denied

- Ensure current user has `users.role='admin'`.
- Re-login after role update.

### OAuth callback error

- Verify redirect URL matches provider app config exactly.
- Verify `BACKEND_URL` and `FRONTEND_URL` values.
- Verify provider app credentials.

### Bot not connecting to channels

- Check startup logs for token validation errors.
- Confirm active channels exist in DB for target platform.
- Confirm status endpoint returns `configured=true`.

### Link expired

- Create a new one-time link from admin bot tab.

## Security notes

- Use HTTPS in production.
- Keep client secrets and encryption keys out of VCS.
- Restrict admin role assignment process.
