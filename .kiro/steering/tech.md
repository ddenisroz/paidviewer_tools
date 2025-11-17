# Technology Stack

## Backend (bot_service)

- **Framework**: FastAPI 0.121.2
- **Language**: Python 3.10+
- **Database**: SQLite (dev) / PostgreSQL (prod) with SQLAlchemy 2.0.44
- **Migrations**: Alembic 1.17.1
- **Authentication**: JWT + OAuth2 (Twitch, VK Live)
- **Security**: Fernet encryption, slowapi rate limiting, pydantic validation
- **WebSocket**: FastAPI WebSocket with connection manager
- **Async**: aiohttp, httpx for non-blocking operations
- **Logging**: structlog with rotation
- **Testing**: pytest, pytest-asyncio, pytest-cov

## Frontend

- **Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.2
- **Language**: TypeScript migration in progress (allowJs: true, strict: false)
- **Routing**: react-router-dom 7.8.2
- **State Management**: React Context API, @tanstack/react-query 5.90.6
- **Forms**: react-hook-form 7.66.0 with @hookform/resolvers
- **Validation**: Zod 4.1.12
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS 3.4.17 with 8px grid system
- **Icons**: lucide-react 0.544.0
- **Notifications**: sonner 2.0.7
- **Testing**: @testing-library/react, jest

## TTS Service

- **Framework**: FastAPI
- **TTS Engines**: Google Cloud TTS, F5-TTS 1.1.9
- **ML/AI**: PyTorch 2.6.0+cu124, transformers 4.57.1, faster-whisper 1.2.1
- **Audio**: librosa 0.11.0, soundfile 0.13.1, pydub 0.25.1
- **GPU**: CUDA 12.4 support

## Infrastructure

- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: nginx
- **Tunneling**: Cloudflare Tunnel support
- **Environment**: pydantic-settings 2.11.0 for centralized config

## Common Commands

### Development

```bash
# Frontend
npm run dev:frontend          # Start dev server (localhost:5173)
cd frontend && npm run build  # Build for production

# Backend
npm run dev:bot              # Start bot service (localhost:8000)
cd bot_service && python main.py

# TTS Service
npm run dev:tts              # Start TTS service (localhost:8001)
cd tts_service && python main.py

# Database migrations
cd bot_service
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

### Production (Docker)

```bash
npm start                    # Start all services
npm stop                     # Stop all services
npm restart                  # Restart all services
npm run logs                 # View all logs
npm run logs:bot             # View bot service logs
npm run logs:frontend        # View frontend logs
npm run status               # Check service status
```

### Code Quality

```bash
# Design system checks
npm run check:design         # Check design system compliance
npm run migrate:design:apply # Auto-fix design issues

# Python linting
cd bot_service
ruff check .
ruff format .

# Frontend linting
cd frontend
npm run lint

# Testing
cd bot_service
pytest                       # Run all tests
pytest --cov                 # With coverage
pytest -v tests/specific_test.py  # Specific test

# Run all tests (from root)
python run_all_tests.py
```

### Setup & Migration

```bash
# Initial setup
./migrate.sh                 # Linux/Mac
migrate.ps1                  # Windows

# Generate security keys
openssl rand -hex 32         # SECRET_KEY, JWT_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # ENCRYPTION_KEY
```

## Key Libraries & Frameworks

- **API Client**: axios 1.11.0
- **Virtual Scrolling**: @tanstack/react-virtual 3.13.12
- **Debouncing**: use-debounce 10.0.6
- **YouTube Player**: react-youtube 10.1.0
- **Monitoring**: prometheus-client 0.23.1, sentry-sdk 2.44.0
- **Rate Limiting**: slowapi 0.1.9, limits 5.6.0
- **Caching**: cachetools 6.2.0

## Configuration Management

All configuration via environment variables:
- `bot_service/.env` - Backend config (OAuth, database, security)
- `tts_service/.env` - TTS engine config
- `frontend/.env` - API endpoints, feature flags

Use `core/config.py` (pydantic-settings) for centralized backend config - never use `os.getenv()` directly.
