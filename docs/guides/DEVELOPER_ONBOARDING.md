# Developer Onboarding Guide

**Welcome to TTS_TTV_0.02!** This guide will help you get started with development on the unified streaming platform.

---

## Prerequisites

### Required Software
- **Python 3.10+** - Backend runtime
- **Node.js 22+** - Frontend build tools
- **Git** - Version control
- **Docker** (optional) - For containerized deployment

### Recommended Tools
- **VS Code** - IDE with Python and TypeScript extensions
- **Postman** or **Thunder Client** - API testing
- **PostgreSQL** (optional) - Production database

---

## Quick Setup (15 minutes)

### 1. Clone and Setup Environment

```bash
# Clone the repository
git clone <repository-url>
cd TTS_TTV_0.02

# Setup backend
cd bot_service
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Setup frontend
cd ../frontend
npm install
```

### 2. Configure Environment Variables

```bash
# Backend configuration
cd bot_service
cp env.example .env

# Edit .env with your credentials:
# - Twitch OAuth credentials
# - VK Live OAuth credentials
# - Database settings
# - Security keys

# Frontend configuration
cd ../frontend
cp .env.example .env

# Default frontend .env should work for local development
```

### 3. Initialize Database

```bash
cd bot_service

# Run migrations
alembic upgrade head

# Verify database
python -c "from core.database import engine; print('Database OK')"
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend
cd bot_service
python main.py
# Should start on http://localhost:8000

# Terminal 2: Frontend
cd frontend
npm run dev
# Should start on http://localhost:5173
```

### 5. Verify Installation

- **Backend API Docs:** http://localhost:8000/docs
- **Frontend:** http://localhost:5173
- **Check browser console** for errors
- **Check terminal logs** for startup issues

---

## Project Structure Overview

```
TTS_TTV_0.02/
├── bot_service/          # Backend (FastAPI)
│   ├── api/             # API endpoints
│   ├── auth/            # OAuth handlers
│   ├── bots/            # Chat
 bots (Twitch, VK)
│   ├── core/            # Core functionality
│   ├── features/        # Feature modules
│   ├── models/          # Pydantic models
│   ├── platforms/       # Platform abstraction
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   └── main.py          # Entry point
│
├── frontend/            # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── context/     # Context providers
│   │   ├── features/    # Feature modules
│   │   ├── pages/       # Page components
│   │   ├── services/    # API clients
│   │   └── utils/       # Utilities
│   └── package.json
│
├── <external f5-tts-service repo>  # TTS service (optional, standalone)
├── docs/                # Documentation
└── scripts/             # Utility scripts
```

---

## Key Concepts

### 1. Platform Abstraction Layer

The platform abstraction layer (`bot_service/platforms/`) provides a unified interface for Twitch and VK Live:

```python
# bot_service/platforms/base.py
class StreamingPlatform(ABC):
    @abstractmethod
    async def get_user_info(self, user_id: str) -> dict:
        pass
    
    @abstractmethod
    async def send_message(self, channel: str, message: str):
        pass
```

**Usage:**
```python
from platforms.registry import get_platform

platform = get_platform('twitch')
user_info = await platform.get_user_info(user_id)
```

### 2. Configuration Management

All configuration is centralized in `bot_service/core/config.py` using Pydantic Settings:

```python
from core.config import settings

# Access configuration
database_url = settings.DATABASE_URL
twitch_client_id = settings.TWITCH_CLIENT_ID
```

**Never use `os.getenv()` directly!** Always use the `settings` object.

### 3. Validation System

Input validation uses Pydantic models:

```python
# bot_service/models/validation_models.py
class TTSSettingsUpdate(BaseModel):
    engine: Literal['gtts', 'gcloud', 'f5tts', 'qwen']
    enabled_platforms: List[str]
    voice: Optional[str] = None
```

Frontend validation uses Zod:

```typescript
// frontend/src/utils/validationSchemas.ts
const ttsSettingsSchema = z.object({
  engine: z.enum(['gtts', 'gcloud', 'f5tts', 'qwen']),
  enabled_platforms: z.array(z.string()),
  voice: z.string().optional()
});
```

### 4. WebSocket with Leader Election

The frontend uses a shared WebSocket connection with Leader Election to prevent duplicate connections:

```typescript
// frontend/src/utils/sharedWebSocket.ts
import { getSharedWebSocket } from './sharedWebSocket';

const ws = getSharedWebSocket();
ws.subscribe('chat_message', (data) => {
  console.log('New message:', data);
});
```

### 5. Permission System

Role-based access control (RBAC):

```python
# bot_service/core/permissions.py
from core.permissions import require_permission

@router.post("/admin/users")
async def create_user(
    user: User = Depends(require_permission('admin'))
):
    # Only admins can access
    pass
```

---

## Development Workflow

### 1. Creating a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Backend: Create feature module
mkdir bot_service/features/my_feature
touch bot_service/features/my_feature/__init__.py
touch bot_service/features/my_feature/service.py
touch bot_service/features/my_feature/api.py

# 3. Frontend: Create feature module
mkdir -p frontend/src/features/my-feature
touch frontend/src/features/my-feature/MyFeaturePage.tsx
touch frontend/src/features/my-feature/components/MyComponent.tsx

# 4. Implement feature
# 5. Write tests
# 6. Update documentation
# 7. Create pull request
```

### 2. Database Migrations

```bash
cd bot_service

# Create migration
alembic revision --autogenerate -m "Add my_table"

# Review generated migration in alembic/versions/

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

### 3. Testing

```bash
# Backend tests
cd bot_service
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest --cov              # With coverage
pytest tests/test_api/    # Specific directory

# Frontend tests
cd frontend
npm test                  # Run tests
npm run test:coverage     # With coverage
```

### 4. Code Quality

```bash
# Backend linting
cd bot_service
ruff check .              # Check for issues
ruff format .             # Format code

# Frontend linting
cd frontend
npm run lint              # Check for issues
npm run lint:fix          # Auto-fix issues
```

---

## Common Tasks

### Adding a New API Endpoint

```python
# bot_service/api/my_api.py
from fastapi import APIRouter, Depends
from core.database import get_db
from core.permissions import get_current_user

router = APIRouter(prefix="/api/my-feature", tags=["My Feature"])

@router.get("/items")
async def get_items(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Implementation
    return {"items": []}

# Register in main.py
from api.my_api import router as my_router
app.include_router(my_router)
```

### Adding a New React Component

```typescript
// frontend/src/features/my-feature/components/MyComponent.tsx
import React from 'react';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <Button>Click Me</Button>
    </div>
  );
};
```

### Adding a New Database Model

```python
# bot_service/core/database.py
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class MyModel(Base):
    __tablename__ = 'my_table'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)

# Create migration
# alembic revision --autogenerate -m "Add my_table"
# alembic upgrade head
```

---

## Debugging Tips

### Backend Debugging

```python
# Add logging
import logging
logger = logging.getLogger(__name__)

logger.info("Processing request")
logger.error("Error occurred", exc_info=True)

# Use debugger
import pdb; pdb.set_trace()  # Breakpoint

# Check database state
from core.database import SessionLocal
db = SessionLocal()
users = db.query(User).all()
print(users)
```

### Frontend Debugging

```typescript
// Console logging
console.log('Data:', data);
console.error('Error:', error);

// React DevTools
// Install React DevTools browser extension

// Network debugging
// Use browser DevTools Network tab

// State debugging
console.log('Context state:', useContext(MyContext));
```

### Common Issues

**Backend won't start:**
- Check `.env` file exists and is configured
- Verify database connection
- Check port 8000 is not in use
- Review logs for errors

**Frontend won't start:**
- Run `npm install` to ensure dependencies
- Check port 5173 is not in use
- Clear `node_modules` and reinstall if needed
- Check `.env` file

**Database errors:**
- Run `alembic upgrade head` to apply migrations
- Verify PostgreSQL connection settings and credentials
- Verify PostgreSQL connection (production)

**CORS errors:**
- Verify backend CORS configuration in `main.py`
- Check frontend API URL in `.env`
- Ensure backend is running

---

## Protected Systems

**CRITICAL:** Read [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) before modifying:

1. **TTS System** - Platform settings, synchronization, filters
2. **Category System** - Stream category mapping
3. **WebSocket System** - Leader Election implementation
4. **Performance Optimizations** - Code splitting, virtualization
5. **Error Handling** - Error boundaries, retry logic
6. **Drops System** - Server-side calculation logic
7. **Configuration System** - `core/config.py`, `.env.example`

---

## Best Practices

### Code Style

**Python:**
- Follow PEP 8
- Use type hints
- Document functions with docstrings
- Keep functions small and focused

**TypeScript/JavaScript:**
- Use TypeScript for new files
- Follow React best practices
- Use functional components with hooks
- Keep components small and reusable

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make commits with clear messages
git commit -m "feat: add user management API"
git commit -m "fix: resolve CORS issue"
git commit -m "docs: update API documentation"

# Push and create PR
git push origin feature/my-feature
```

### Documentation

- Update relevant docs when changing features
- Add code comments for complex logic
- Update API documentation
- Keep CURRENT_STATUS.md up to date

---

## Resources

### Documentation
- **[Architecture Guide](../architecture/ARCHITECTURE_GUIDE.md)** - System design
- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Patterns and conventions
- **[Current Status](../CURRENT_STATUS.md)** - Implementation status
- **[API Documentation](http://localhost:8000/docs)** - Interactive API docs

### External Resources
- **[FastAPI Docs](https://fastapi.tiangolo.com/)** - Backend framework
- **[React Docs](https://react.dev/)** - Frontend framework
- **[SQLAlchemy Docs](https://docs.sqlalchemy.org/)** - ORM
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling

### Community
- Check project README for contact information
- Review existing issues and PRs
- Follow coding standards in existing code

---

## Next Steps

1. **Complete setup** - Follow Quick Setup section
2. **Explore codebase** - Browse key files and directories
3. **Read architecture docs** - Understand system design
4. **Pick a task** - Start with small bug fixes or features
5. **Ask questions** - Don't hesitate to ask for help

---

**Welcome aboard!** Happy coding! 🚀

**Last Updated:** November 17, 2025
