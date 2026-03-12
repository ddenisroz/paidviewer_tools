# Legacy Features Overview

## TTS
- Providers: gTTS (basic), Google Cloud TTS (quality), F5-TTS (AI).
- Per-user filters, pitch/speed controls, and moderation options.
- Frontend playback respects global TTS status and enabled platforms.
- Google Cloud TTS supports per-user voice pools with preview and random voice selection.
- If at least one Gemini voice is selected, runtime uses only Gemini voices for playback; otherwise it falls back to the broader premium pool.
- Google Cloud preview response exposes fallback diagnostics (`fallback_used`, `requested_model`) so UI can show when Gemini request fell back to a non-Gemini voice.
- Google Cloud TTS voice list is quality-sorted (Gemini/Chirp/Neural2 first), defaults to premium voices on first setup, and includes Gemini aliases with safe fallback to Chirp3-HD when Gemini profile is unavailable.
- Google Cloud Gemini requests now also resolve plain speaker names (for example `Kore`/`Aoede`) as Gemini voices instead of falling back to default Standard voice.
- Google Cloud voice picker now exposes only Gemini and Chirp3-HD voices (legacy families like Standard/WaveNet/Neural2 are hidden and ignored for runtime selection).
- Default Gemini model for requests is `gemini-2.5-flash-tts` (unless explicitly overridden for preview diagnostics/tests).
- Google Cloud mood presets (`neutral`, `sad`, `happy`) are stored per user and mapped to system prompts on backend; free-form prompt input is not exposed in UI.
- Website-mode synthesis is enabled only when an active `/tts-player` tab is present; OBS-mode synthesis requires an active OBS socket sink.
- When all playback sinks disappear, pending in-memory TTS tasks are dropped instead of continuing synthesis with nowhere to deliver audio.
- `/tts-player` now attempts automatic audio-context initialization/resume on tab open (manual user interaction remains fallback if blocked by browser autoplay policy).

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
- Streak and widget settings include quick presets to reduce fine-grained slider tuning.

## Integrations
- Twitch: OAuth, chat, channel points, EventSub.
- VK Live: chat and rewards.
- DonationAlerts: donation playback.
- MemeAlerts: meme coin grants via dashboard and chat commands.
- MemeAlerts grant resolves nickname via `user/find` and `user/find/streamer`; if API returns `401/403`, UI gets explicit error that target user is likely not present in channel supporters yet.
- MemeAlerts history in dashboard uses local grant log (`memealerts_grant_history`) for `Выдачи` and MemeAlerts `POST /supporters` feed for `Покупки`.
- Bot accounts (Twitch/VK) use OAuth tokens stored in DB with automatic refresh (configure via Admin Bot Connect tab or `/auth/{platform}/bot/login`).
- VK bot chat polling uses dedicated bot OAuth token (no fallback to streamer user token), with `401` handling (dev->prod fallback, then OAuth refresh with cooldown) and manual refresh via `/api/admin/bot/vk/refresh-token`.

## Commands
- `!tts`, `!sr`, `!points`, `!skip` and custom commands.
- `!analyze <username>` optional DeepSeek profile summary with ratings.
- `!memegrant <nickname> <amount>` grant MemeAlerts meme coins.
