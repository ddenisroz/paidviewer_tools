# 🏗️ Архитектура v2.0.0

**Дата:** 20 октября 2025 | **Версия:** 2.0.0

## 📐 Система

```
Frontend (React)  ──websocket──> Bot Service (FastAPI)
                      │              │
                      └──────────────┴──> SQLite DB
                           │
                    TTS Service (опционально)
```

## 📁 Структура

```
bot_service/
├── api/              # 54+ endpoints (все работают ✅)
├── auth/             # OAuth 2.0 (Twitch + VK Live)
├── core/             # Database models
├── services/         # Business logic
├── bots/             # Twitch bot + VK bot
└── utils/            # Helpers (WebSocket, logging)

frontend/
├── pages/            # Dashboard, TTS Settings, Admin
├── components/       # 50+ React components
├── context/          # Chat, User, TTS context
└── services/         # API client
```

## 🔄 Процессы

### TTS Озвучка
```
Chat Message → WebSocket Handler → Apply Filters → Check Blocked Users 
    ↓
Check Platform Enabled → Send to TTS Engine → Audio → Browser/OBS
```

### Авторизация
```
User → OAuth → Token Save in DB → Session Create → Auto-connect Bot
```

### История Чата
```
Chat Message → Save to DB (author_username) → Load on Page Start
```

## 🗄️ База Данных

**Главные таблицы:**
- `users` - пользователи
- `tts_user_settings` - TTS настройки (listening_mode, enabled_platforms)
- `chat_messages` - история (с author_username)
- `filtered_word` - фильтры слов
- `tts_blocked_user` - чёрный список

## 🔐 Безопасность

- ✅ JWT токены
- ✅ OAuth 2.0
- ✅ Шифрование токенов
- ✅ CORS configured
- ✅ Rate limiting (3 req/sec)
- ✅ Pydantic validation

## 📈 Статус

| Компонент | Статус |
|-----------|--------|
| API | ✅ 100% работает |
| TTS | ✅ Полная функциональность |
| WebSocket | ✅ Real-time |
| Authorization | ✅ OAuth работает |
| Database | ✅ Синхронизирована |
| Admin Panel | ✅ Analytics работает |
| YouTube | ✅ Поиск + очередь |

**Версия:** 2.0.0 | **Готово:** 100%
