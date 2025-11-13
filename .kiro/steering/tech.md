# Tech Stack

## Backend

- **Framework**: FastAPI (Python 3.11+)
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **ORM**: SQLAlchemy with Alembic migrations
- **Authentication**: JWT + OAuth2 (Twitch, VK Live, DonationAlerts)
- **Security**: Fernet encryption for tokens, slowapi + limits for rate limiting
- **WebSocket**: FastAPI WebSocket for real-time communication
- **TTS Engines**: Google Cloud TTS, F5-TTS (local)
- **Bot Libraries**: TwitchIO, custom VK Live HTTP polling

## Frontend

- **Framework**: React 18 (migrating to React 19)
- **Build Tool**: Vite
- **Language**: JavaScript (gradual TypeScript migration in progress)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Context API + React Query (@tanstack/react-query)
- **Routing**: React Router v6
- **WebSocket**: SharedWebSocket with Leader Election pattern
- **Form Handling**: react-hook-form + zod validation

## Infrastructure

- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (production)
- **Deployment**: docker-compose.prod.yml for production, docker-compose.dev.yml for development

## Common Commands

### Development

```bash
# Frontend
npm run dev:frontend          # Start frontend dev server (localhost:5173)
cd frontend && npm run dev    # Alternative

# Backend
npm run dev:bot              # Start bot service (localhost:8000)
cd bot_service && python main.py

# TTS Service
npm run dev:tts              # Start TTS service (localhost:8001)
cd tts_service && python main.py

# Database migrations
cd bot_service
alembic upgrade head         # Apply migrations
alembic revision --autogenerate -m "description"  # Create migration
```

### Production

```bash
npm start                    # Start all services
npm stop                     # Stop all services
npm restart                  # Restart all services
npm run logs                 # View all logs
npm run logs:bot             # View bot service logs
npm run logs:frontend        # View frontend logs
npm status                   # Check service status
```

### Build

```bash
npm run build                # Build frontend for production
cd frontend && npm run build
```

## Key Dependencies

### Backend (bot_service/requirements.txt)
- fastapi, uvicorn - Web framework
- sqlalchemy, alembic - Database ORM and migrations
- twitchio - Twitch integration
- aiohttp, httpx - HTTP clients
- PyJWT, cryptography, python-jose - Authentication
- gtts, pydub - TTS processing
- slowapi, limits - Rate limiting
- psycopg2-binary - PostgreSQL driver

### Frontend (frontend/package.json)
- react, react-dom - UI framework
- @tanstack/react-query - Data fetching and caching
- react-router-dom - Routing
- axios - HTTP client
- @radix-ui/* - UI primitives (shadcn/ui base)
- tailwindcss - Styling
- zod - Schema validation
- react-hook-form - Form handling

## TypeScript Migration

The frontend is undergoing gradual TypeScript migration:
- `allowJs: true` and `checkJs: true` enabled
- Strict mode disabled for gradual adoption
- Both .js and .jsx files are supported alongside .ts and .tsx
