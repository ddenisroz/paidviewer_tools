# DB Table Usage Audit (2026-02-23)

Static analysis only (source references). No destructive actions were performed.

## Method

- Source of tables: SQLAlchemy models with `__tablename__` in `bot_service/models/*.py`.
- `model refs`: class-name matches outside the model file.
- `table refs`: string literal table-name matches outside the model file.
- Alembic files are excluded from counts.

## Summary

- Total ORM tables detected: 39
- Potentially low-used tables (heuristic): 0 (model_refs <= 1, table_refs <= 1)

## Full Table Reference Matrix

| table | model | model refs | table refs | model file |
|---|---:|---:|---:|---|
| `achievements` | `Achievement` | 4 | 0 | `bot_service/models/gamification.py` |
| `admin_users` | `AdminUser` | 15 | 0 | `bot_service/models/user.py` |
| `audio_settings` | `AudioSettings` | 25 | 5 | `bot_service/models/tts.py` |
| `blocked_bots` | `BlockedBot` | 26 | 0 | `bot_service/models/moderation.py` |
| `blocked_channels` | `BlockedChannel` | 22 | 1 | `bot_service/models/moderation.py` |
| `bot_commands` | `BotCommand` | 183 | 1 | `bot_service/models/commands.py` |
| `bot_tokens` | `BotToken` | 15 | 0 | `bot_service/models/bot_token.py` |
| `channel_points` | `ChannelPoints` | 39 | 5 | `bot_service/models/points.py` |
| `channel_rewards` | `ChannelReward` | 40 | 0 | `bot_service/models/points.py` |
| `chat_messages` | `ChatMessage` | 146 | 3 | `bot_service/models/analytics.py` |
| `chatbox_settings` | `ChatBoxSettings` | 32 | 2 | `bot_service/models/widgets.py` |
| `donation_alerts` | `DonationAlert` | 27 | 0 | `bot_service/models/gamification.py` |
| `drops_configs` | `DropsConfig` | 56 | 0 | `bot_service/models/drops.py` |
| `drops_history` | `DropsHistory` | 54 | 0 | `bot_service/models/drops.py` |
| `drops_qualities` | `DropsQuality` | 49 | 0 | `bot_service/models/drops.py` |
| `drops_rewards` | `DropsReward` | 48 | 0 | `bot_service/models/drops.py` |
| `drops_types` | `DropsType` | 4 | 0 | `bot_service/models/drops.py` |
| `filtered_words` | `FilteredWord` | 37 | 2 | `bot_service/models/tts.py` |
| `local_tts_endpoints` | `LocalTTSEndpoint` | 39 | 1 | `bot_service/models/tts.py` |
| `memealerts_grant_history` | `MemeAlertsGrantHistory` | 10 | 0 | `bot_service/models/drops.py` |
| `mythical_drops_sessions` | `MythicalDropsSession` | 28 | 0 | `bot_service/models/drops.py` |
| `points_transactions` | `PointsTransaction` | 15 | 0 | `bot_service/models/points.py` |
| `psychology_analysis` | `PsychologyAnalysis` | 18 | 0 | `bot_service/models/analytics.py` |
| `reward_queue` | `RewardQueue` | 35 | 0 | `bot_service/models/points.py` |
| `security_logs` | `SecurityLog` | 11 | 0 | `bot_service/models/security.py` |
| `stream_sessions` | `StreamSession` | 45 | 0 | `bot_service/models/drops.py` |
| `system_logs` | `SystemLog` | 33 | 0 | `bot_service/models/security.py` |
| `tts_blocked_users` | `TTSBlockedUser` | 40 | 1 | `bot_service/models/tts.py` |
| `tts_user_settings` | `TTSUserSettings` | 61 | 1 | `bot_service/models/tts.py` |
| `user_achievements` | `UserAchievement` | 4 | 0 | `bot_service/models/gamification.py` |
| `user_progression` | `UserProgression` | 7 | 0 | `bot_service/models/analytics.py` |
| `user_sessions` | `UserSession` | 128 | 2 | `bot_service/models/user.py` |
| `user_settings` | `UserSettings` | 93 | 5 | `bot_service/models/user.py` |
| `user_streaks` | `UserStreak` | 54 | 0 | `bot_service/models/drops.py` |
| `user_tokens` | `UserToken` | 216 | 2 | `bot_service/models/user.py` |
| `user_voice_settings` | `UserVoiceSettings` | 34 | 0 | `bot_service/models/tts.py` |
| `users` | `User` | 690 | 12 | `bot_service/models/user.py` |
| `whitelisted_channels` | `WhitelistedChannel` | 73 | 1 | `bot_service/models/moderation.py` |
| `youtube_queue` | `YouTubeQueue` | 90 | 0 | `bot_service/models/youtube.py` |

## Recommendation

- Treat this report as a heuristic pre-filter, not a deletion list.
- Confirm runtime usage with query logs or endpoint traces before dropping tables.
- Remove confirmed obsolete tables only via Alembic migrations.
