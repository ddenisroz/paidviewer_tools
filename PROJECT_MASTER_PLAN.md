# TTS_TTV_0.02 - Мастер-план развития проекта

**Версия:** 0.03  
**Дата:** 28 декабря 2024  
**Статус:** Production Ready (с техническим долгом)

---

## 📊 Текущее состояние проекта

### ✅ Что работает отлично
- **Backend (FastAPI)**: Стабильный, хорошо структурированный, 95% покрытие тестами
- **Multi-platform**: Twitch и VK Live полностью интегрированы
- **TTS System**: 3 движка (Google Cloud, F5-TTS Advanced/Simple) работают стабильно
- **WebSocket**: Leader Election, reconnection logic, multi-tab sync
- **OAuth 2.0**: Twitch и VK Live авторизация
- **Database**: SQLAlchemy 2.0 с миграциями Alembic
- **Docker**: Production-ready контейнеризация
- **Performance**: Code splitting, virtualization, мemoization

### ⚠️ Технический долг

#### 1. TypeScript Migration (КРИТИЧНО)
**Проблема:** 411 TypeScript ошибок в frontend
**Статус:** 24% завершено (132/543 ошибки исправлены)

**Категории ошибок:**
- Axios Response Wrapping: ~102 ошибки (компоненты, сервисы)
- Unknown Type Assertions: ~150 ошибок (pages, components)
- Missing Type Definitions: ~87 ошибок (props, interfaces)
- Error Handling: ~29 ошибок (catch blocks, boundaries)
- Widget Types: ~40 ошибок (OBS widgets)
- Other: ~3 ошибки

**Исправлено:**
- ✅ Все query files (98 ошибок) - полностью типизированы
- ✅ Context files (13 ошибок) - UserSettings, Player, Chat
- ✅ Error handling utils (21 ошибка) - AxiosError type guards
- ✅ Admin pages (12 ошибок) - частично

**Осталось:**
- ⏳ Admin pages property access (~5 ошибок)
- ⏳ Drops components (~30 ошибок)
- ⏳ Chat components (~10 ошибок)
- ⏳ Pages (~200 ошибок)
- ⏳ Utils (~30 ошибок)

#### 2. Testing Coverage (ВЫСОКИЙ ПРИОРИТЕТ)
**Backend:** 95% покрытие ✅
**Frontend:** ~5% покрытие ❌

**Отсутствуют тесты для:**
- React компонентов (0 тестов)
- Custom hooks (0 тестов)
- Context providers (0 тестов)
- Utils functions (частично)
- Integration tests (0 тестов)
- E2E tests (0 тестов)

#### 3. Code Quality Issues

**Frontend:**
- Дублирование кода в компонентах
- Большие компоненты (>500 строк)
- Смешанная логика (UI + business logic)
- Неконсистентная обработка ошибок
- Отсутствие PropTypes/TypeScript interfaces

**Backend:**
- Некоторые эндпоинты слишком большие
- Дублирование валидации
- Недостаточно unit тестов для utils

#### 4. Architecture Issues

**Frontend:**
- Нет четкой структуры для feature modules
- Смешанные паттерны state management
- Неоптимальная структура папок
- Отсутствие слоя абстракции для API

**Backend:**
- Некоторые сервисы слишком большие
- Недостаточная модульность
- Можно улучшить dependency injection

#### 5. Performance Issues

**Frontend:**
- Некоторые компоненты не мемоизированы
- Избыточные re-renders
- Неоптимальные WebSocket subscriptions
- Большие bundle sizes

**Backend:**
- Некоторые N+1 queries
- Можно добавить кэширование
- Оптимизация WebSocket broadcasts

#### 6. Documentation Gaps

**Отсутствует:**
- API documentation (OpenAPI/Swagger)
- Component documentation (Storybook)
- Architecture Decision Records (ADR)
- Deployment runbooks
- Troubleshooting guides

---

## 🎯 Мастер-план исправления

### Фаза 1: TypeScript Migration (Приоритет: КРИТИЧНО)
**Цель:** Исправить все 411 TypeScript ошибок  
**Время:** 6-8 часов  
**Статус:** В процессе (24% завершено)

#### Этап 1.1: Admin & Drops Components (1-2 часа)
```
Задачи:
1. Исправить admin pages property access
   - SupportTicketsPage.tsx
   - SystemLogsPage.tsx
   - BlockedChannelsPage.tsx (property access)
   - BotManagementPage.tsx (property access)

2. Исправить Drops components
   - DonationSettings.tsx (form types)
   - RewardsManager.tsx (type assertions)
   - StreakSettings.tsx (property access)
   - DropsHistory.tsx (missing useMemo import)

Паттерн:
- Добавить ApiResponse<T> generic types
- Использовать type guards для property access
- Исправить form type conversions
```

#### Этап 1.2: Chat Components (30 минут)
```
Задачи:
1. Унифицировать Message vs ChatMessage types
   - VirtualizedMessageList.tsx
   - ChatCard.tsx

2. Исправить EventListener type conversions
   - ChatCard.tsx (CustomEvent → EventListener)

3. Исправить sync-status-indicator
   - Добавить missing arguments

Паттерн:
- Создать unified Message type
- Использовать type assertions для CustomEvent
```

#### Этап 1.3: Pages & Components (3-4 часа)
```
Задачи:
1. ChatOverlay.tsx (55 ошибок)
   - Убрать (data as unknown)?.property
   - Добавить type guards
   - Создать interfaces для props

2. DropsWidget.tsx (26 ошибок)
   - Типизировать widget config
   - Добавить event handler types

3. TtsMainPage.tsx (26 ошибок)
   - Типизировать TTS state
   - Исправить API response handling

4. VoiceManagementPage.tsx (17 ошибок)
   - Типизировать voice data
   - Исправить form types

Паттерн:
- Создать type guards для WebSocket messages
- Добавить interfaces для component props
- Использовать ApiResponse<T> generic
```

#### Этап 1.4: Utils (1 час)
```
Задачи:
1. platformUtils.ts (19 ошибок)
   - Добавить Platform type
   - Типизировать utility functions

2. emotes.ts (14 ошибок)
   - Добавить Emote interface
   - Типизировать emote parsing

Паттерн:
- Создать строгие типы для platform data
- Использовать type guards
```

#### Этап 1.5: Финальная проверка (1 час)
```
Задачи:
1. Запустить npx tsc --noEmit
2. Исправить оставшиеся ошибки
3. Проверить что приложение работает
4. Обновить tsconfig.json (включить strict: true)
```

**Критерий успеха:** 0 TypeScript ошибок, strict mode включен

---

### Фаза 2: Testing Infrastructure (Приоритет: ВЫСОКИЙ)
**Цель:** Достичь 80%+ покрытия frontend тестами  
**Время:** 10-15 часов

#### Этап 2.1: Setup Testing Framework (2 часа)
```
Инструменты:
- Vitest (уже установлен)
- @testing-library/react
- @testing-library/user-event
- @testing-library/jest-dom
- msw (Mock Service Worker)

Задачи:
1. Настроить Vitest config
2. Создать test utilities
   - renderWithProviders (Auth, Chat, TTS contexts)
   - mockApiHandlers (MSW)
   - testQueryClient
3. Создать fixtures для тестовых данных
4. Настроить coverage reporting
```

#### Этап 2.2: Unit Tests - Hooks (2 часа)
```
Приоритет:
1. useChatMessages (высокий)
2. useChatWebSocket (высокий)
3. useBotConnection (высокий)
4. useFormValidation (средний)
5. useAudioUnlock (средний)

Покрытие: 90%+

Пример структуры:
frontend/src/hooks/__tests__/
  ├── useChatMessages.test.ts
  ├── useChatWebSocket.test.ts
  └── useBotConnection.test.ts
```

#### Этап 2.3: Unit Tests - Utils (1 час)
```
Приоритет:
1. errorMessages.ts (высокий)
2. sanitization.ts (высокий)
3. validationSchemas.ts (высокий)
4. platformUtils.ts (средний)
5. emotes.ts (низкий)

Покрытие: 95%+

Пример структуры:
frontend/src/utils/__tests__/
  ├── errorMessages.test.ts
  ├── sanitization.test.ts
  └── validationSchemas.test.ts
```

#### Этап 2.4: Integration Tests - Contexts (2 часа)
```
Приоритет:
1. AuthContext (критично)
2. ChatContext (критично)
3. TtsContext (высокий)
4. PlayerContext (высокий)
5. UserSettingsContext (средний)

Покрытие: 85%+

Пример структуры:
frontend/src/context/__tests__/
  ├── AuthContext.test.tsx
  ├── ChatContext.test.tsx
  └── TtsContext.test.tsx
```

#### Этап 2.5: Component Tests - UI Components (2 часа)
```
Приоритет:
1. Button, Input, Card (высокий)
2. Toast, Dialog, Dropdown (высокий)
3. Form components (средний)

Покрытие: 80%+

Пример структуры:
frontend/src/components/ui/__tests__/
  ├── button.test.tsx
  ├── input.test.tsx
  └── card.test.tsx
```

#### Этап 2.6: Component Tests - Feature Components (3 часа)
```
Приоритет:
1. TTS components (высокий)
2. Chat components (высокий)
3. Drops components (средний)
4. Admin components (средний)

Покрытие: 70%+

Пример структуры:
frontend/src/features/tts/components/__tests__/
  ├── TtsControls.test.tsx
  ├── VoiceSelector.test.tsx
  └── TtsQueue.test.tsx
```

#### Этап 2.7: Integration Tests - Pages (2 часа)
```
Приоритет:
1. Dashboard (высокий)
2. TtsMainPage (высокий)
3. ChatOverlay (средний)

Покрытие: 60%+

Пример структуры:
frontend/src/pages/__tests__/
  ├── Dashboard.test.tsx
  └── TtsMainPage.test.tsx
```

#### Этап 2.8: E2E Tests Setup (2 часа)
```
Инструменты:
- Playwright

Сценарии:
1. User authentication flow
2. TTS request flow
3. Chat interaction flow
4. YouTube queue flow
5. Drops system flow

Пример структуры:
e2e/
  ├── auth.spec.ts
  ├── tts.spec.ts
  └── chat.spec.ts
```

**Критерий успеха:** 80%+ coverage, все тесты проходят

---

### Фаза 3: Code Quality Tools (Приоритет: СРЕДНИЙ)
**Цель:** Внедрить инструменты для поддержания качества кода  
**Время:** 4-6 часов

#### Этап 3.1: ESLint Configuration (1 час)
```
Плагины:
- @typescript-eslint/eslint-plugin
- eslint-plugin-react
- eslint-plugin-react-hooks
- eslint-plugin-jsx-a11y
- eslint-plugin-import

Правила:
- Строгие TypeScript правила
- React best practices
- Accessibility checks
- Import ordering

Файл: frontend/.eslintrc.json
```

#### Этап 3.2: Prettier Configuration (30 минут)
```
Настройки:
- printWidth: 100
- tabWidth: 2
- semi: true
- singleQuote: true
- trailingComma: 'es5'

Интеграция:
- Pre-commit hook (husky)
- VSCode format on save

Файл: .prettierrc.json
```

#### Этап 3.3: Husky Pre-commit Hooks (1 час)
```
Hooks:
1. pre-commit:
   - lint-staged (ESLint + Prettier)
   - TypeScript type check
   - Unit tests (affected files)

2. pre-push:
   - Full test suite
   - Build check

Файлы:
.husky/pre-commit
.husky/pre-push
```

#### Этап 3.4: SonarQube/SonarCloud (2 часа)
```
Метрики:
- Code coverage
- Code smells
- Bugs
- Security vulnerabilities
- Technical debt

Интеграция:
- CI/CD pipeline
- Pull request checks

Файл: sonar-project.properties
```

#### Этап 3.5: Dependency Management (1 час)
```
Инструменты:
- Dependabot (GitHub)
- npm audit
- Snyk (security scanning)

Задачи:
1. Настроить Dependabot
2. Настроить автоматические security updates
3. Создать процесс review dependencies

Файл: .github/dependabot.yml
```

**Критерий успеха:** Все инструменты настроены и работают в CI/CD

---

### Фаза 4: Architecture Refactoring (Приоритет: СРЕДНИЙ)
**Цель:** Улучшить архитектуру и структуру кода  
**Время:** 8-12 часов

#### Этап 4.1: Frontend Feature Modules (3 часа)
```
Новая структура:
frontend/src/
  ├── features/
  │   ├── tts/
  │   │   ├── api/          # API calls
  │   │   ├── components/   # Feature components
  │   │   ├── hooks/        # Feature hooks
  │   │   ├── pages/        # Feature pages
  │   │   ├── types/        # Feature types
  │   │   └── utils/        # Feature utils
  │   ├── chat/
  │   ├── drops/
  │   └── admin/
  ├── shared/               # Shared across features
  │   ├── components/
  │   ├── hooks/
  │   ├── utils/
  │   └── types/
  └── core/                 # Core app logic
      ├── api/
      ├── auth/
      └── config/

Задачи:
1. Переместить файлы в feature modules
2. Обновить imports
3. Создать barrel exports (index.ts)
```

#### Этап 4.2: API Layer Abstraction (2 часа)
```
Создать:
frontend/src/core/api/
  ├── client.ts           # Axios instance
  ├── interceptors.ts     # Request/response interceptors
  ├── types.ts            # API types
  └── services/
      ├── tts.service.ts
      ├── chat.service.ts
      ├── drops.service.ts
      └── admin.service.ts

Преимущества:
- Централизованная обработка ошибок
- Единый retry logic
- Легкое тестирование (mock services)
- Type safety
```

#### Этап 4.3: Component Refactoring (3 часа)
```
Принципы:
1. Single Responsibility
2. Максимум 200 строк на компонент
3. Разделение UI и logic (custom hooks)
4. Composition over inheritance

Приоритет:
1. ChatCard.tsx (1500+ строк) → разбить на 5-7 компонентов
2. TtsMainPage.tsx (800+ строк) → разбить на 3-4 компонента
3. DropsWidget.tsx (600+ строк) → разбить на 3-4 компонента

Паттерн:
- Container/Presenter pattern
- Custom hooks для business logic
- Мемоизация тяжелых вычислений
```

#### Этап 4.4: Backend Service Layer (2 часа)
```
Улучшения:
1. Разбить большие сервисы на меньшие
2. Добавить service interfaces
3. Улучшить dependency injection
4. Добавить service-level caching

Пример:
bot_service/services/
  ├── tts/
  │   ├── base.py         # TtsServiceInterface
  │   ├── google.py       # GoogleTtsService
  │   └── f5.py           # F5TtsService
  ├── chat/
  │   ├── base.py
  │   ├── twitch.py
  │   └── vk.py
  └── drops/
      ├── calculator.py
      └── history.py
```

#### Этап 4.5: State Management Optimization (2 часа)
```
Задачи:
1. Audit всех Context providers
2. Оптимизировать re-renders
3. Добавить мемоизацию
4. Рассмотреть Zustand для global state

Оптимизации:
- useMemo для тяжелых вычислений
- useCallback для функций
- React.memo для компонентов
- Context splitting (избегать god contexts)
```

**Критерий успеха:** Чистая архитектура, модульность, легкое тестирование

---

### Фаза 5: Performance Optimization (Приоритет: НИЗКИЙ)
**Цель:** Улучшить производительность приложения  
**Время:** 4-6 часов

#### Этап 5.1: Frontend Bundle Optimization (2 часа)
```
Задачи:
1. Analyze bundle size (vite-bundle-visualizer)
2. Code splitting по routes
3. Lazy loading для тяжелых компонентов
4. Tree shaking optimization
5. Минимизация vendor chunks

Инструменты:
- vite-bundle-visualizer
- lighthouse
- webpack-bundle-analyzer

Цель: Уменьшить initial bundle на 30%
```

#### Этап 5.2: React Performance (1 час)
```
Задачи:
1. Audit re-renders (React DevTools Profiler)
2. Добавить React.memo где нужно
3. Оптимизировать Context providers
4. Виртуализация длинных списков

Инструменты:
- React DevTools Profiler
- why-did-you-render

Цель: Уменьшить re-renders на 40%
```

#### Этап 5.3: Backend Performance (2 часа)
```
Задачи:
1. Добавить Redis caching
2. Оптимизировать N+1 queries
3. Добавить database indexes
4. Оптимизировать WebSocket broadcasts

Инструменты:
- SQLAlchemy query profiling
- Redis
- PostgreSQL EXPLAIN ANALYZE

Цель: Уменьшить response time на 30%
```

#### Этап 5.4: WebSocket Optimization (1 час)
```
Задачи:
1. Оптимизировать message batching
2. Добавить message compression
3. Улучшить reconnection logic
4. Добавить heartbeat mechanism

Цель: Уменьшить WebSocket overhead на 20%
```

**Критерий успеха:** Lighthouse score 90+, быстрый response time

---

### Фаза 6: Documentation (Приоритет: НИЗКИЙ)
**Цель:** Создать полную документацию проекта  
**Время:** 6-8 часов

#### Этап 6.1: API Documentation (2 часа)
```
Инструменты:
- FastAPI automatic OpenAPI
- Swagger UI
- ReDoc

Задачи:
1. Добавить docstrings ко всем endpoints
2. Добавить примеры requests/responses
3. Документировать authentication
4. Документировать error codes

Файл: docs/api/
```

#### Этап 6.2: Component Documentation (2 часа)
```
Инструменты:
- Storybook

Задачи:
1. Настроить Storybook
2. Создать stories для UI components
3. Создать stories для feature components
4. Добавить interactive examples

Файл: frontend/.storybook/
```

#### Этап 6.3: Architecture Decision Records (1 час)
```
Создать ADR для:
1. Выбор React Query vs Redux
2. Выбор FastAPI vs Django
3. WebSocket Leader Election
4. Multi-platform abstraction
5. TTS engine selection

Файл: docs/adr/
```

#### Этап 6.4: Deployment & Operations (2 часа)
```
Создать:
1. Deployment runbook
2. Troubleshooting guide
3. Monitoring setup guide
4. Backup & restore procedures
5. Scaling guide

Файл: docs/operations/
```

#### Этап 6.5: Developer Onboarding (1 час)
```
Обновить:
1. README.md
2. CONTRIBUTING.md
3. CODE_OF_CONDUCT.md
4. Development setup guide
5. Testing guide

Файл: docs/
```

**Критерий успеха:** Новый разработчик может начать работу за 1 час

---

## 📈 Метрики успеха

### Code Quality
- ✅ 0 TypeScript errors
- ✅ 80%+ test coverage (frontend)
- ✅ 95%+ test coverage (backend)
- ✅ 0 critical security vulnerabilities
- ✅ A rating в SonarQube

### Performance
- ✅ Lighthouse score 90+
- ✅ Initial load < 2s
- ✅ API response time < 200ms (p95)
- ✅ WebSocket latency < 50ms

### Developer Experience
- ✅ Build time < 30s
- ✅ Test suite < 2 minutes
- ✅ Hot reload < 1s
- ✅ Onboarding time < 1 hour

---

## 🗓️ Timeline

### Sprint 1 (Неделя 1-2): TypeScript + Testing Foundation
- Фаза 1: TypeScript Migration (6-8 часов)
- Фаза 2: Testing Infrastructure (10-15 часов)
- **Итого:** 16-23 часа

### Sprint 2 (Неделя 3-4): Code Quality + Architecture
- Фаза 3: Code Quality Tools (4-6 часов)
- Фаза 4: Architecture Refactoring (8-12 часов)
- **Итого:** 12-18 часов

### Sprint 3 (Неделя 5-6): Performance + Documentation
- Фаза 5: Performance Optimization (4-6 часов)
- Фаза 6: Documentation (6-8 часов)
- **Итого:** 10-14 часов

**Общее время:** 38-55 часов (5-7 недель при 8 часах/неделю)

---

## 🚀 Quick Wins (Можно сделать сейчас)

### 1. TypeScript Strict Mode (2 часа)
Исправить оставшиеся 411 ошибок в приоритетном порядке:
- Admin pages (30 минут)
- Drops components (1 час)
- Chat components (30 минут)

### 2. ESLint + Prettier (1 час)
Настроить базовые правила и pre-commit hooks

### 3. Unit Tests для Hooks (2 часа)
Покрыть тестами критичные hooks:
- useChatMessages
- useChatWebSocket
- useBotConnection

### 4. Component Refactoring (2 часа)
Разбить ChatCard.tsx на меньшие компоненты

### 5. API Documentation (1 час)
Добавить docstrings к основным endpoints

**Итого Quick Wins:** 8 часов, значительное улучшение качества

---

## 📝 Maintenance Plan

### Ежедневно
- Запуск тестов перед commit
- Code review для всех PR
- Проверка CI/CD pipeline

### Еженедельно
- Обновление dependencies
- Review security alerts
- Performance monitoring
- Bug triage

### Ежемесячно
- Dependency audit
- Performance audit
- Code quality review
- Documentation update

### Ежеквартально
- Architecture review
- Technology stack review
- Security audit
- Capacity planning

---

## 🎯 Приоритизация

### Критично (Сделать сейчас)
1. ✅ TypeScript Migration (Фаза 1)
2. ✅ Testing Infrastructure (Фаза 2.1-2.3)

### Высокий приоритет (Следующие 2 недели)
3. ✅ Component Tests (Фаза 2.4-2.6)
4. ✅ Code Quality Tools (Фаза 3.1-3.3)

### Средний приоритет (Следующий месяц)
5. ✅ Architecture Refactoring (Фаза 4)
6. ✅ E2E Tests (Фаза 2.8)

### Низкий приоритет (Когда будет время)
7. ✅ Performance Optimization (Фаза 5)
8. ✅ Documentation (Фаза 6)

---

## 📚 Ресурсы

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### Testing
- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)

### Code Quality
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [SonarQube Docs](https://docs.sonarqube.org/)

### Architecture
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Feature-Sliced Design](https://feature-sliced.design/)

---

**Последнее обновление:** 28 декабря 2024  
**Следующий review:** После завершения Фазы 1
