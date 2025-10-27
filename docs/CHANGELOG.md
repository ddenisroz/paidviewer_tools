# 📜 Changelog - История изменений проекта

Все значимые изменения в проекте документируются в этом файле.

---

## 🚀 Session 9 - WebSocket оптимизация (27 октября 2025)

### ✨ Новые фичи
- **Singleton Pattern для SharedWebSocket**: Теперь только 1 WebSocket на весь браузер (было 3+)
- **Dead Code Removal**: Удалён неиспользуемый `TtsCardProvider`
- **Context Hell Fix**: Оптимизирована структура React Context (12 → 10 providers)

### 🐛 Исправления
- Исправлено множественное создание WebSocket подключений
- Добавлена очистка WebSocket при logout

### 📚 Документация
- Создан `SHARED_WEBSOCKET.md` с секцией Singleton Pattern
- Создан `CODE_REVIEW_SENIOR_ENGINEER.md` (Senior-level code review)
- Создан `MEMORY_LEAKS_AUDIT.md` (Memory leaks audit - EXCELLENT status)
- Создан `API_CLIENT_MIGRATION.md` (Unified API client guide)

### 🏗️ Архитектура
- **ErrorBoundary**: Добавлен глобальный Error Boundary компонент
- **StandardResponse**: Унифицированный формат API ответов (backend)
- **ApiClient**: Единый Axios-based API client с retry logic

### 📊 Метрики
- **Context providers**: 12 → 10 (-16%)
- **WebSocket connections**: 3+ → 1 (-66%+)
- **Dead code removed**: ~50 строк

---

## 🔐 Session 8 - OAuth и Token фиксы (26 октября 2025)

### 🐛 Исправления
- **OAuth редиректы**: Исправлены циклические редиректы при авторизации
- **Token refresh**: Автоматическое обновление токенов Twitch и VK
- **Session cleanup**: Корректная очистка сессий при logout

### 🔧 Улучшения
- Добавлена валидация токенов перед использованием
- Улучшена обработка ошибок OAuth
- Оптимизирован flow авторизации

---

## ✨ Session 7 - TokenManager и UX (24-25 октября 2025)

### ✨ Новые фичи
- **TokenManager**: Унифицированная система управления токенами
- **Auto Token Refresh**: Автоматическое обновление токенов в фоне
- **Improved UX**: Улучшен пользовательский интерфейс авторизации

### 🏗️ Архитектура
- Создан `bot_service/core/token_manager.py` (централизованное управление токенами)
- Рефакторинг OAuth flow для всех платформ
- Добавлена поддержка `refresh_token` для VK Live

### 📚 Документация
- Создан `TOKEN_SYSTEM_UNIFIED.md` (полная документация TokenManager)
- Обновлён `SECURITY_LOGIC.md` (логика безопасности)

### 🐛 Исправления
- Исправлены баги с истечением токенов
- Корректная обработка `linked_platforms`
- Улучшена валидация токенов

---

## 🎮 Ключевые фичи проекта (текущее состояние)

### ✅ Работает
- **Multi-platform**: Twitch + VK Live + DonationAlerts
- **TTS**: gTTS (облако) + F5-TTS (локально, GPU/CPU)
- **ChatBox**: Overlay для OBS с анимациями
- **Commands**: Унифицированная система команд (global, override, custom)
- **Category Mapping**: Кросс-платформенная смена категорий (`!game`, `!title`)
- **Guest Mode**: Работа без авторизации
- **Caching**: Multi-tab синхронизация через `localStorage` + WebSocket
- **Shared WebSocket**: Leader Election для 1 подключения на все вкладки

### 🚧 В разработке
- Миграция на TypeScript (рекомендуется JSDoc вместо полной миграции)
- Полная миграция на `ApiClient` (частично)

### ❌ Известные ограничения
- YouTube API требует API key (не реализовано)
- F5-TTS требует GPU для нормальной скорости (CPU ~30 сек на сообщение)

---

## 📦 Технический стек

### Backend
- **FastAPI** (Python 3.11+)
- **SQLAlchemy** (ORM)
- **Alembic** (миграции)
- **WebSocket** (real-time)
- **TwitchIO**, **vk-api** (боты)

### Frontend
- **React 18** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **React Router** (routing)
- **Axios** (HTTP)
- **WebSocket** (real-time)

### TTS
- **gTTS** (облачный, бесплатный)
- **F5-TTS** (локальный, GPU/CPU)
- **pydub** (аудио конвертация)

---

## 🎯 Roadmap

### Ближайшие планы
- [ ] Полная миграция на `ApiClient`
- [ ] JSDoc для критических функций
- [ ] PropTypes для сложных компонентов
- [ ] Оптимизация Context providers (PlayerProvider, DonationAlertsProvider)

### Долгосрочные планы
- [ ] TypeScript (опционально, через 6+ месяцев)
- [ ] Unit tests (backend)
- [ ] E2E tests (frontend)
- [ ] CI/CD pipeline

---

**Последнее обновление:** 27 октября 2025 (Session 9)  
**Версия:** 0.9.0  
**Статус:** ✅ Stable

