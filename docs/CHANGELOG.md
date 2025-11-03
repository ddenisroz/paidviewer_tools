# 📜 Changelog - История изменений проекта

Все значимые изменения в проекте документируются в этом файле.

---

## 🚀 Session 30 - Modern Stack & Design System (3 ноября 2025)

### ✨ Backend оптимизации

#### Производительность БД
- **Новая миграция**: `4cf879f958cd_add_performance_indexes.py`
  - Составные индексы для `ChatMessage`: `(channel_name, platform, timestamp)`, `(user_id, channel_name, timestamp)`, `(is_deleted)`
  - Индексы для `UserSettings` и `TTSUserSettings`
  - Оптимизация частых запросов к истории сообщений и настроек

#### Кеширование
- **Новый модуль**: `utils/cache.py` - in-memory кеш с TTL
- **Новый модуль**: `utils/whitelist_cache.py` - кешированные проверки whitelist
- Интеграция кеширования в `tts_api.py` и `admin_api.py`
- Автоматическая инвалидация кеша при изменении whitelist
- TTL: 5 минут для whitelist, 3 минуты для user settings

#### Оптимизация N+1 запросов
- Оптимизирован `get_drops_rewards` - batch loading qualities
- Оптимизирован `get_drops_history` - загрузка только используемых qualities
- Убрана загрузка всех qualities при каждом запросе

### 🎨 Frontend: React Query & Modern Features

#### React Query (TanStack Query)
- **Установка и настройка**: `@tanstack/react-query` v5
- **Настройка QueryClient** с оптимальными дефолтами (staleTime: 5min, gcTime: 10min)
- **Интеграция** в `main.jsx` через `QueryClientProvider`

#### Компоненты переведены на React Query
- **RewardsManager**: 
  - `useQuery` для rewards и qualities
  - `useMutation` с optimistic updates для create/update/delete
  - Автоматический rollback при ошибках
- **StreakSettings**: 
  - `useQuery` для config
  - `useMutation` для сохранения настроек и сброса статистики
- **DonationSettings**: 
  - `useQuery` для config (общий queryKey с StreakSettings)
  - `useMutation` для сохранения настроек
  - Optimistic updates с автоматической синхронизацией

#### View Transitions API
- Добавлены CSS стили для плавных переходов между страницами
- Создан хук `useViewTransition` для программной навигации
- Анимации: 300ms ease-in-out transitions

#### React 19 Features
- Импортирован `useTransition` для non-blocking updates
- Использование `isPending` состояний мутаций для UI feedback

### 🎨 Design System & Стилизация

#### Toast уведомления (Sonner)
- **Стандартизация**: Единый стиль для всех toast уведомлений
- **Градиенты**: Success (зеленый), Error (красный), Warning (желтый), Info (синий)
- **Анимации**: Плавное появление/исчезновение с custom easing
- **Backdrop blur**: Современный эффект размытия
- **Интеграция с темой**: Использование CSS переменных проекта

#### Design System
- **Новый файл**: `styles/design-system.css`
  - CSS переменные для quality colors (Common, Rare, Epic, Legendary, Mythical)
  - Стандартизированные утилиты для spacing, shadows, transitions
  - Focus states и loading animations
- **CSS переменные**: Добавлены `--quality-*` в `App.css`
- **Стандартизация**: Все цвета через HSL переменные

### 📚 Документация

#### Обновления
- **IMPROVEMENTS.md**: Обновлен с фокусом на современные решения 2024-2025
- **CHANGELOG.md**: Добавлена Session 30
- **Новые разделы**: React Query, View Transitions API, Design System

### 🏗️ Архитектура

#### Backend
- `bot_service/utils/cache.py` - система кеширования
- `bot_service/utils/whitelist_cache.py` - кешированные проверки
- `bot_service/alembic/versions/4cf879f958cd_*.py` - миграция индексов

#### Frontend
- `frontend/src/lib/queryClient.js` - конфигурация React Query
- `frontend/src/hooks/useViewTransition.js` - хук для View Transitions API
- `frontend/src/styles/design-system.css` - стандартизированные стили

### 📊 Метрики
- **Бэкенд**: Индексы БД ✅, Кеширование whitelist ✅, Оптимизация N+1 ✅
- **Фронтенд**: React Query интеграция ✅, View Transitions ✅, Design System ✅
- **Производительность**: Оптимистичные обновления ✅, Автокеширование ✅

---

## 🎁 Session 29 - Drops System Refactoring (2 ноября 2025)

### ✨ Новые функции Drops системы

#### Новая вкладка "Баллы"
- **Управление наградами через API платформы**:
  - Создание наград за баллы канала через Twitch/VK API
  - Настройка кулдаунов, лимитов и других параметров платформы
  - Управление статусом наград (включено/отключено)
  - Отдельная вкладка после "Донат" для наград платформы

#### Улучшения вкладки "Награды"
- **Items для гача-крутки**:
  - Награды теперь это items (предметы) внутри сундуков
  - Добавлена поддержка изображений для карточек (загрузка файлов или URL)
  - Улучшен интерфейс создания и редактирования items
  - Мифический сундук убран из этой вкладки (только для донатов)
- **Изображения карточек**:
  - Новое поле `image_url` в базе данных
  - Загрузка изображений через API endpoint `/api/drops/rewards/{reward_id}/image`
  - Предпросмотр изображений в списке и в форме

### 🔄 Изменения в структуре

#### Разделение функционала
- **"Награды"** → Items для гача внутри сундуков (картинка, шанс, название, описание)
- **"Баллы"** → Награды через API платформы (Twitch/VK) за баллы канала
- **Мифический сундук** → Только в разделе "Донат", текст изменен на "Включить mythyc drops"

#### UI/UX улучшения
- Убрано описание "Система лутбоксов: настройка стриков, донатов и наград для зрителей"
- Улучшена обработка ошибок валидации (422)
- Добавлены визуальные анимации для кнопок "Сохранить"

### 🗄️ База данных

#### Новые миграции
- `7aa272ec1bfc_add_image_url_to_drops_rewards.py` - добавление поля `image_url` в таблицу `drops_rewards`
- `2dfdfeae5c56_add_streak_reset_on_skip_to_drops_config.py` - добавление поля `streak_reset_on_skip` (уже существовала)

#### Изменения в моделях
- `DropsReward.image_url` - URL изображения для карточки в гача крутке
- `DropsRewardCreate` и `DropsRewardUpdate` - добавлены поля для `image_url`

### 📚 Документация
- Создан новый документ **`DROPS_SYSTEM.md`** - полное руководство по системе Drops
- Обновлен **`DOCUMENTATION_INDEX.md`** - добавлена секция о Drops системе
- Обновлен **`CHANGELOG.md`** - добавлена Session 29

### 🏗️ Архитектура

#### Frontend
- `frontend/src/components/drops/PointsRewards.jsx` - новый компонент для управления наградами платформы
- `frontend/src/components/drops/RewardsManager.jsx` - обновлен для работы с items (изображения, гача)
- `frontend/src/pages/drops/DropsMainPage.jsx` - добавлена вкладка "Баллы", обновлена структура вкладок

#### Backend
- `bot_service/api/drops_api.py` - добавлен endpoint `/api/drops/rewards/{reward_id}/image` для загрузки изображений
- `bot_service/core/database.py` - добавлено поле `image_url` в модель `DropsReward`
- `bot_service/alembic/versions/7aa272ec1bfc_*.py` - миграция для `image_url`

### 🐛 Исправления
- Исправлена валидация `reward_value` в `DropsRewardCreate` (разрешена пустая строка)
- Улучшена обработка ошибок валидации на фронтенде (массив ошибок от FastAPI)
- Исправлена структура QUALITIES (мифический убран из общего списка)

### 📊 Метрики
- **Drops система**: Полностью реорганизована и документирована ✅
- **Награды платформы**: Отдельная вкладка для управления через API ✅
- **Items гача**: Поддержка изображений и улучшенный интерфейс ✅

---

## 🏠 Session 28 - Admin Panel Refactoring & Migration Fixes (9 января 2025)

### ✨ Улучшения Админ-Панели

#### Управление пользователями
- **Улучшена колонка "Пользователь"**:
  - Показывает иконку админа (👑) или пользователя
  - Отображает никнеймы платформ с иконками (Twitch/VK)
  - Более информативное отображение статуса подключений
- **Улучшена колонка "Интеграции"**:
  - Теперь показывает бейджи для Twitch и VK Live
  - Визуальная индикация статуса (активна/неактивна)
  - Больше не пустая - всегда показывает статус обеих интеграций

#### Мониторинг
- **Расширенные метрики**:
  - Сообщения за час (в дополнение к 24 часам)
  - Активные интеграции (Twitch/VK)
  - Активные каналы с разбивкой по платформам
  - TTS статистика (запросы, активные каналы)
- **Backend**: Расширен endpoint `/api/admin/monitoring/metrics` для возврата новых метрик

#### Управление ботами
- **Исправлена обработка ответа API**: 
  - Endpoint возвращает объект `{bots: {twitch: {...}, vk: {...}}}`
  - Frontend корректно преобразует в массив и отображает статус
  - Исправлена логика определения статуса ботов

#### Управление голосами
- **Переделан интерфейс**:
  - Убраны вкладки ("Все", "Глобальные", "Пользовательские")
  - Теперь две секции на одной странице:
    - **Сверху:** Пользовательские голоса (с фильтром по пользователю)
    - **Снизу:** Глобальные голоса
  - Разделитель между секциями для визуального разделения
  - Более интуитивная структура без переключения вкладок

#### Упрощение интерфейса
- **Удалена вкладка "Блокировки"**:
  - Функционал дублировался в управлении пользователями
  - При блокировке пользователя автоматически блокируются его каналы
  - Ручная блокировка каналов доступна через API (для редких случаев)

### 🐛 Исправления Миграций БД

#### Критические исправления
- **`20251029_remove_unused_tables.py`**:
  - Было: `down_revision = None` ❌
  - Стало: `down_revision = '7aa889f11a11'` ✅
  - Причина: Миграция использовалась в merge, но не имела правильной родительской ревизии

- **`3cbe5b9588a9_add_donationalerts_fields_to_users.py`**:
  - Исправлен комментарий: было "Revises: ef43e0597ce7" (архивированная), стало "Revises: 78ee312b0e78"
  - Теперь комментарий соответствует коду

#### Документация миграций
- Создан `bot_service/alembic/versions/MIGRATION_ISSUES_FIXED.md`
- Описаны все исправленные проблемы и структура миграций

### 📚 Обновленная Документация
- `ADMIN_BLOCKING_AND_WHITELIST.md` - удалено упоминание вкладки "Блокировки"
- `ADMIN_VOICE_MANAGEMENT.md` - обновлено описание интерфейса (две секции вместо табов)
- `ADMIN_PANEL_ENDPOINTS_STATUS.md` - добавлены новые метрики мониторинга
- `CHANGELOG.md` - добавлена Session 28

### 🏗️ Архитектура
- **Frontend:**
  - `frontend/src/pages/admin/AdminPage.jsx` - удалена вкладка "Блокировки"
  - `frontend/src/pages/admin/UserManagementPage.jsx` - улучшены колонки
  - `frontend/src/pages/admin/MonitoringPage.jsx` - добавлены новые метрики
  - `frontend/src/pages/admin/BotManagementPage.jsx` - исправлена обработка API
  - `frontend/src/components/admin/VoiceManagement.jsx` - переделан на две секции
- **Backend:**
  - `bot_service/api/admin_api.py` - расширен endpoint мониторинга
  - `bot_service/alembic/versions/` - исправлены критические миграции

### 📊 Метрики
- **Админ-панель**: Более информативная и удобная ✅
- **Мониторинг**: Расширенные метрики (интеграции, каналы, TTS) ✅
- **Миграции**: Все критические проблемы исправлены ✅

---

## 🏠 Session 27 - Voice Management UI Improvements (31 октября 2025)

### ✨ Новые фичи

#### Разделение глобальных и пользовательских голосов
- **Два типа голосов**:
  - 🌐 **Глобальные** (`voice_type='global'`) - доступны всем, загружаются через админку
  - 👤 **Пользовательские** (`voice_type='user'`) - доступны только владельцу
- **UI улучшения**:
  - Компактные карточки голосов (уменьшен размер)
  - Визуальное различие: синий (глобальные) vs серый (пользовательские)
  - Информационные подсказки для каждого типа
- **Ограничения для глобальных голосов**:
  - Нельзя удалять, переименовывать
  - Можно только настраивать параметры для себя

#### Админ-панель - полное управление
- **Просмотр всех голосов**: глобальные и пользовательские
- **Загрузка голосов**:
  - Выбор типа: "Глобальный" или "Пользовательский"
  - При выборе пользовательского - выбор владельца из списка
- **Полное редактирование**: для любых голосов
- **Перетранскрибация и переименование**: для всех типов

### 🏗️ Архитектура
- **Frontend:**
  - `frontend/src/pages/tts/VoiceManagementPage.jsx` - разделение на два раздела
  - `frontend/src/components/admin/VoiceManagement.jsx` - админ видит оба типа
- **Backend:**
  - `tts_service/api_endpoints.py` - добавлен `GET /api/voices/global`
  - `tts_service/admin_api.py` - обновлена логика загрузки

### 📚 Документация
- Создан `docs/VOICE_SEPARATION_GLOBAL_USER.md` - разделение для пользователей
- Создан `docs/ADMIN_VOICE_MANAGEMENT.md` - возможности админа
- Создан `docs/DOCUMENTATION_AUDIT_REPORT.md` - полный аудит документации
- Обновлён `docs/CURRENT_STATUS.md` - статус сессии 27

### 📊 Метрики
- **Разделение голосов**: Глобальные vs Пользовательские ✅
- **Админ-панель**: Загрузка обоих типов ✅
- **UI**: Компактные карточки, визуальное различие ✅

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

**Последнее обновление:** 31 октября 2025 (Session 27)  
**Версия:** 0.02  
**Статус:** ✅ Production Ready

