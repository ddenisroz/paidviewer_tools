# Changelog - История изменений проекта

Все значимые изменения в проекте документируются в этом файле.

---

## Dec 18, 2025 - Full Project Audit & Healing

### Комплексный аудит проекта
**Статус:** ✅ Завершено (87%)

Выполнен полный аудит проекта: UI/UX, функционал, кнопки, консистентность дизайна, админ панель.

#### Исправления

**TtsPlayerContext.tsx:**
- Добавлен retry limit (MAX_RETRIES = 3) для предотвращения зацикливания аудио
- Сброс счетчика при успешном воспроизведении

**AdminPage.tsx:**
- Полностью переписан с lazy loading компонентов
- Единые стили из designSystem
- Горизонтальный скролл для табов
- Suspense с skeleton loader

**UserManagementPage.tsx:**
- Увеличены кнопки действий с h-7 w-7 до h-8 w-8 (32x32px)
- Реализована smart pagination (первая, последняя, окружение текущей)
- Добавлен тип `UsersApiResponse`
- Исправлены типы в mutations и error handlers

**SystemLogsPage.tsx:**
- Добавлен тип `ApiResponse`

**StorageManagementPage.tsx:**
- Добавлен тип `ApiResponse`
- Исправлены типы ошибок в catch блоках

**ChatHeader.tsx:**
- Удалена неиспользуемая функция `getButtonStyle`

**ChatCard.tsx:**
- Создан подкомпонент ChatEmptyState
- Стандартизированы размеры кнопок (40x40px)
- Добавлены Tooltips
- Убраны анимации прыжка

**tts_api.py:**
- Убраны лишние whitelist проверки для Google TTS
- Оптимизированы логи

**App.tsx (Toast):**
- Позиция: top-right
- Duration: 3 секунды
- Offset: 80px

#### Новые файлы

- `frontend/src/constants/designSystem.ts` - единые константы дизайн-системы
- `frontend/src/components/chat/ChatEmptyState.tsx` - компонент пустого состояния чата
- `PROJECT_HEALING_PLAN.md` - план лечения проекта
- `AUDIT_REPORT.md` - детальный отчет аудита

#### Документация

- Обновлен `docs/CURRENT_STATUS.md` - добавлена секция об аудите
- Обновлен `docs/architecture/DESIGN_SYSTEM.md` - добавлены константы

#### Дополнительные улучшения (Dec 18, вечер)

**SystemLogsPage.tsx:**
- Добавлен экспорт логов в CSV с кнопкой Download
- UTF-8 BOM для корректного отображения кириллицы в Excel

**VoiceManagement.tsx:**
- Добавлен прогресс-индикатор при загрузке голоса (Loader2 + анимация)

**UserManagementPage.tsx:**
- Debounce для поиска уже был реализован (500ms)

**Dashboard Batch API (оптимизация производительности):**
- Создан `bot_service/api/dashboard_api.py` - endpoint `GET /api/dashboard/init`
- Объединяет 4-6 запросов в один: user, integrations, tts settings, chat history
- Создан `frontend/src/hooks/useDashboardInit.ts` - React Query хук для использования

**Документация:** [PROJECT_HEALING_PLAN.md](../PROJECT_HEALING_PLAN.md), [AUDIT_REPORT.md](../AUDIT_REPORT.md)

---

## Dec 15, 2025 - Auth Type System

### Система типов авторизации
**Статус:** Готово

Реализована система выбора типа авторизации (full/basic) при входе через Twitch или VK Live.

#### Новые возможности
- **Full авторизация** - все функции включая управление стримом и channel points
- **Basic авторизация** - базовые функции (TTS, YouTube, Drops) без управления стримом
- **Двухшаговый логин** - выбор платформы, затем выбор типа авторизации
- **Апгрейд авторизации** - возможность перейти с basic на full

#### Backend изменения
- Добавлены константы `AuthType`, `OAUTH_SCOPES_FULL`, `OAUTH_SCOPES_BASIC` в `constants.py`
- Добавлено поле `auth_type` в модель `UserToken`
- Создан API `/api/auth/type` для работы с типами авторизации
- Обновлен `oauth_handler.py` для поддержки auth_type
- Создана миграция `20251215_add_auth_type_to_user_tokens.py`

#### Frontend изменения
- Обновлен `LoginPage.tsx` - двухшаговый процесс логина
- Создан `BasicAuthBanner.tsx` - баннер для заблокированных функций
- Создан хук `useAuthType.ts` - работа с типами авторизации

#### Исправления
- Исправлен `advanced_rate_limiter.py` - использование `parse()` для библиотеки limits

#### Тесты
- Добавлены тесты в `tests/test_auth_type.py`

**Документация:** [AUTH_TYPE_SYSTEM.md](AUTH_TYPE_SYSTEM.md)

---

## Nov 9, 2025 - Code Refactoring & Quality Improvements

### Рефакторинг кода
**Статус:** ✅ Завершено

Выполнен комплексный рефакторинг с целью убрать костыли, использовать готовые библиотеки, убрать хардкоды и обеспечить понятную обработку ошибок.

#### Созданы переиспользуемые хуки
- **`useAutoSave.js`** - Хук для автосохранения с дебаунсом и валидацией
- **`useDropsConfig.js`** - Хук для единой логики работы с конфигурацией drops
- **`useChatScroll.js`** - Хук для упрощенной логики автоскролла чата

#### Созданы файлы констант
- **`constants/drops.js`** - Константы для drops (донаты, мифические, стрики, чат, OBS)
- **`constants/websocket.js`** - Константы для WebSocket (reconnect attempts, delays)

#### Рефакторинг компонентов
- **`DonationSettings.jsx`** - Использует `useDropsConfig` и `useAutoSave`, убрано дублирование (~50 строк)
- **`StreakSettings.jsx`** - Использует `useDropsConfig` и `useAutoSave`, упрощена логика (~30 строк)
- **`DonationGrid.jsx`** - Хардкоды заменены на константы
- **`ChatCard.jsx`** - Сложная логика автоскролла заменена на хук (~160 строк удалено), добавлены понятные ошибки
- **`RewardsManager.jsx`** - Удален временный ID

#### Улучшение обработки ошибок
- **`queryPersist.js`** - `console.error` заменен на `logger.error`
- **`ChatCard.jsx`** - Добавлены `toast.error` для всех ошибок загрузки
- **`sharedWebSocket.js`** - Используются константы для reconnect логики

#### Результаты
- ✅ Убрано ~240 строк костылей и дублирующегося кода
- ✅ Все хардкоды заменены на константы
- ✅ Создано ~250 строк переиспользуемого кода
- ✅ Все ошибки показываются пользователю через `toast.error`
- ✅ Код стал чище, профессиональнее и поддерживаемее

**Подробности:** См. [REFACTORING_REPORT_2025_11_09.md](./REFACTORING_REPORT_2025_11_09.md)

---

## Nov 9, 2025 - User Issues Fixes & Improvements

### Исправления по запросам пользователя
- ✅ **Поиск TTS награды на VK Live:** Улучшена логика поиска, награда не удаляется из БД если не найдена в manage_info
- ✅ **Тоглы стриков:** Исправлены, теперь кликабельны
- ✅ **Шорткат стрика:** Работает для обеих платформ (Twitch и VK)
- ✅ **Привязка стриков:** Изменена с дней на стримы (стрик засчитывается только когда стрим онлайн)
- ✅ **Подписи в интерфейсе:** Убраны лишние слова ("Стрик", "Дни для наград", "Донат")
- ✅ **Настройки мифического сундука:** Добавлены инпуты для прямого ввода значений
- ✅ **Переименование:** "Мифический lootbox" → "Мифический drops"
- ✅ **Тоглы донатных дропс:** Исправлены, кликабельны
- ✅ **Автоматическое включение donation drops:** Реализовано после подключения DonationAlerts
- ✅ **Настройки за баллы:** Добавлен переключатель платформ (Twitch/VK)
- ✅ **Мифический сундук:** Доступен только когда стрим онлайн
- ✅ **Виджет для OBS:** Добавлено отображение активной сессии мифического сундука с таймером

### Очистка документации
- ✅ Удалены устаревшие документы (старые фиксы и аудиты)
- ✅ Обновлен индекс документации

---

## Nov 8, 2025 - Platform-Specific Streaks & Bug Fixes

### Drops System - Platform-Specific Streaks
- **Платформо-специфичные стрики:**
  - Реализовано независимое включение стриков для Twitch и VK Live
  - Отдельные переключатели для каждой платформы в UI
  - Общие настройки дней и количества сообщений для всех платформ
  - Добавлены флаги `streak_enabled_twitch` и `streak_enabled_vk` в `drops_configs`
  - Миграция: `5765f2a789b9_add_streak_platform_flags_to_drops_config`
  - Устаревшее поле `streak_enabled` оставлено для обратной совместимости

- **Архитектура:**
  - Общий конфиг (`platform="global"`) для хранения всех настроек
  - Награды остаются разделенными по платформам
  - Донаты, история и виджет — общие для всех платформ

### Bug Fixes
- **QuickActionsBar:** Исправлена работа с платформо-специфичными флагами стриков
- **DonationSettings:** Добавлен недостающий параметр `platform` для компонента `DonationHistory`
- **DropsMainPage:** Добавлен параметр `platform` для компонента `PointsRewards`

### F5-TTS Audio Playback
- **F5-TTS Audio Playback:**
  - Исправлено воспроизведение F5-TTS аудио файлов на фронтенде
  - Относительные URL (`/audio/temp/...`) теперь корректно преобразуются в полные URL с `TTS_SERVICE_URL` в `bot_service`
  - Добавлена дополнительная обработка относительных URL на фронтенде с fallback
  - Улучшено логирование загрузки и декодирования аудио для отладки
  - Исправлена ошибка `Unable to decode audio data` в Web Audio API

- **Yoficator (Ёфикатор):**
  - Исправлена неправильная ёфикация слова "проверка" → "провёрка"
  - Добавлены исключения для слов с "ерк" в корне (проверка, сверка, и т.д.)
  - Слова с "ерк" теперь не ёфицируются автоматически

### Voice Settings Improvements
- **Персональные настройки голоса:**
  - Улучшена обработка персональных настроек голоса (cfg_strength, speed_preset, volume)
  - Корректный fallback на дефолтные значения из таблицы `Voice` (настроенные админом), если персональные настройки отсутствуют
  - Если пользователь не настроил параметры, используются дефолты от админа
  - Если пользователь настроил параметры, используются его персональные настройки
  - Volume обрабатывается отдельно: персональный volume применяется к `final_volume_level`

- **Логика работы:**
  - Если персональных настроек нет → используются дефолтные из `Voice` (настроенные админом)
  - Если персональные настройки есть → используются они
  - Volume: персональный volume из `UserVoiceSettings` или базовый из `AudioSettings`
  - Добавлено детальное логирование используемых настроек (персональные или дефолтные)

### Technical Changes
- **bot_service/services/tts_manager.py:**
  - Преобразование относительного пути `/audio/...` в полный URL с `TTS_SERVICE_URL`
  - Поддержка разных форматов URL (полный, относительный, только имя файла)

- **bot_service/utils/websocket_helper.py:**
  - Улучшена загрузка персональных настроек из `UserVoiceSettings`
  - Если `cfg_strength` или `speed_preset` = `None`, они не передаются в `voice_settings` (используются дефолты)
  - Volume обрабатывается отдельно и применяется к `final_volume_level`

- **tts_service/tts_engine.py:**
  - Исправлена обработка `voice_settings`: гарантируется, что это всегда словарь (не `None`)
  - Если параметров нет в `voice_settings`, используются значения из `voice_record` (дефолты от админа)
  - Добавлено логирование: видно, какие настройки используются (персональные или дефолтные)

- **tts_service/TTS_rus_engine/yoficator_module.py:**
  - Добавлены исключения для слов "проверка", "сверка" и слов с "ерк" в корне
  - Правило замены "е" на "ё" в словах, заканчивающихся на "а", теперь исключает слова с "ерк"

- **frontend/src/context/ChatContext.jsx:**
  - Добавлена обработка относительных URL на фронтенде (fallback на `TTS_SERVICE_URL`)
  - Улучшено логирование загрузки и декодирования аудио
  - Добавлена проверка HTTP статуса при загрузке аудио

---

## Nov 3, 2025 - Code Quality & Cleanup

### Duplicate Removal
- **Backend:**
  - Удалены дублирующиеся middleware в `main.py` (CORS, Session, StaticFiles настроены в `create_app()`)
  - Удален дублирующийся route handler `create_command_no_slash`
  - Удален дублирующийся endpoint `/api/auth/status` из `additional_api.py` (оставлен в `main.py`)
  - Удалены дублирующиеся импорты (`Bot`, `VKLiveBot`)
  - Удален legacy `vk_live_command_handler.py`, логика перенесена в `universal_command_handler`
  
- **Frontend:**
  - Удалены неиспользуемые страницы (StreamTitlePage, TtsPage, LootboxPage, и т.д.)
  - Удалены legacy hooks (ProtectedRoute, useApi, useApiCall, useAsync, usePageAnimation)
  - Удалены `_original.jsx` файлы (chatcard, sidebar, chatwindow)

### Cleanup
- Удалены пустые директории: `examples`, `integrations`, `tasks`
- Удалены старые бэкапы БД: `data/*.backup*`, `backups/database/*.db`
- Удалено 20+ устаревших документов (аудиты, фиксы, миграции)
- Обновлен DOCUMENTATION_INDEX.md (39 → 28 документов)
- Удалены пустые MD файлы в корне: `README_MAIN.md`, `setup.py`

### UI Improvements
- Динамические заголовки страниц в Header (Озвучка, YouTube заказы, Drops система, и т.д.)
- Обновлен BACKGROUND Header для соответствия с main content

### Performance
- Мемоизация AuthContext для предотвращения ненужных re-renders
- Использование `useCallback` для стабильных ссылок на функции

### Security
- Добавлен `vk_channel_name` в auth status API для корректной работы Drops системы с VK Live

---

## Nov 3, 2025 - Release Prep

### Security
- Rate limiting (slowapi + limits)
- Input sanitization (XSS/SQLi)
- JWT + OAuth2 encryption
- CSRF protection
- ✅ Retry logic with exponential backoff

### Reliability  
- Exponential backoff для VK Live API
- Timeout configuration для всех HTTP клиентов
- Retry для Twitch/VK/YouTube/DonationAlerts API
- SharedWebSocket (Singleton pattern)

### Performance
- React Query caching
- Optimistic updates
- Database indexing

---

## Session 32 - Drops Widget & Command Hierarchy (Nov 3, 2025)

### Drops System
- Widget token system для OBS
- Перегенерация токена
- Анимированное открытие сундука
- Автоматическая интеграция DonationAlerts

### Commands
- Исправлена иерархия ролей (all → vip → moderator → broadcaster)
- Исправлено отображение пустых данных

---

## Session 30 - Modern Stack (Nov 3, 2025)

### Backend
- Performance индексы для БД
- In-memory кеширование
- Оптимизация N+1 запросов

### Frontend
- React Query integration
- Modern design system
- Skeleton loading

---

Полная история: см. `docs/CURRENT_STATUS.md`
