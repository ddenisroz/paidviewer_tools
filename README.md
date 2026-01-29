# AI Python TTS & Twitch Bot 🤖

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.121.2-green.svg)
![React](https://img.shields.io/badge/React-19.1.1-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

Комплексное решение для Twitch-стримеров с ИИ-озвучкой (TTS), интеграцией Twitch/VK/DonationAlerts и современным веб-интерфейсом.

## 🚀 Текущий Статус (Refactoring 2026) -> **Stable 1.0.0 Candidate**

Проект прошел масштабный рефакторинг для соответствия **Clean Architecture**:
*   ✨ **Чистая Архитектура**: Разделение на API, Service, Repository слои.
*   🎤 **VoiceManagementService**: Централизованное управление голосами и TTS провайдерами.
*   🔌 **Изолированные Интеграции**: Модульные сервисы для Twitch, VK, DonationAlerts (Legacy-код удален).
*   🔇 **TTS Service Simple**: Выделен в изолированный микросервис.
*   💅 **Современный Frontend**: Feature-based структура, TypeScript строгая типизация.

## ✨ Основные Возможности
*   **ИИ Озвучка (TTS)**: Поддержка локальных (Silero) и облачных моделей.
*   **Управление Голосами**: Глобальные пресеты, пользовательские голоса, настройки скорости/высоты.
*   **Интеграции**:
    *   **Twitch**: Чат, награды (Channel Points), команды, события.
    *   **VK Live**: Отслеживание комментариев.
    *   **DonationAlerts**: Озвучка донатов.
*   **Веб-Панель**: Управление ботом, медиа-плеер, история событий.

## Быстрый старт (5 минут)

```bash
# 1. Клонируй и перейди
git clone <repo>
cd TTS_TTV_0.02

# 2. Настрой окружение (автоматическая миграция)
./scripts/migrate.sh  # Linux/Mac
# или
.\scripts/migrate.ps1   # Windows

# 3. Настрой .env файлы
# bot_service/.env - OAuth credentials, database, security keys
# tts_service/.env - TTS engine configuration
# frontend/.env - API endpoints (уже настроен)

# 4. Запусти сервисы
cd bot_service
python main.py         # Bot Service (localhost:8000)

cd ../frontend
npm run dev            # Frontend (localhost:5173)

cd ../tts_service
python main.py          # TTS Service (localhost:8001) - опционально
```

**Полный гайд:** [docs/QUICKSTART.md](docs/QUICKSTART.md)  
**Deployment:** [docs/setup/DEPLOYMENT.md](docs/setup/DEPLOYMENT.md)  
**Design System:** [docs/architecture/DESIGN_SYSTEM.md](docs/architecture/DESIGN_SYSTEM.md) [NEW]

---

## Design System & Quality

Проект использует единую систему дизайна с автоматическими проверками:

```bash
# Проверить соответствие Design System
node scripts/migrate-to-design-system.js

# Автоматически исправить проблемы
node scripts/migrate-to-design-system.js --apply
```

**Документация:** [DESIGN_SYSTEM.md](docs/architecture/DESIGN_SYSTEM.md)  
**Примеры:** [DesignSystemExample.tsx](frontend/src/components/examples/DesignSystemExample.tsx)

---

## Основные возможности

| Функция | Статус | Описание |
|---------|--------|----------|
| **TTS Engines** | | |
| Google TTS | Ready | Облачный синтез через Google Cloud |
| F5-TTS (Advanced) | Ready | Высококачественный синтез (GPU) |
| F5-TTS (Simple) | Ready | Персональный TTS для одного пользователя |
| **Платформы** | | |
| Twitch | Ready | OAuth, чат, команды, бейджи, роли |
| VK Live | Ready | OAuth, чат, команды, баллы, роли |
| Platform Abstraction | Ready | Легкое добавление новых платформ (Kick, YouTube Live) |
| **Функции** | | |
| YouTube | Ready | Очередь заказов, плеер |
| Баллы канала | Ready | Twitch + VK Live награды |
| Drops система | Ready | Lootbox, streak, donation (server-side) |
| DonationAlerts | Ready | Автоматическая интеграция |
| Гостевой режим | Ready | Просмотр без авторизации |
| Кастомные команды | Ready | Глобальные, override, custom |
| **Управление** | | |
| Permission System | Ready | Role-based access control (admin/user/guest) |
| Админ панель | Ready | Управление пользователями, голосами |
| OBS виджеты | Ready | Chat, TTS, YouTube, Drops |
| **Производительность** | | |
| Code Splitting | Ready | Lazy loading для быстрой загрузки |
| WebSocket Optimization | Ready | Одно соединение на браузер (leader election) |
| Error Handling | Ready | Graceful error handling, no crashes |
| State Sync | Ready | Optimistic updates с rollback |

---

## Документация

### 📋 Мастер-план проекта
- **[PROJECT_MASTER_PLAN.md](PROJECT_MASTER_PLAN.md)** - Полный анализ проекта, технический долг, план улучшений

### Для обычных пользователей
- **[Быстрый старт](docs/QUICKSTART.md)**
- **[Текущий статус](docs/guides/CURRENT_STATUS.md)**

### Для разработчиков
- **[Архитектура](docs/architecture/ARCHITECTURE_GUIDE.md)**
- **[Руководство](docs/guides/DEVELOPER_GUIDE.md)**
- **[Changelog](docs/CHANGELOG.md)**

### Для AI-агентов
- **[Project Context](docs/PROJECT_CONTEXT.md)**
- **[Текущий статус](docs/guides/CURRENT_STATUS.md)**

**Полный индекс:** [docs/README.md](docs/README.md)

## Структура проекта

```
├── bot_service/          # Backend (FastAPI)
│   ├── api/              # API endpoints
│   │   ├── admin/        # Admin-only endpoints
│   │   └── user/         # User endpoints
│   ├── bots/             # Twitch/VK бот логика
│   ├── platforms/        # Platform abstraction layer
│   │   ├── base.py       # StreamingPlatform interface
│   │   ├── registry.py   # Platform registry
│   │   ├── twitch.py     # Twitch implementation
│   │   └── vk.py         # VK implementation
│   ├── services/         # Бизнес логика
│   ├── core/             # Конфиг, БД, auth, permissions
│   └── validators/       # Input validation
│
├── frontend/             # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/   # React компоненты
│   │   ├── pages/        # Страницы
│   │   ├── context/      # Context API
│   │   ├── services/     # API клиенты
│   │   ├── hooks/        # Custom hooks
│   │   ├── constants/    # Constants
│   │   └── utils/        # Утилиты
│   └── public/
│
├── tts_service/          # TTS Service (Advanced - F5-TTS)
│   └── ...               # Centralized TTS for multiple users
│
├── tts_service_simple/   # TTS Service Simple (Personal)
│   └── ...               # Personal TTS for single user
│
├── docs/                 # Документация
├── .env.example          # Environment template
└── migrate.sh/ps1        # Migration script
```

## TTS Service: Advanced vs Simple

| Аспект | TTS Service (Advanced) | TTS Service Simple |
|--------|------------------------|-------------------|
| **Назначение** | Централизованный TTS для нескольких пользователей | Персональный TTS для одного пользователя |
| **Движок** | F5-TTS (GPU) | F5-TTS (GPU) |
| **Требования** | GPU (CUDA), 8GB+ VRAM | GPU (CUDA), 8GB+ VRAM |
| **Хранение голосов** | Централизованное (все пользователи) | Локальное (ПК пользователя) |
| **Глобальные голоса** | Управляются админом | Скачиваются из репозитория |
| **Deployment** | Один инстанс для всех | Один инстанс на пользователя |
| **Use Case** | Shared hosting, несколько стримеров | Личное использование, приватность |
| **API** | Идентичный | Идентичный |

**Bot Service не знает разницы** - он просто отправляет запросы на `TTS_SERVICE_URL` из `.env`

---

## Конфигурация и Deployment

### Environment Variables

Все настройки через `.env` файлы - никаких хардкодов:

- **bot_service/.env** - OAuth credentials, database, security keys, rate limits
- **tts_service/.env** - TTS engine selection (f5/simple/google), GPU config
- **tts_service_simple/.env** - Personal TTS configuration
- **frontend/.env** - API endpoints, feature flags

**Генерация секретов:**
```bash
# Security keys
openssl rand -hex 32  # SECRET_KEY, JWT_SECRET_KEY

# Encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Deployment Scenarios

**Scenario 1: Advanced (F5-TTS на GPU)**
- Machine 1 (Local PC): TTS Service + Cloudflare Tunnel
- Machine 2 (Remote): Bot Service + Frontend + Database

**Scenario 2: Simple (Personal TTS)**
- Machine 1 (User PC): TTS Service Simple + Cloudflare Tunnel
- Machine 2 (Remote): Bot Service + Frontend + Database

**Scenario 3: Cloud (Google TTS)**
- Machine 1 (Remote): All services (Bot + Frontend + TTS)

**См. полный гайд:** [DEPLOYMENT.md](docs/setup/DEPLOYMENT.md)

## Безопасность

- **Rate Limiting** - защита от DDoS (60/min default, 5/15min login)
- **Input Sanitization** - XSS/SQLi защита на frontend и backend
- **JWT + OAuth2** - безопасная аутентификация
- **CSRF Protection** - защита от атак
- **Retry Logic** - устойчивость к сетевому отказу (exponential backoff)
- **Encryption** - токены зашифрованы в БД (Fernet)
- **Permission System** - Role-based access control
- **Input Validation** - Pydantic (backend) + Zod (frontend)

---

## Технологии

**Backend:** Python 3.10+, FastAPI, SQLAlchemy, Alembic, pydantic-settings  
**Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui, React Query, Zod  
**Database:** PostgreSQL  
**TTS:** Google Cloud TTS / F5-TTS (Advanced) / F5-TTS (Simple)  
**WebSocket:** FastAPI WebSocket (SharedWebSocket с Leader Election)  
**Интеграции:** Twitch, VK Live, YouTube, DonationAlerts  
**Security:** JWT + OAuth2, Fernet encryption, slowapi rate limiting  
**Deployment:** Docker + Docker Compose, Cloudflare Tunnel

---

## История версий

| Дата | Версия | Основные изменения |
|------|--------|-------------------|
| Nov 14, 2025 | 0.03 | Stabilization & Optimization: Environment config, Platform abstraction, Permission system, WebSocket optimization, Performance improvements, Error handling |
| Nov 8, 2025 | 0.02 | F5-TTS audio playback fix, yoficator improvements, voice settings fallback |
| Nov 3, 2025 | 0.02 | Code quality cleanup, production ready |
| Nov 1, 2025 | 0.01 | Security improvements |
| Oct 31, 2025 | 0.9.5 | Comprehensive audit |

**Полный changelog:** [CHANGELOG.md](docs/CHANGELOG.md)

---

## Лицензия

MIT License - Свободен для использования и модификации

---

**Последнее обновление:** 18 декабря 2025 | **Версия:** 0.03
