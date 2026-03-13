# Admin And Bot OAuth Setup

## Current model (no bootstrap endpoint)

- Bot OAuth endpoints:
  - `GET /auth/twitch/bot/login`
  - `GET /auth/vk/bot/login`
- Access rule: only authenticated app admin session.
- Runtime source of bot credentials: DB table `bot_tokens`.
- Legacy env bot tokens are ignored by runtime.

## Admin provisioning

There is no `/api/auth/bootstrap-admin` flow anymore.

Create/promote admin via DB role management:

- `users.role = 'admin'` is the source of truth.
- `users.is_admin` is compatibility only and should match role.
- Helper script: `python bot_service/scripts/make_admin.py <user_id>`

## Bot authorization flow

1. Login to the app with an account that already has admin role.
2. Open admin panel bots section:
   - `http://localhost:5173/dashboard/dolbaebadmintts?tab=bots`
3. In `Bot Connect`, generate one-time link for platform (`Twitch` or `VK Live`).
4. Open one-time link in any browser/profile and complete provider OAuth as bot account.
5. Callback stores/updates tokens in `bot_tokens` and restarts corresponding bot.
6. On startup and on bot restart, service loads all active user channels from DB and connects bots to those chats.

### Alternative flow (different browser/profile for bot login)

If admin app session and bot provider login must be in different browser/profile:

1. In admin browser, request one-time link:
   - `GET /api/admin/bot/twitch/login-link`
   - `GET /api/admin/bot/vk/login-link`
2. Copy `url` from JSON response.
3. Open that URL in any browser/profile and complete provider OAuth as bot account.

Notes:
- Link token is short-lived (10 minutes).
- Runtime still stores bot tokens only in `bot_tokens`.

## Token lifecycle

- Background task `refresh_bot_oauth_tokens` runs every hour.
- Validator checks token validity and attempts refresh via `refresh_token`.
- If refresh fails, admin must re-authorize bot via OAuth login route.
