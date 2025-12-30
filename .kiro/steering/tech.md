# Tech Stack

## Backend (bot_service/)
- Python 3.12
- FastAPI with uvicorn
- SQLAlchemy 2.0 + Alembic migrations
- PostgreSQL (prod) / SQLite (dev)
- pydantic-settings for configuration
- JWT + OAuth2 authentication
- Fernet encryption for tokens
- slowapi for rate limiting

## Frontend (frontend/)
- React 19 + TypeScript
- Vite build system
- Tailwind CSS + shadcn/ui components
- React Query (@tanstack/react-query)
- React Router v7
- Zod for validation
- react-hook-form for forms

## TTS Services
- tts_service/: Advanced F5-TTS (multi-user, GPU)
- tts_service_simple/: Personal F5-TTS (single user, GPU)
- Google Cloud TTS (cloud fallback)

## Common Commands

### Development Setup
```bash
# Activate venv (REQUIRED before any Python commands)
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac
```

### Development
```bash
npm run dev:frontend    # Frontend at localhost:5173
npm run dev:bot         # Backend at localhost:8000 (venv must be active)
npm run dev:tts         # TTS service at localhost:8001 (venv must be active)
```

### Frontend
```bash
cd frontend
npm run dev             # Start dev server
npm run build           # Production build
npm run lint            # ESLint check
npm run lint:fix        # Fix lint issues
npm run type-check      # TypeScript check
npm run test            # Run tests (vitest)
npm run test:coverage   # Tests with coverage
```

### Backend (venv must be active)
```bash
cd bot_service
python main.py          # Start server
pytest                  # Run all tests
pytest --cov            # Tests with coverage
alembic upgrade head    # Apply migrations
alembic revision -m "description"  # Create migration
```

### Docker
```bash
npm run start           # docker-compose up -d
npm run stop            # docker-compose down
npm run logs            # View logs
npm run restart         # Restart services
```

## Key Dependencies
- Backend: fastapi, sqlalchemy, twitchio, aiohttp, pydantic, python-jose (JWT), cryptography (Fernet), sentry-sdk
- Frontend: react, @tanstack/react-query, axios, zod, lucide-react, sonner, @radix-ui (primitives), dompurify

## Code Conventions

### Backend
- Use `core/config.py` settings instead of `os.getenv()` directly
- All datetime operations use `datetime.now(timezone.utc)` (not `datetime.utcnow()`)
- Use `db_session()` context manager for database operations
- Specific exception handling (no bare `except:` blocks)
- Type hints required for all functions
- Pydantic models for request/response validation

### Frontend
- TypeScript strict mode (работаем над полным покрытием)
- React Query для всех API запросов (queries/)
- Zod schemas для валидации форм
- shadcn/ui компоненты из components/ui/
- Toast уведомления через sonner
- Error boundaries для graceful error handling

### API Conventions
- REST endpoints под `/api/` prefix
- Admin endpoints в `/api/admin/`
- WebSocket endpoints в `/ws/`
- Rate limits: 60/min default, 5/15min login, 30/min TTS

### Database
- SQLAlchemy 2.0 async style
- Alembic для всех миграций (никаких ручных изменений схемы)
- Индексы для часто используемых полей (twitch_username, vk_user_id, user_id)
