# Project Structure

## Root Layout
```
├── bot_service/        # Python FastAPI backend
├── frontend/           # React + Vite frontend
├── tts_service/        # Advanced TTS (F5-TTS, multi-user)
├── tts_service_simple/ # Simple TTS (F5-TTS, single user)
├── docs/               # Documentation
├── scripts/            # Build/migration scripts
└── logs/               # Application logs
```

## Backend (bot_service/)
```
bot_service/
├── api/                # API endpoints (REST)
│   ├── admin/          # Admin-only endpoints
│   └── user/           # User endpoints
├── auth/               # OAuth handlers (Twitch, VK, DonationAlerts)
├── bots/               # Bot logic (Twitch, VK Live)
├── core/               # Config, database, middleware, auth
├── features/           # Feature modules
│   ├── analytics/
│   ├── commands/
│   ├── drops/
│   ├── tts/
│   └── youtube/
├── middleware/         # Request middleware
├── models/             # SQLAlchemy models
├── platforms/          # Platform abstraction (Twitch, VK)
├── services/           # Business logic services
├── startup/            # App lifecycle (lifespan, bot registry)
├── utils/              # Shared utilities
├── validators/         # Input validation
├── alembic/            # Database migrations
├── tests/              # pytest tests
└── main.py             # FastAPI app entry point
```

## Frontend (frontend/src/)
```
frontend/src/
├── components/         # Reusable UI components
│   └── ui/             # shadcn/ui primitives
├── constants/          # App constants
├── context/            # React Context providers
├── features/           # Feature-specific code
│   ├── admin/
│   ├── drops/
│   └── tts/
├── hooks/              # Custom React hooks
├── pages/              # Route pages
│   └── admin/          # Admin pages
├── queries/            # React Query hooks
├── services/           # API client services
├── types/              # TypeScript types
├── utils/              # Utility functions
├── widgets/            # OBS widget components
├── App.tsx             # Root component
└── main.tsx            # Entry point
```

## Configuration Files
- `bot_service/.env` - Backend config (OAuth, DB, security)
- `frontend/.env` - Frontend config (API endpoints)
- `tts_service/.env` - TTS engine config
- `bot_service/alembic.ini` - Migration config
- `frontend/vite.config.js` - Vite build config
- `frontend/tsconfig.json` - TypeScript config
- `bot_service/pytest.ini` - Test config

## Key Patterns
- Backend uses feature-based organization under `features/`
- Frontend uses feature modules with co-located components/hooks
- Platform abstraction in `platforms/` for Twitch/VK
- API routes follow REST conventions with `/api/` prefix
- WebSocket endpoints in `api/websocket_endpoints.py`

## Important Files
- `bot_service/core/config.py` - All settings via pydantic-settings
- `bot_service/core/database.py` - DB models, session management, `db_session()` context manager
- `bot_service/startup/lifespan.py` - App lifecycle events
- `bot_service/startup/bot_registry.py` - Bot instance management
- `frontend/src/context/AuthContext.tsx` - Authentication state
- `frontend/src/services/api.ts` - Axios instance with interceptors

## Database
- Models defined in `bot_service/models/` and `bot_service/core/database.py`
- Migrations in `bot_service/alembic/versions/`
- Dev database: `bot_service/data/app_data.db` (SQLite)
- Prod database: PostgreSQL (configured via DATABASE_URL)

## Logs
- Backend logs: `logs/` directory (rotation enabled)
- Structured logging via structlog
- Sentry integration for error tracking
