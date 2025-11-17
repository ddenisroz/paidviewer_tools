# Project Structure

## Root Organization

```
├── bot_service/          # Backend service (FastAPI)
├── frontend/             # Frontend application (React + Vite)
├── tts_service/          # Advanced TTS service (F5-TTS, multi-user)
├── tts_service_simple/   # Simple TTS service (F5-TTS, single-user)
├── docs/                 # Comprehensive documentation
├── legacy/               # Archived legacy code
├── logs/                 # Application logs
├── scripts/              # Utility scripts
└── docker-compose.*.yml  # Docker configurations
```

## Backend Structure (bot_service/)

```
bot_service/
├── api/                  # API endpoints
│   ├── admin/           # Admin-only endpoints
│   └── user/            # User endpoints
├── auth/                # OAuth 2.0 handlers (Twitch, VK)
├── bots/                # Chat bot implementations
│   ├── twitch_bot.py
│   └── vk_bot.py
├── platforms/           # Platform abstraction layer
│   ├── base.py         # StreamingPlatform interface
│   ├── registry.py     # Platform registry
│   ├── twitch.py       # Twitch implementation
│   └── vk.py           # VK implementation
├── services/            # Business logic layer
├── core/                # Core functionality
│   ├── config.py       # Centralized configuration (pydantic-settings)
│   ├── database.py     # SQLAlchemy models
│   ├── websocket_manager.py
│   └── permissions.py  # Role-based access control
├── models/              # Pydantic validation models
├── validators/          # Input validation and sanitization
├── utils/               # Helper utilities
├── middleware/          # FastAPI middleware
├── alembic/             # Database migrations
├── tests/               # Backend tests
├── main.py              # Application entry point
└── requirements.txt     # Python dependencies
```

### Key Backend Patterns

- **API Endpoints**: Use FastAPI routers with dependency injection
- **Authentication**: `Depends(get_current_user)` for protected routes
- **Database**: SQLAlchemy ORM with async support, use `Depends(get_db)` for sessions
- **Validation**: Pydantic models in `models/validation_models.py`
- **Configuration**: Import from `core.config import settings` (never use `os.getenv()`)
- **Logging**: Use `structlog` with contextual information

## Frontend Structure (frontend/)

```
frontend/
├── src/
│   ├── components/      # React components
│   │   ├── ui/         # shadcn/ui base components
│   │   ├── tts/        # TTS-specific components
│   │   ├── admin/      # Admin panel components
│   │   └── widgets/    # OBS widgets
│   ├── pages/           # Page components (route-level)
│   │   ├── Dashboard.tsx
│   │   ├── tts/        # TTS pages
│   │   ├── admin/      # Admin pages
│   │   └── drops/      # Drops pages
│   ├── context/         # React Context providers
│   │   ├── UserContext.tsx
│   │   ├── ChatContext.tsx
│   │   └── IntegrationsContext.tsx
│   ├── services/        # API client services
│   │   └── api.ts      # Axios instance and API calls
│   ├── hooks/           # Custom React hooks
│   │   ├── useFormValidation.ts
│   │   └── useWebSocket.ts
│   ├── utils/           # Utility functions
│   │   ├── validationSchemas.ts  # Zod schemas
│   │   ├── sanitization.ts       # Input sanitization
│   │   └── sharedWebSocket.ts    # WebSocket with Leader Election
│   ├── constants/       # Constants and mappings
│   │   ├── categoryMapping.ts    # Twitch ↔ VK category mapping
│   │   └── categoryAliases.ts    # Search aliases
│   ├── lib/             # Third-party library configs
│   └── App.tsx          # Root component
├── public/              # Static assets
├── dist/                # Build output
└── package.json         # Node dependencies
```

### Key Frontend Patterns

- **TypeScript Migration**: In progress (`.tsx` for new files, `.jsx` being migrated)
- **Components**: Use shadcn/ui components, follow Design System (8px grid)
- **State**: Context API for global state, React Query for server state
- **Forms**: react-hook-form + Zod validation
- **Styling**: Tailwind CSS with design system classes
- **API Calls**: Use `services/api.ts` with error handling
- **Routing**: Lazy loading for code splitting (`React.lazy()`)

## Documentation Structure (docs/)

```
docs/
├── ARCHITECTURE_GUIDE.md        # System architecture
├── LLM_DEVELOPMENT_RULES.md     # AI development guidelines
├── DO_NOT_TOUCH.md              # Protected systems
├── DESIGN_SYSTEM.md             # UI design system
├── VALIDATION_SYSTEM.md         # Validation patterns
├── CURRENT_STATUS.md            # Current implementation status
├── DEVELOPER_GUIDE.md           # Developer onboarding
├── DEPLOYMENT.md                # Deployment guide
├── QUICK_START.md               # Quick start guide
└── [feature-specific docs]      # Individual feature docs
```

## Critical Files - DO NOT MODIFY

See `docs/DO_NOT_TOUCH.md` for comprehensive list. Key protected systems:

1. **TTS System** (8 files) - Platform settings, synchronization, filters
2. **Category System** (5 files) - Stream category mapping and search
3. **WebSocket System** (3 files) - Leader Election, connection management
4. **Performance Optimizations** - Code splitting, virtualization, memoization
5. **Error Handling** - Error boundaries, retry logic
6. **Drops System** - Server-side calculation logic
7. **Configuration System** - `core/config.py`, `.env.example` files

## Naming Conventions

### Backend (Python)
- **Files**: `snake_case.py`
- **Classes**: `PascalCase`
- **Functions**: `snake_case`
- **Constants**: `UPPER_CASE`
- **Private**: `_leading_underscore`

### Frontend (TypeScript/JavaScript)
- **Files**: `PascalCase.tsx` (components), `camelCase.ts` (utilities)
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Hooks**: `useCamelCase`
- **Constants**: `UPPER_CASE` or `camelCase`

## Environment Files

```
bot_service/.env          # Backend configuration
tts_service/.env          # TTS service configuration
frontend/.env             # Frontend configuration

*.env.example             # Templates for each service
```

Never commit `.env` files. Always use `.env.example` as templates.

## Testing Structure

```
bot_service/tests/        # Backend tests
  ├── test_api/          # API endpoint tests
  ├── test_services/     # Service layer tests
  └── conftest.py        # Pytest fixtures

frontend/src/tests/       # Frontend tests (if present)
```

## Build Artifacts (Ignored)

- `frontend/dist/` - Vite build output
- `frontend/node_modules/` - Node dependencies
- `bot_service/__pycache__/` - Python bytecode
- `bot_service/.pytest_cache/` - Pytest cache
- `.venv/` - Python virtual environment
- `logs/` - Application logs

## Key Architectural Principles

1. **Platform Abstraction**: Use `platforms/` layer for multi-platform support
2. **Validation**: Defense in depth (frontend Zod + backend Pydantic)
3. **Configuration**: Centralized via environment variables
4. **Separation of Concerns**: API → Services → Database
5. **Error Handling**: Comprehensive error boundaries and logging
6. **Performance**: Code splitting, lazy loading, virtualization
7. **Security**: Input sanitization, rate limiting, JWT authentication
