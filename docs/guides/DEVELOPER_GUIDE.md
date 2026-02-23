# Developer Guide - TTS_TTV_0.02

**Last Updated**: Oct 21, 2025 | **Status**: Session 5 Complete

---

## Quick Start (5 min)

```bash
# 1. Setup environment
cd bot_service
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure .env
cp env.example .env
# Edit .env with your Twitch/VK tokens

# 4. Run
python -m uvicorn main:app --reload
```

---

## Critical Issues Found in Session 5

### **Issue #1: TTS Was Completely Silent**
**Root Cause**: `/api/tts/enable` endpoint returned Python `dict` instead of `JSONResponse`
- **Files Affected**: `bot_service/api/tts_api.py` (lines 512-592)
- **Impact**: CORS errors + 500 responses prevented TTS from being enabled
- **Fix**: Changed all TTS endpoints to return `JSONResponse(content={...})`
- **Status**: FIXED

### **Issue #2: Global TTS Flag Not Checked**
**Root Cause**: `handle_tts_for_message()` didn't verify `user.tts_enabled`
- **Files Affected**: `bot_service/utils/websocket_helper.py` (line 198-201)
- **Impact**: Even if enabled via API, TTS would fail silently
- **Fix**: Added check: `if not channel_owner.tts_enabled: return`
- **Status**: FIXED

### **Issue #3: Mocked UI Elements**
**Root Cause**: Local/Cloud TTS selector showed even when non-functional
- **Files Affected**: `frontend/src/pages/tts/TtsMainPage.jsx` (lines 496-544)
- **Impact**: Confusing UX - users see broken UI
- **Fix**: Hidden selector behind `{localTtsConfig?.configured && (...)}`
- **Status**: FIXED

---

## Code Architecture - Key Files

### **Backend Flow**

```
1. User enables TTS toggle
   ↓
2. POST /api/tts/enable
   ├─ bot_service/api/tts_api.py:512
   └─ TTSService.enable_tts()
       └─ bot_service/services/tts/tts_service.py

3. Message arrives in Twitch chat
   ↓
4. twitch_bot_core.py:event_message() (line 60)
   ├─ broadcast_chat_message()
   └─ handle_tts_for_message() ← THIS IS WHERE LOGIC HAPPENS

5. bot_service/utils/websocket_helper.py:126
   ├─ Check: user.tts_enabled?
   ├─ Check: platform enabled?
   ├─ Check: user not blocked?
   └─ tts_api.send_tts_request()

6. bot_service/services/tts_manager.py
   ├─ Try AI TTS (F5-TTS)
   └─ Fallback to Basic TTS (gTTS)

7. Generate /temp/tts_audio/file.wav
   ↓
8. GET /api/tts/audio/{filename}
   └─ bot_service/api/tts_api.py:883

9. WebSocket broadcast to frontend
   ↓
10. 🔊 AUDIO PLAYS!
```

### **Database Models**

**Critical Fields:**
```python
# User model
user.tts_enabled: Boolean  # MUST BE TRUE or no TTS works!
user.twitch_username: String
user.vk_username: String

# TTSUserSettings
tts_user_settings.engine: String  # 'gtts' | 'gcloud' | 'f5tts' | 'qwen'
tts_user_settings.enabled_platforms: JSON  # ['twitch', 'vk']
tts_user_settings.voice: String
tts_user_settings.listening_mode: String  # 'website' or 'obs'

# AudioSettings
audio_settings.website_volume: Integer  # 0-100
audio_settings.obs_volume: Integer  # 0-100
```

---

## 🔍 **How to Debug**

### **Check if TTS is enabled for user:**
```python
# bot_service/core/database.py
user = db.query(User).filter(User.id == user_id).first()
print(f"TTS enabled: {user.tts_enabled}")  # Should be TRUE
```

### **Check connection manager status:**
```python
# In any endpoint or handler
from core.connection_manager import get_connection_manager
cm = get_connection_manager()
print(cm.tts_enabled_channels)  # Should contain channel name
print(cm.is_tts_enabled("yourchy"))  # Should return True
```

### **Watch TTS flow in logs:**
```bash
# Look for these prefixes:
🎙️ [TWITCH TTS]       # Message processing started
[BASIC TTS]        # gTTS synthesis
[TTS is DISABLED]   # User hasn't enabled TTS
[TTS Service Error]      # Error in synthesis
```

---

## Common Problems & Solutions

### **Problem: Audio Not Playing**
1. Check `/api/tts/enable` returns 200 OK
2. Verify `user.tts_enabled = True` in database
3. Check logs for `[TWITCH TTS]` prefix
4. Verify `/api/tts/audio/{filename}` returns 200 with WAV file

### **Problem: 500 Error on /api/tts/enable**
1. Check `bot_service/services/tts/tts_service.py` for exceptions
2. Verify `user_id` is not None
3. Check `connection_manager.enable_tts_for_channel()` doesn't throw

### **Problem: Messages Not Appearing in Chat**
1. Check WebSocket connection in browser console
2. Verify `broadcast_chat_message()` is called
3. Check `handle_tts_for_message()` doesn't crash silently

---

## Documentation Files

| File | Purpose |
|------|---------|
| docs/README.md | Documentation index |
| docs/QUICKSTART.md | Setup guide |
| docs/ARCHITECTURE.md | System overview |
| docs/architecture/ARCHITECTURE_GUIDE.md | Detailed architecture |
| docs/setup/DEPLOYMENT.md | Production setup |
| docs/guides/DEVELOPER_ONBOARDING.md | Onboarding |
| docs/PROJECT_CONTEXT.md | AI session context |

---

## Key Endpoints

```
# TTS Control
POST /api/tts/enable         # Enable TTS for user
POST /api/tts/disable        # Disable TTS
POST /api/tts/engine         # Set gtts | gcloud | f5_cloud | f5_local | qwen_cloud | qwen_local
GET  /api/tts/audio/{file}   # Serve audio file

# Settings
GET  /api/tts/settings       # Get user TTS settings
POST /api/tts/settings       # Update TTS settings
GET  /api/tts/audio-settings # Get volume levels

# Debug
GET  /api/tts/local-config   # Check local TTS setup
```

---

## Next Steps for Developers

1. **Understand TTS Flow** - Read websocket_helper.py:126
2. **Test Manually** - Toggle TTS, write message, check logs
3. **Debug Issues** - Use prefixes from logs to trace problems
4. **Improve** - Drops system needs redesign, local TTS needs implementation
5. **Deploy** - See docs/setup/DEPLOYMENT.md

---

**Questions?** See docs/README.md for the index.
