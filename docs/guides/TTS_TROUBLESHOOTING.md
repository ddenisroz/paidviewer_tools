# TTS Troubleshooting Guide

## Issue: TTS not working after auth cleanup

### Diagnosis Steps

1. **Check user TTS status:**
   ```bash
   cd bot_service
   python scripts/check_tts_status.py <user_id>
   ```

2. **Check if bot is connected to chat:**
   - Look for `[OK] MONITORING CHAT: <channel>` in logs
   - Check `bot_service/logs/app/*.log`

3. **Check if messages are received:**
   - Look for `[MIC] [TWITCH TTS] Processing message` in logs
   - Look for `[BROADCAST] Incoming message` in logs

4. **Check TTS settings:**
   - `tts_enabled` must be `True` in users table
   - `engine` should be `gtts` for Google TTS (works for all)
   - `engine` = `f5tts` requires whitelist (unless `use_local_tts = True`)

### Common Issues

#### 1. TTS globally disabled
**Symptom:** `TTS is DISABLED GLOBALLY for user`

**Solution:**
```sql
UPDATE users SET tts_enabled = true WHERE id = <user_id>;
```

#### 2. User not in whitelist (for F5-TTS)
**Symptom:** `User NOT in whitelist, falling back to gTTS`

**Solution:** Either:
- Use Google TTS (default, works for all)
- Add to whitelist for F5-TTS:
```sql
INSERT INTO whitelisted_channels (channel_name, platform) 
VALUES ('<username>', 'twitch');
```

#### 3. Bot not connected to channel
**Symptom:** No `[OK] MONITORING CHAT` in logs

**Solution:**
- Check OAuth token is valid
- Check channel name is correct
- Restart bot service

#### 4. Messages not processed
**Symptom:** Messages appear in chat but no TTS logs

**Check:**
- Is `tts_mode` set to `channel_points`? (requires reward redemption)
- Are messages from blocked bots? (Nightbot, StreamElements, etc.)
- Is user blocked from TTS?

### After Guest Mode Removal

- ✅ All authenticated users can use Google TTS
- ✅ Whitelist only needed for F5-TTS and custom voices
- ✅ No more guest sessions or basic auth

### Quick Fix Commands

```bash
# Enable TTS for user
psql -d <database> -c "UPDATE users SET tts_enabled = true WHERE id = 1;"

# Add to whitelist
psql -d <database> -c "INSERT INTO whitelisted_channels (channel_name, platform) VALUES ('yourchy', 'twitch');"

# Check TTS status
cd bot_service && python scripts/check_tts_status.py 1
```

---

**Date:** 2024-12-18
