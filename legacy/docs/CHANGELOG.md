# Changelog - История изменений проекта

Все значимые изменения в проекте документируются в этом файле.

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
