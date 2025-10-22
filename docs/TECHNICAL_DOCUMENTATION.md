#  Technical Documentation v2.0.0

**Версия:** 2.0.0 | **Дата:** 20 октября 2025

##  Главные компоненты

### Backend (FastAPI)

**API Endpoints (54+):**
- TTS: /api/tts/* (settings, listening-mode, platform-settings, filters, blocked-users)
- Chat: /api/chat/* (history, ws)
- YouTube: /api/youtube/* (search, queue)
- Admin: /api/admin/* (analytics, users)
- Commands: /api/commands/* (list, create, update)
- VK: /api/vk/* (categories, update-category)

**Database Models:**
- User, TTSUserSettings, ChatMessage, FilteredWord, TTSBlockedUser

**Services:**
- OAuth handler, WebSocket manager, TTS processor

### Frontend (React)

**Pages:**
- Dashboard, TTS Settings, Chat, YouTube Queue, Admin Panel

**Components:**
- ChatCard, TtsPlatformSelector, WordFilterManager, etc (50+)

**Context:**
- ChatContext, TTSContext, UserContext

##  Key Flows

### TTS Processing
`
Message  Check Platform Enabled  Apply Filters  Check Blacklist  TTS Engine  Audio
`

### Chat History
`
New Message  Save to DB (author_username)  WebSocket broadcast  React update
`

### Authorization
`
OAuth  Token in DB  Create Session  Auto-connect Bot
`

##  Database

**Main Tables:**
- users (id, username, email)
- tts_user_settings (user_id, listening_mode, enabled_platforms)
- chat_messages (user_id, message, author_username, platform, timestamp)
- filtered_word (user_id, word, is_active)
- tts_blocked_user (user_id, username, platform)

##  Testing

\\\ash
# Backend
pytest bot_service/

# Frontend
npm test
\\\

---

**Версия:** 2.0.0 | **Статус:** Актуально
