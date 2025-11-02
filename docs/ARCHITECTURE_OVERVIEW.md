# 🏗️ Architecture Overview - Краткий обзор

Быстрый обзор архитектуры системы в одной страице.

---

## 🎯 Общая концепция

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🌐 FRONTEND (React)                                       │
│  ├─ Pages: Dashboard, TTS, YouTube, Points, etc.           │
│  ├─ Context API: Auth, TTS, Chat, UserSettings            │
│  └─ Services: TwitchAPI, VkAPI, YoutubeAPI                 │
│                                                             │
│  ⬇️ HTTP + WebSocket (Axios, Socket.IO)                   │
│                                                             │
│  🖥️  BACKEND (FastAPI)                                     │
│  ├─ API Routes: /api/tts, /api/youtube, /api/points, etc. │
│  ├─ Services: TtsService, QueueService, PointsService     │
│  ├─ Bots: TwitchBot, VkLiveBot                            │
│  └─ Auth: OAuth2 (Twitch, VK)                             │
│                                                             │
│  ⬇️ SQL Queries (SQLAlchemy ORM)                          │
│                                                             │
│  💾 DATABASE (SQLite / PostgreSQL)                         │
│  ├─ Users, Tokens, Voices                                 │
│  ├─ TTS Queue, YouTube Queue                              │
│  └─ Points, Drops, Donations                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔀 Data Flow (Пример: Synthesis)

```
1. User clicks "Synthesize" in UI
   ↓
2. Frontend: dispatch TTS action → POST /api/tts/synthesize
   ↓
3. Backend: receive request → sanitize input → check auth
   ↓
4. Backend: add to TTS queue → save to DB
   ↓
5. Backend: process TTS (gTTS or F5-TTS) → generate audio
   ↓
6. Backend: broadcast via WebSocket to all clients
   ↓
7. Frontend: receive audio → play via Audio player
   ↓
8. Chat overlay: display TTS message (if enabled)
```

---

## 📂 Backend Structure

### `bot_service/`

```
api/                         # API endpoints
├── tts_api.py              # TTS synthesis
├── youtube_api_endpoints.py # YouTube queue
├── points_api_endpoints.py  # Channel points
├── drops_api.py             # Drops/lootbox system
├── commands_api.py          # Bot commands
└── support_api.py           # Tickets & support

services/                    # Business logic
├── tts_service/            # Cloud (gTTS) + Local (F5-TTS)
├── queue_service.py        # Queue management
├── points_service.py       # Points calculations
└── websocket_helper.py     # WebSocket broadcasting

core/                        # Core utilities
├── database.py             # SQLAlchemy models
├── middleware.py           # Security headers, logging
├── security_modern.py      # Rate limiting
└── session_manager.py      # Session management

auth/                        # Authentication
├── auth.py                 # JWT, get_current_user
├── twitch_auth.py          # Twitch OAuth
└── vk_auth.py              # VK OAuth

bots/                        # Chat bots
├── twitch_bot.py           # Twitch integration
└── vk_bot.py               # VK Live integration

validators/                  # Input validation
└── input_validators.py     # Sanitization, XSS/SQL injection protection

utils/                       # Shared utilities
├── db_utils.py             # Database helpers (NEW)
└── enhanced_logger.py      # Structured logging
```

---

## 📂 Frontend Structure

### `frontend/src/`

```
pages/                       # Page components
├── HomePage.jsx            # Dashboard
├── tts/                    # TTS pages
├── media/                  # YouTube, Points, Drops
├── ChatWindow.jsx          # Chat interface
└── admin/                  # Admin panel

components/                  # Reusable components
├── tts/                    # TTS-specific
├── chat/                   # Chat-specific
├── layout/                 # Header, Sidebar
├── ui/                     # shadcn/ui components
└── admin/                  # Admin panels

context/                     # Context API
├── AuthContext.jsx         # Authentication (GLOBAL)
├── TtsContext.jsx          # TTS state (LOCAL)
├── ChatContext.jsx         # Chat state (GLOBAL)
├── UserSettingsContext.jsx # Settings (GLOBAL)
└── IntegrationsContext.jsx # Integrations (GLOBAL)

services/                    # API clients
├── microservices.js        # Main API client
├── websocket.js            # WebSocket connection
├── twitchApi.js            # Twitch API
└── youtubeApi.js           # YouTube API

utils/                       # Utilities
├── prodLogger.js           # Production logger
├── platformUtils.js        # Platform helpers (NEW)
├── oauthRedirect.js        # OAuth flow
└── formatUtils.js          # Format helpers

hooks/                       # Custom React hooks
├── useWebSocket.js         # WebSocket hook
└── useBotStatus.js         # Bot status hook
```

---

## 🔐 Authentication Flow

```
1. User clicks "Login with Twitch"
   ↓
2. Frontend redirects to /auth/twitch/start
   ↓
3. Backend generates state + redirects to Twitch OAuth
   ↓
4. User authorizes on Twitch
   ↓
5. Twitch redirects to /auth/twitch/callback?code=xxx&state=yyy
   ↓
6. Backend validates code + state
   ↓
7. Backend creates User + UserToken in DB
   ↓
8. Backend returns JWT token to frontend
   ↓
9. Frontend stores JWT in localStorage
   ↓
10. All future requests include: Authorization: Bearer <JWT>
```

---

## 🗄️ Database Schema (Key Tables)

```sql
-- Users
Users (id, platform, platform_user_id, username, email)

-- Authentication
UserTokens (id, user_id, platform, access_token, refresh_token)

-- TTS
Voices (id, name, language, engine)
UserVoiceSettings (id, user_id, voice_id, volume)

-- Queues
TtsQueue (id, user_id, text, voice_id, status)
YoutubeQueue (id, user_id, video_url, position)

-- Points
ChannelPoints (id, user_id, viewer_id, points)
ChannelReward (id, user_id, title, cost)

-- Admin
BotCommand (id, user_id, command_name, response_text)
SupportTicket (id, user_id, subject, message, status)
```

---

## 🎮 Key Patterns

### 1. API Endpoint Pattern

```python
@router.post("/api/feature")
async def feature_handler(
    request: MyModel,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Sanitize input
    data = sanitize_input(request.data)
    
    # Get record with lock (prevent race condition)
    record = db.query(Model).filter(...).with_for_update().first()
    
    # Business logic
    record.update_field = data
    
    # Commit changes
    db.commit()
    
    return {"success": True, "data": {...}}
```

### 2. React Component Pattern

```jsx
import { useContext, useState, useEffect } from 'react';
import { MyContext } from '@/context/MyContext';
import { botService } from '@/services/microservices';

export const MyComponent = () => {
  const { state, dispatch } = useContext(MyContext);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Fetch data
  }, []);
  
  const handleAction = async () => {
    try {
      const response = await botService.post('/api/feature', data);
      dispatch({ type: 'UPDATE', payload: response.data });
    } catch (error) {
      logger.error('Action failed:', error);
    }
  };
  
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

### 3. Input Validation Pattern

```python
from validators.input_validators import sanitize_input

# Sanitize all user inputs
text = sanitize_input(user_input, max_length=500)
email = validate_email(user_email)
url = validate_url(user_url)
```

---

## 🔗 Communication Protocols

### HTTP (REST)

```
GET    /api/data          # Get data
POST   /api/data          # Create
PUT    /api/data/:id      # Update
DELETE /api/data/:id      # Delete
```

### WebSocket (Real-time)

```
socket.emit('tts:synthesize', data)     # Send event
socket.on('tts:processing', handler)    # Listen event
socket.on('tts:complete', handler)      # Completion
socket.on('chat:message', handler)      # Chat updates
```

---

## ⚡ Performance Optimizations

| Optimization | Implementation |
|--------------|-----------------|
| Caching | Multi-tab sync via localStorage |
| Batch operations | `batch_insert()` in db_utils |
| Pagination | Unified `paginate_query()` |
| Logging | Production logger (dev only) |
| Security | Input sanitization + CSP |
| Race conditions | Pessimistic locking (with_for_update) |

---

## 🔒 Security Layers

```
1. Input Layer → Sanitize all inputs
2. Auth Layer → JWT validation + get_current_user
3. DB Layer → ORM + parameterized queries
4. API Layer → Rate limiting + CORS
5. Transport Layer → HTTPS + WSS
6. Response Layer → CSP headers + nonce-based scripts
```

---

## 📊 Typical Request Flow

```
Frontend                          Backend
   │                                │
   ├─ User Input                    │
   │                                │
   ├─ Sanitize (frontend)           │
   │                                │
   ├─────────── POST /api/xxx ────→ │
   │                                ├─ Authenticate (JWT)
   │                                │
   │                                ├─ Sanitize (backend)
   │                                │
   │                                ├─ Validate (Pydantic)
   │                                │
   │                                ├─ Lock record (with_for_update)
   │                                │
   │                                ├─ Business logic
   │                                │
   │                                ├─ Commit to DB
   │                                │
   │← ────── JSON Response ──────────┤
   │                                │
   ├─ Update UI                     │
   │                                │
   └─ Broadcast via WebSocket ─────→│ (other clients)
```

---

## 🎯 Next Steps

- 📖 **Full Guide:** [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md)
- 👨‍💻 **Developer Guide:** [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- 🔧 **API Reference:** [API endpoints](QUICK_REFERENCE.md)

---

**Версия:** 0.9.5 | **Обновлено:** November 1, 2025
