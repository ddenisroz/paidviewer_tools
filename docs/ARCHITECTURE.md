# TTS_TTV Architecture Documentation

**Версия:** 1.0  
**Дата:** 2026-01-06

---

## Обзор системы

TTS_TTV — многоплатформенный сервис для стримеров, предоставляющий:
- Text-to-Speech (TTS) озвучку сообщений чата
- Систему баллов и наград
- Интеграцию с Twitch и VK Live
- YouTube видео очередь
- Систему Drops (геймификация)

---

## Архитектурные принципы

### Clean Architecture

Проект следует принципам Clean Architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│              (API endpoints, WebSocket)                  │
├─────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│                     (Services)                           │
├─────────────────────────────────────────────────────────┤
│                     Domain Layer                         │
│                (Business logic, Models)                  │
├─────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                    │
│          (Repositories, Integrations, DB)                │
└─────────────────────────────────────────────────────────┘
```

### Ключевые правила

1. **Нет логики в контроллерах** — API endpoints только маршрутизируют запросы
2. **Нет SQL в сервисах** — весь доступ к БД через репозитории
3. **Нет сетевых вызовов в UI** — фронтенд работает через API слой
4. **Изоляция зависимостей** — бизнес-логика не зависит от фреймворков

---

## Структура Backend

```
bot_service/
├── api/                    # API Layer (FastAPI routers)
│   ├── endpoints/          # HTTP endpoints
│   └── websocket/          # WebSocket handlers
│
├── services/               # Application Layer
│   ├── tts/               # TTS бизнес-логика
│   ├── points/            # Система баллов
│   └── ...
│
├── repositories/           # Data Access Layer
│   ├── base_repository.py
│   └── [domain]_repository.py
│
├── integrations/           # External Services
│   ├── twitch/            # Twitch API, OAuth, EventSub
│   ├── vk/                # VK Live API
│   └── tts/               # TTS engines (Google, F5)
│
├── models/                 # Domain Models
│   ├── database/          # SQLAlchemy models
│   └── schemas/           # Pydantic schemas
│
├── core/                   # Configuration & Utilities
│   ├── config.py
│   ├── database.py
│   └── dependencies.py
│
└── workers/                # Async Task Queue
    └── celery_tasks.py
```

---

## Структура Frontend

```
frontend/src/
├── features/               # Feature Modules
│   ├── tts/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types/
│   ├── chat/
│   ├── drops/
│   └── admin/
│
├── shared/                 # Shared Components
│   ├── components/
│   ├── hooks/
│   └── utils/
│
├── stores/                 # Zustand State Management
│   ├── useAuthStore.ts
│   ├── useTtsStore.ts
│   └── ...
│
├── services/               # API Layer
│   └── api/
│       ├── client.ts      # Axios instance
│       └── services/      # Domain-specific API
│
├── queries/                # TanStack Query
│   └── [domain]/          # React Query hooks
│
└── types/                  # Global TypeScript types
```

---

## Технологический стек

### Backend
- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.0
- **Migrations:** Alembic
- **Validation:** Pydantic
- **Task Queue:** Celery + Redis
- **Database:** PostgreSQL

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **State:** Zustand + TanStack Query
- **Styling:** TailwindCSS
- **UI:** shadcn/ui

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Nginx
- **Monitoring:** Sentry

---

## Паттерны и решения

### Repository Pattern

Все запросы к БД идут через репозитории:

```python
class PointsRepository:
    def get_user_points(self, user_id: int) -> int:
        ...
    
    def add_points(self, user_id: int, amount: int) -> None:
        ...
```

### Service Layer

Бизнес-логика инкапсулирована в сервисы:

```python
class PointsService:
    def __init__(self, repository: PointsRepository):
        self.repository = repository
    
    def award_points(self, user_id: int, amount: int) -> None:
        # Business rules here
        self.repository.add_points(user_id, amount)
```

### Feature-based Frontend

Каждая фича изолирована и самодостаточна:

```
features/tts/
├── components/      # UI компоненты фичи
├── pages/           # Страницы фичи
├── hooks/           # React hooks фичи
├── types/           # TypeScript типы
└── index.ts         # Public API фичи
```

---

## Дополнительные документы

- [Руководство по развёртыванию](./setup/)
- [API документация](./api/)
- [История изменений](./CHANGELOG.md)
- [Руководства](./guides/)
