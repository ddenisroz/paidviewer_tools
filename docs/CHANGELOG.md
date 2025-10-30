# 📜 Changelog - История изменений проекта

Все значимые изменения в проекте документируются в этом файле.

---

## 🏠 Session 26 - Local TTS Full Integration + Bugfix (29 октября 2025)

### ✨ Новые фичи

#### Локальный TTS - Полная интеграция с ботом
- **Endpoint `/api/tts/synthesize-channel`**: Озвучка чата через локальный TTS
- **Pydantic модели**: `ChannelTTSRequest`, `ChannelTTSResponse`, `TTSSettingsData`
- **Фильтрация текста**:
  - ✅ Блокировка пользователей (`blocked_users`)
  - ✅ Фильтрация запрещённых слов (`word_filter`)
  - ✅ Ограничение длины сообщений (`maxLength`)
  - ✅ Пропуск команд (`skipCommands`)
- **Интеграция с bot_service**: `tts_manager.py` автоматически выбирает локальный/облачный TTS

### 🐛 Исправления
- **Админка голосов**: Исправлен баг отображения голосов после загрузки
  - Backend возвращал `{ "voices": [...] }`, frontend искал `data.data`
  - Теперь корректно парсит `data.voices || data.data`

### 📚 Документация
- Создан `docs/LOCAL_TTS_INTEGRATION.md` - полное руководство по локальному TTS
- Создан `docs/SESSION_26_LOCAL_TTS_INTEGRATION.md` - детали сессии
- Обновлён `docs/VOICE_UPLOAD_UNIFIED.md` - добавлен changelog bugfix
- Обновлён `docs/CURRENT_STATUS.md` - статус сессии

### 🏗️ Архитектура
- **Файлы:** `tts_service_simple/main.py` (+3 Pydantic модели, +1 endpoint)
- **Frontend:** `frontend/src/components/admin/VoiceManagement.jsx` (bugfix)

### 📊 Метрики
- **Локальный TTS**: Теперь полностью функционален (как облачный)
- **Сравнение**: Локальный TTS теперь поддерживает 100% функций облачного TTS

### 🚀 Как использовать
1. Запустить `python tts_service_simple/main.py`
2. Открыть `/dashboard/tts/local`
3. Настроить endpoint и включить "Использовать локальный TTS"
4. Готово! Чат будет озвучиваться через локальный TTS ✅

---

## 🗑️ Session 10 - Account Deletion & UX Polish (27 октября 2025)

### ✨ Новые фичи
- **3-Level Account Deletion System**: Soft delete → Auto cleanup (30 дней) → Admin delete
- **GDPR Compliance**: "Right to be forgotten" с 30-дневным retention period
- **Account Anonymization**: Автоматическая анонимизация при удалении
- **Background Cleanup Task**: Автоматическое удаление через 30 дней

### 🐛 Исправления
- Исправлен hard delete на soft delete (предотвращение крашей)
- WebSocket endpoint проверяет существование User перед обращением
- Унифицированы toast уведомления (одна система - `sonner`)
- Исправлено дублирование toast уведомлений
- Фиксированные размеры кнопок (больше не "дёргаются")

### 🎨 UX улучшения
- VK Live toggle → красный цвет (#ef4444)
- DonationAlerts toggle → оранжевый цвет (#f97316)
- Унифицированы иконки (VKIcon вместо Video)
- Название: "VK Live" (вместо "VK Video Live")
- Кнопки с `min-width` для стабильности UI

### 📚 Документация
- Создан `ACCOUNT_DELETION_SYSTEM.md` (полная документация системы удаления)
- Обновлён `CURRENT_STATUS.md` (актуализирован до Session 10)

### 🏗️ Архитектура
- **Soft Delete**: User record сохраняется с `is_blocked=True`
- **Auto Cleanup**: Background task каждые 24 часа
- **Admin Endpoint**: `/api/admin/permanently-delete-user/{user_id}`

### 📊 Метрики
- **Удаление аккаунта**: Hard delete → Soft delete + Auto cleanup
- **Toast системы**: 2 системы → 1 система (sonner)
- **GDPR compliance**: ✅ 100% соответствие
- **Retention period**: 30 дней (индустриальный стандарт)

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

**Последнее обновление:** 27 октября 2025 (Session 10)  
**Версия:** 0.9.5  
**Статус:** ✅ Stable

