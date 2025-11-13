# Project Structure

## Root Layout

```
├── bot_service/          # Backend FastAPI service
├── tts_service/          # TTS microservice (F5-TTS)
├── tts_service_simple/   # Simplified TTS service
├── frontend/             # React frontend
├── docs/                 # Documentation
├── logs/                 # Application logs
├── scripts/              # Utility scripts
├── docker-compose.*.yml  # Docker configurations
└── nginx*.conf           # Nginx configurations
```

## Backend Structure (bot_service/)

```
bot_service/
├── api/                  # API endpoints (REST)
│   ├── tts_api.py       # TTS synthesis endpoints
│   ├── youtube_api_endpoints.py
│   ├── points_api_endpoints.py
│   ├── drops_api.py
│   ├── commands_api.py
│   └── support_api.py
├── auth/                 # Authentication logic
│   ├── auth.py          # JWT validation, get_current_user
│   ├── twitch_auth.py   # Twitch OAuth flow
│   └── vk_auth.py       # VK Live OAuth flow
├── bots/                 # Chat bot integrations
│   ├── twitch_bot.py    # Twitch chat bot
│   └── vk_bot.py        # VK Live chat bot
├── core/                 # Core utilities
│   ├── database.py      # SQLAlchemy models and DB setup
│   ├── middleware.py    # Security headers, logging
│   ├── security_modern.py  # Rate limiting
│   └── session_manager.py  # Session management
├── services/             # Business logic layer
│   ├── tts_service/     # TTS processing (gTTS, F5-TTS)
│   ├── queue_service.py # Queue management
│   ├── points_service.py
│   └── websocket_helper.py  # WebSocket broadcasting
├── validators/           # Input validation
│   └── input_validators.py  # XSS/SQLi sanitization
├── utils/                # Shared utilities
│   ├── db_utils.py      # Database helpers
│   └── enhanced_logger.py  # Structured logging
├── models/               # Data models
├── alembic/              # Database migrations
├── main.py               # Application entry point
└── requirements.txt      # Python dependencies
```

## Frontend Structure (frontend/src/)

```
frontend/src/
├── pages/                # Page components (routes)
│   ├── HomePage.jsx     # Dashboard
│   ├── tts/             # TTS-related pages
│   ├── media/           # YouTube, Points, Drops pages
│   ├── ChatWindow.jsx   # Chat interface
│   └── admin/           # Admin panel pages
├── components/           # Reusable components
│   ├── tts/             # TTS-specific components
│   ├── chat/            # Chat-specific components
│   ├── layout/          # Header, Sidebar, Footer
│   ├── ui/              # shadcn/ui base components
│   └── admin/           # Admin panel components
├── context/              # React Context providers
│   ├── AuthContext.jsx  # Authentication (GLOBAL)
│   ├── TtsContext.jsx   # TTS state (LOCAL)
│   ├── ChatContext.jsx  # Chat state (GLOBAL)
│   ├── UserSettingsContext.jsx  # User settings (GLOBAL)
│   └── IntegrationsContext.jsx  # Platform integrations (GLOBAL)
├── services/             # API client layer
│   ├── microservices.js # Main API client (axios)
│   ├── websocket.js     # WebSocket connection
│   ├── twitchApi.js     # Twitch API wrapper
│   └── youtubeApi.js    # YouTube API wrapper
├── hooks/                # Custom React hooks
│   ├── useWebSocket.js  # WebSocket hook
│   ├── useAutoSave.js   # Auto-save with debounce
│   ├── useDropsConfig.js
│   └── useChatScroll.js
├── utils/                # Utility functions
│   ├── prodLogger.js    # Production logger
│   ├── platformUtils.js # Platform helpers
│   ├── oauthRedirect.js # OAuth flow helpers
│   └── formatUtils.js   # Formatting utilities
├── constants/            # Constants and configuration
│   ├── categoryMapping.js  # Twitch ↔ VK category mapping
│   ├── categoryAliases.js  # Game name aliases
│   ├── drops.js         # Drops system constants
│   └── websocket.js     # WebSocket event constants
└── App.jsx               # Root component
```

## Key Architectural Patterns

### Backend Patterns

1. **API Endpoint Pattern**: All endpoints in `api/` folder, use FastAPI dependency injection
2. **Service Layer**: Business logic separated in `services/`
3. **Authentication**: JWT validation via `Depends(get_current_user)`
4. **Database Access**: SQLAlchemy ORM with `Depends(get_db)`
5. **Input Validation**: All user input sanitized via `validators/input_validators.py`

### Frontend Patterns

1. **Context API**: Global state in Context providers (Auth, Chat, Settings)
2. **React Query**: Data fetching and caching for API calls
3. **Custom Hooks**: Reusable logic extracted to `hooks/`
4. **Component Organization**: Pages use components, components use ui primitives
5. **Constants**: Hardcoded values extracted to `constants/`

## Critical Files (DO NOT MODIFY)

See `docs/DO_NOT_TOUCH.md` for detailed list. Key protected systems:

1. **TTS System** (8 files, 1500+ lines) - Platform toggles, synchronization
2. **Category System** (6 files, 893+ lines) - Stream category mapping, smart search
3. **Authentication Flow** - OAuth handlers, token management
4. **WebSocket System** - SharedWebSocket, leader election

## Documentation

All documentation in `docs/` folder:
- `CURRENT_STATUS.md` - Current project state (READ FIRST)
- `LLM_DEVELOPMENT_RULES.md` - Development rules for AI (MANDATORY)
- `DO_NOT_TOUCH.md` - Protected files list
- `ARCHITECTURE_OVERVIEW.md` - System architecture
- `DEVELOPER_GUIDE.md` - Development patterns

## Naming Conventions

- **Python files**: `snake_case.py`
- **React files**: `PascalCase.jsx` or `.tsx`
- **Python classes**: `PascalCase`
- **Python functions**: `snake_case`
- **Constants**: `UPPER_CASE`
- **React components**: `PascalCase`
- **React hooks**: `useCamelCase`
