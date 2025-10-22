# 📋 Developer Handoff Checklist

**From**: Session 5 Complete (Oct 21, 2025)  
**To**: Next Developer  
**Status**: Ready for handoff ✅

---

## 📚 **ESSENTIAL DOCUMENTS TO READ** (In Order)

### **1. Project Overview (15 min)**
- [ ] Read: `README_MAIN.md` - Start to "Session 5 Complete Summary"
- [ ] Skim: Project structure section
- [ ] Understand: What the bot does (Twitch + VK Live chat monitoring + TTS)

### **2. Developer Guide (20 min)**
- [ ] Read: `DEVELOPER_GUIDE.md` (THIS IS YOUR ROADMAP)
- [ ] Study: "Code Architecture - Key Files" section
- [ ] Understand: TTS flow diagram (10 steps)
- [ ] Review: "Critical Issues Found in Session 5"

### **3. Architecture (15 min)**
- [ ] Read: `docs/ARCHITECTURE_GUIDE.md`
- [ ] Understand: Components (Twitch bot, VK bot, TTS service, etc.)
- [ ] Know: Database structure basics

### **4. Setup (5 min)**
- [ ] Read: `docs/QUICK_START.md`
- [ ] Follow setup steps
- [ ] Get environment running

---

## 🔑 **CRITICAL KNOWLEDGE** (Must Understand)

### **What is TTS_TTV_0.02?**
A bot that:
1. Connects to Twitch & VK Live chat
2. Displays messages in a web dashboard
3. **Converts chat messages to AUDIO (Text-to-Speech)**
4. Plays audio to streamer in real-time

### **Why Did TTS Not Work?**
**Session 5 Root Causes:**
1. ❌ API endpoints returned `dict` instead of `JSONResponse` → CORS errors
2. ❌ `user.tts_enabled` flag was never checked → silent failure
3. ❌ UI showed broken features → confusing UX

**Now Fixed** ✅

### **How Does TTS Work Now?**

```
User clicks Toggle → API saves to DB → Message arrives → Check flags → Generate audio → Play
```

See DEVELOPER_GUIDE.md for full 10-step flow.

### **Database Must-Know**
```python
# THIS FIELD IS CRITICAL:
user.tts_enabled  # If FALSE, NO AUDIO PLAYS - this is the main kill switch!

# Also important:
tts_user_settings.engine  # 'gtts' (basic) or 'f5tts' (AI)
tts_user_settings.enabled_platforms  # ['twitch', 'vk']
audio_settings.website_volume  # 0-100
```

---

## 🚀 **Quick Technical Summary**

### **Backend Stack**
- **Framework**: FastAPI (Python)
- **Bot Library**: TwitchIO (Twitch), custom VK Live client
- **Database**: SQLite with SQLAlchemy ORM
- **TTS Engines**: 
  - Basic: gTTS (Google Text-to-Speech)
  - Advanced: F5-TTS (AI model, requires separate service)

### **Frontend Stack**
- **Framework**: React
- **Communication**: WebSockets (real-time chat)
- **UI**: Tailwind CSS

### **Key Files You'll Touch**
| File | Purpose | Edit Frequency |
|------|---------|---|
| `bot_service/utils/websocket_helper.py` | TTS logic | Often |
| `bot_service/api/tts_api.py` | TTS endpoints | Often |
| `bot_service/bots/twitch_bot_core.py` | Chat message handler | Sometimes |
| `bot_service/core/database.py` | Data models | Rarely |
| `frontend/src/pages/tts/TtsMainPage.jsx` | UI | Sometimes |

---

## 🐛 **Known Issues (Not Fixed Yet)**

### **Priority 1 - Should Fix Soon**
- [ ] Drops system - needs complete redesign (old UI/logic)
- [ ] Local TTS toggle - only UI, no backend logic
- [ ] Form warnings - React controlled/uncontrolled input warnings

### **Priority 2 - Nice to Have**
- [ ] Psychology analysis command (!analyze) - requires AI tokens
- [ ] Video request system - YouTube integration incomplete
- [ ] OBS widget - chat display in OBS

### **Priority 3 - Future**
- [ ] Performance optimization
- [ ] Admin panel improvements
- [ ] Support ticket system completion

---

## ✅ **What's WORKING NOW**

- ✅ Twitch chat integration + message receiving
- ✅ VK Live chat integration + message receiving
- ✅ TTS enable/disable toggle (working API)
- ✅ Basic TTS (gTTS) - generates audio locally
- ✅ AI TTS (F5-TTS) - with fallback to basic
- ✅ Audio file serving (/api/tts/audio/{filename})
- ✅ User settings persistence
- ✅ Platform filtering (Twitch/VK toggle)
- ✅ Volume control
- ✅ Chat history + WebSocket real-time updates

---

## 🧪 **How to Test Everything**

### **Test TTS (5 min)**
1. Start bot: `python -m uvicorn main:app --reload`
2. Open: http://localhost:5173
3. Login with Twitch
4. Go to TTS page
5. **Toggle TTS ON** ← This is the critical step!
6. Go to Chat
7. Write message
8. **Listen for audio** 🔊

### **Debug If Audio Doesn't Play**
```bash
# Check logs for these prefixes:
🎙️ [TWITCH TTS]        # Good - message processing
✅ [BASIC TTS]         # Good - audio generated
ℹ️ [TTS is DISABLED]    # Problem - user didn't toggle!
❌ [TTS Service]       # Problem - synthesis failed
```

---

## 📞 **Key Contact Points**

If you get stuck on:

| Issue | Look At |
|-------|---------|
| TTS not working | DEVELOPER_GUIDE.md "Common Problems" + check logs |
| Database questions | bot_service/core/database.py models |
| API responses | bot_service/api/tts_api.py endpoints |
| Chat flow | bot_service/bots/twitch_bot_core.py + websocket_helper.py |
| React issues | frontend/src/pages/tts/TtsMainPage.jsx |
| Deployment | docs/DEPLOYMENT.md |

---

## 🎯 **Your First Task**

1. **Read** DEVELOPER_GUIDE.md completely
2. **Setup** the project (QUICK_START.md)
3. **Test** TTS manually (see "How to Test" above)
4. **Pick** a known issue to fix from Priority 1 list
5. **Code** → **Test** → **Commit**

---

## 📝 **Notes for Future**

- Database was cleaned on Oct 21, 2025 for fresh testing
- All session notes are in README_MAIN.md (search for "Session X")
- Legacy code folder was deleted - all useful code migrated
- TTS flow is documented with line numbers for quick reference
- Logs have emoji prefixes for easy filtering

---

**Good luck! You've got this! 🚀**

If anything is unclear, refer back to documentation or check git history for why changes were made.

