# Features

## TTS
- Providers: gTTS (basic), Google Cloud TTS (quality), F5-TTS (AI).
- Per-user filters, pitch/speed controls, and moderation options.
- Frontend playback respects global TTS status and enabled platforms.
- Google Cloud TTS supports per-user voice pools with preview and random voice selection.

## YouTube Queue
- Requests via chat command `!sr <url-or-query>` or dashboard.
- Queue management: play now, skip, remove, ban.
- Rewards orders via Twitch or VK.

## Chat and Overlay
- Chat overlay with roles, badges, and platform markers.
- VK Live chat supports badge icons and smile emotes.
- Moderation tools and chat history.
- Chat management: user analysis via dashboard or `!analyze <username>`.

## Points and Rewards
- Channel points style rewards and redemption tracking.
- Admin controls to manage rewards.

## Drops
- Lootbox style rewards triggered by chat activity or time.

## Integrations
- Twitch: OAuth, chat, channel points, EventSub.
- VK Live: chat and rewards.
- DonationAlerts: donation playback.
- MemeAlerts: meme coin grants via dashboard and chat commands.
- Bot accounts (Twitch/VK) use OAuth tokens stored in DB with automatic refresh (configure via /auth/{platform}/bot/login).

## Commands
- `!tts`, `!sr`, `!points`, `!skip` and custom commands.
- `!analyze <username>` optional DeepSeek profile summary with ratings.
- `!memegrant <nickname> <amount>` grant MemeAlerts meme coins.
