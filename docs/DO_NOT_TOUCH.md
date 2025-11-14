# НЕ ТРОГАТЬ! КРИТИЧЕСКИ ВАЖНЫЕ ФАЙЛЫ

## ВАЖНО ДЛЯ AI РАЗРАБОТЧИКОВ И ЛЮДЕЙ

Этот файл содержит список **протестированных и рабочих** компонентов, которые **НЕЛЬЗЯ ИЗМЕНЯТЬ** без крайней необходимости.

**Любые изменения в этих файлах могут сломать критически важную функциональность!**

---

## СИСТЕМА TTS (TEXT-TO-SPEECH)

**Статус:** ПОЛНОСТЬЮ РАБОЧАЯ И ОПТИМИЗИРОВАНА (November 2025)  
**Строк кода:** 2000+ (вся система включая оптимизации)  
**Тестирование:** Полностью протестировано  
**Сложность:** КРИТИЧЕСКАЯ (базовая озвучка, настройки, платформы, синхронизация, WebSocket оптимизация)

### Защищённые файлы TTS:

#### Frontend (TypeScript Migration Complete):
1. **`frontend/src/pages/tts/TtsMainPage.tsx`** 🔒
   - Главная страница TTS с настройками
   - Загрузка и сохранение всех TTS параметров
   - Синхронизация между компонентами через CustomEvents
   - Мигрирован на TypeScript
   - **НЕ ТРОГАТЬ БЕЗ КРАЙНЕЙ НЕОБХОДИМОСТИ!**

2. **`frontend/src/components/tts/TtsFilterManager.tsx`** 🔒
   - Управление фильтрами TTS (слова, пользователи)
   - Платформо-специфичная фильтрация
   - **РАБОТАЕТ КОРРЕКТНО - НЕ ТРОГАТЬ!**

3. **`frontend/src/components/TtsPlatformSelector.tsx`** 🔒
   - Верхние переключатели платформ TTS
   - Двусторонняя синхронизация с ChatCard через события
   - Cache-busting для актуальных данных
   - Мигрирован на TypeScript
   - **НЕ ТРОГАТЬ!**

4. **`frontend/src/components/ChatCard.tsx`** (TTS shortcuts) 🔒
   - Кнопки быстрого включения/выключения TTS
   - Автоматическая синхронизация с верхними переключателями
   - Фильтрация сообщений по платформам
   - Виртуализация для производительности
   - Мигрирован на TypeScript
   - **КРИТИЧЕСКАЯ СИНХРОНИЗАЦИЯ - НЕ ТРОГАТЬ!**

5. **`frontend/src/context/IntegrationsContext.tsx`** 🔒
   - Автоматическое удаление платформы из TTS при disconnect
   - Отправка событий синхронизации при изменениях
   - Мигрирован на TypeScript
   - **КРИТИЧЕСКАЯ ЛОГИКА - НЕ ТРОГАТЬ!**

#### Backend:
6. **`bot_service/api/tts_api.py`** 🔒
   - Unified TTS API endpoints
   - Endpoint `/api/tts/platform-settings` (GET/POST)
   - Endpoint `/api/tts/settings` с version control
   - Endpoint `/api/tts/engine` для переключения движков
   - Сохранение `enabled_platforms` в БД
   - Детальное логирование для отладки
   - **НЕ ТРОГАТЬ!**

7. **`bot_service/core/database.py`** (TTS модели) 🔒
   - `TTSUserSettings` модель с version field
   - `enabled_platforms` (JSON array)
   - Оптимизированные индексы для производительности
   - **НЕ МЕНЯТЬ СХЕМУ БЕЗ МИГРАЦИИ!**

8. **`bot_service/api/additional_api.py`** (integration disconnect) 🔒
   - `/integrations/{platform}/disconnect` - мягкое отключение
   - `/integrations/{platform}/remove` - полное удаление
   - Логика `is_active=False` vs полное удаление токена
   - **НЕ ТРОГАТЬ!**

---

## � СИаСТЕМА КАТЕГОРИЙ И НАЗВАНИЙ СТРИМА

**Статус:** ✅ ЗАВЕРШЕНО И МИГРИРОВАНО (November 2025)  
**Строк кода:** 900+ (главный компонент)  
**Тестирование:** Полностью протестировано  
**Сложность:** ВЫСОКАЯ (умный поиск, синхронизация, маппинг)

### 📁 Защищённые файлы:

#### Frontend (TypeScript Migration Complete):
1. **`frontend/src/components/StreamCategoryCard.tsx`** (900+ строк) 🔒
   - Умный поиск категорий с relevance scoring
   - Автосинхронизация между Twitch и VK Live
   - Ручной выбор с API поиском
   - Система уведомлений (5 типов)
   - Автосброс несохранённых изменений (10 сек)
   - Защита от неверных ID (UUID vs numeric)
   - Мигрирован на TypeScript
   - **КРИТИЧЕСКАЯ СЛОЖНОСТЬ - НЕ ТРОГАТЬ!**

2. **`frontend/src/constants/categoryMapping.ts`** (338 строк, 230+ категорий) 🔒
   - Маппинг Twitch ↔ VK Live категорий
   - Функция `findMappedCategory` (РАБОТАЕТ КОРРЕКТНО!)
   - Функция `getSimilarCategories`
   - Мигрирован на TypeScript
   - **НЕ ДОБАВЛЯТЬ ОБРАТНО `partial match`! ОН ЛОМАЕТ ВСЁ!**

3. **`frontend/src/constants/categoryAliases.ts`** (464 строки, 460+ алиасов) 🔒
   - Сокращения игр (CS, DBD, WOW, и т.д.)
   - Русские переводы категорий
   - Функция `expandQueryWithAliases`
   - Мигрирован на TypeScript
   - **Можно добавлять новые алиасы, но НЕ МЕНЯТЬ ЛОГИКУ!**

#### Backend:
4. **`bot_service/api/stream_info_api.py`** 🔒
   - Endpoint `/stream/update` - НЕ ТРОГАТЬ!
   - `CategoryObject` Pydantic model - НЕ ТРОГАТЬ!
   - `PlatformUpdate` model - НЕ ТРОГАТЬ!

5. **`bot_service/api/vk_api.py`** 🔒
   - Функция `update_stream_category` - НЕ ТРОГАТЬ!
   - Функция `_update_stream` - НЕ ТРОГАТЬ!
   - Логика фильтрации `cover_url` - НЕ ТРОГАТЬ!

---

## � WEОBSOCKET СИСТЕМА (ОПТИМИЗИРОВАННАЯ)

**Статус:** ✅ ОПТИМИЗИРОВАНА (November 2025)  
**Строк кода:** 400+ (SharedWebSocket с Leader Election)  
**Тестирование:** Полностью протестировано  
**Сложность:** ВЫСОКАЯ (Leader Election, BroadcastChannel, reconnection logic)

### Защищённые файлы WebSocket:

#### Frontend:
1. **`frontend/src/utils/sharedWebSocket.ts`** 🔒
   - Leader Election с BroadcastChannel
   - Единое WebSocket соединение на браузер (не на вкладку)
   - Heartbeat механизм (ping/pong каждые 30 сек)
   - Exponential backoff reconnection (1s → 30s max)
   - Кросс-табовая синхронизация сообщений
   - **КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ - НЕ ТРОГАТЬ!**

#### Backend:
2. **`bot_service/core/websocket_manager.py`** 🔒
   - ConnectionManager с отслеживанием активных соединений
   - Метод `is_user_connected()` для проверки активности
   - Автоматическое отключение TTS при disconnect
   - Broadcast сообщений всем соединениям пользователя
   - **НЕ ТРОГАТЬ!**

3. **`bot_service/services/memory_websocket_manager.py`** 🔒
   - In-memory WebSocket manager для быстрой работы
   - Кеширование активных соединений
   - **НЕ ТРОГАТЬ!**

---

## 🔒 СИСТЕМА ПРОИЗВОДИТЕЛЬНОСТИ

**Статус:** ✅ ОПТИМИЗИРОВАНА (November 2025)  
**Строк кода:** Распределено по компонентам  
**Тестирование:** Полностью протестировано  
**Сложность:** СРЕДНЯЯ (code splitting, virtualization, memoization)

### Защищённые оптимизации:

#### Frontend:
1. **Code Splitting и Lazy Loading** 🔒
   - Lazy loading для Admin, Drops, Analytics routes
   - Suspense boundaries с skeleton loaders
   - Preload on hover для навигации
   - **НЕ УДАЛЯТЬ LAZY IMPORTS!**

2. **React Performance Optimizations** 🔒
   - React.memo для Context providers
   - useMemo для дорогих вычислений
   - useCallback для стабильных функций
   - **НЕ УДАЛЯТЬ МЕМОИЗАЦИЮ!**

3. **ChatCard Virtualization** 🔒
   - @tanstack/react-virtual для списка сообщений
   - Рендер только видимых сообщений
   - Сохранение позиции скролла
   - **КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ - НЕ ТРОГАТЬ!**

#### Backend:
4. **Database Optimizations** 🔒
   - Connection pooling (pool_size=20, max_overflow=40)
   - Индексы на User.twitch_username, User.vk_user_id
   - Eager loading с joinedload для relationships
   - **НЕ МЕНЯТЬ НАСТРОЙКИ ПУЛА!**

5. **Async Operations** 🔒
   - asyncio.gather() для параллельных API вызовов
   - Timeout configurations (30s total, 10s connect)
   - Non-blocking request handlers
   - **НЕ ТРОГАТЬ ASYNC ЛОГИКУ!**

---

## 🔒 СИСТЕМА ОБРАБОТКИ ОШИБОК

**Статус:** ✅ РЕАЛИЗОВАНА (November 2025)  
**Строк кода:** Распределено по компонентам  
**Тестирование:** Полностью протестировано  
**Сложность:** СРЕДНЯЯ (error boundaries, retry logic, logging)

### Защищённые компоненты:

#### Frontend:
1. **Error Boundaries** 🔒
   - App-level ErrorBoundary
   - Route-level ErrorBoundary
   - Component-level ErrorBoundary для TTS, Drops
   - Fallback UI компоненты
   - **НЕ УДАЛЯТЬ ERROR BOUNDARIES!**

2. **API Error Handler** 🔒
   - Централизованная функция `handleApiError()`
   - Обработка 401, 403, 500 статусов
   - Retry logic с exponential backoff
   - User-friendly error messages
   - **НЕ ТРОГАТЬ!**

#### Backend:
3. **Exception Handlers** 🔒
   - Global exception handler для unhandled errors
   - HTTPException handler
   - RequestValidationError handler с field-level errors
   - Structured logging с контекстом
   - **НЕ ТРОГАТЬ!**

4. **Error Logging** 🔒
   - Structured logging с уровнями (DEBUG, INFO, WARNING, ERROR)
   - Log rotation
   - Redaction sensitive information (tokens, passwords)
   - Frontend error tracking endpoint
   - **НЕ ТРОГАТЬ!**

---

## 🔒 DROPS СИСТЕМА (РАЗДЕЛЕНИЕ ЛОГИКИ)

**Статус:** ✅ ОПТИМИЗИРОВАНА (November 2025)  
**Строк кода:** 300+ (backend service + frontend animation)  
**Тестирование:** Полностью протестировано  
**Сложность:** СРЕДНЯЯ (probability calculation, animation sync)

### Защищённые файлы:

#### Backend:
1. **`bot_service/services/drops_service.py`** 🔒
   - DropsCalculationService с probability-based logic
   - Метод `calculate_drop()` - server-side calculation
   - Метод `get_probabilities()` и `validate_probabilities()`
   - Comprehensive logging
   - **БИЗНЕС-ЛОГИКА НА BACKEND - НЕ ТРОГАТЬ!**

2. **`bot_service/api/drops_api.py`** 🔒
   - Endpoint `/api/drops/spin` с server-side calculation
   - Сохранение результата в БД перед отправкой
   - WebSocket broadcast результата
   - **НЕ ТРОГАТЬ!**

#### Frontend:
3. **`frontend/src/widgets/LootboxWidget/LootboxAnimation.tsx`** 🔒
   - Анимация к predetermined результату от backend
   - Невозможность манипуляции результатом
   - Синхронизация с WebSocket
   - **ТОЛЬКО АНИМАЦИЯ - НЕ ТРОГАТЬ!**

---

## 🔒 СИСТЕМА КОНФИГУРАЦИИ (ЦЕНТРАЛИЗОВАННАЯ)

**Статус:** ✅ РЕАЛИЗОВАНА (November 2025)  
**Строк кода:** 250+ (централизованная конфигурация)  
**Тестирование:** Полностью протестировано  
**Сложность:** СРЕДНЯЯ (pydantic-settings, validation, security checks)

### Защищённые файлы конфигурации:

#### Backend:
1. **`bot_service/core/config.py`** 🔒
   - Централизованная конфигурация через pydantic-settings
   - Автоматическая загрузка из .env
   - Field validators для всех критических полей
   - Production checks для SECRET_KEY и TOKEN_ENCRYPTION_KEY
   - Computed fields (cors_origins_list, is_production, is_development)
   - **НЕ ТРОГАТЬ ВАЛИДАЦИЮ!**

2. **`bot_service/.env.example`** 🔒
   - Шаблон всех environment variables
   - Документация каждой переменной
   - Примеры для development и production
   - **НЕ УДАЛЯТЬ ПЕРЕМЕННЫЕ!**

#### Frontend:
3. **`frontend/.env.example`** 🔒
   - Шаблон всех VITE_* переменных
   - WebSocket конфигурация
   - API endpoints
   - Feature flags
   - **НЕ УДАЛЯТЬ ПЕРЕМЕННЫЕ!**

---

## 🚫 ЧТО НЕЛЬЗЯ ДЕЛАТЬ:

### ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО (TTS СИСТЕМА):

1. **Удалять или менять события синхронизации**
   - `window.dispatchEvent(new CustomEvent('tts-settings-changed', ...))`
   - `window.addEventListener('tts-settings-changed', ...)`
   - Это обеспечивает синхронизацию между всеми компонентами TTS
   - **КРИТИЧЕСКАЯ СИНХРОНИЗАЦИЯ - НЕ ТРОГАТЬ!**

2. **Менять логику проверки подключения платформ**
   - `isTwitchConnected = integrations.twitch?.enabled || (isGuest && user?.platform === 'twitch')`
   - `isVkConnected = integrations.vk?.enabled || (isGuest && user?.platform === 'vk')`
   - Это правильная проверка OAuth + гости
   - **НЕ ТРОГАТЬ!**

3. **Менять автоматическое удаление платформ при disconnect**
   - При отключении OAuth → автоматически удаляется из `enabled_platforms`
   - Предотвращает inconsistent state
   - **КРИТИЧЕСКАЯ ЛОГИКА - НЕ ТРОГАТЬ!**

4. **Использовать `localStorage` для хранения состояния TTS**
   - ВСЁ хранится в БД через API
   - localStorage очищен от obsolete ключей
   - **НЕ ВОЗВРАЩАТЬ localStorage ДЛЯ TTS!**

5. **Менять Pydantic модель `PlatformSettingsRequest`**
   - `enabled_platforms: List[str]`
   - Валидация платформ: `{'twitch', 'vk'}`
   - **НЕ ТРОГАТЬ!**

6. **Менять cache-busting параметры**
   - `params: { _t: Date.now() }`
   - `headers: { 'Cache-Control': 'no-cache' }`
   - Обеспечивает актуальность данных
   - **НЕ УДАЛЯТЬ!**

### ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО (КОНФИГУРАЦИЯ):

1. **Использовать хардкоды вместо environment variables**
   - ВСЕ URL должны быть в .env
   - ВСЕ секреты должны быть в .env
   - ВСЕ настройки должны быть конфигурируемы
   - **НЕ ДОБАВЛЯТЬ ХАРДКОДЫ!**

2. **Менять валидацию в core/config.py**
   - Production checks критичны для безопасности
   - Field validators предотвращают ошибки
   - Computed fields используются по всему коду
   - **НЕ ТРОГАТЬ ВАЛИДАЦИЮ!**

3. **Удалять переменные из .env.example**
   - Каждая переменная документирована
   - Используется в коде
   - Нужна для deployment
   - **НЕ УДАЛЯТЬ!**

4. **Использовать os.getenv() напрямую**
   - Использовать `from core.config import settings`
   - Type safety через pydantic
   - Автоматическая валидация
   - **НЕ ИСПОЛЬЗОВАТЬ os.getenv()!**

5. **Менять default значения в production**
   - Default значения только для development
   - Production требует явной конфигурации
   - Валидация проверяет это
   - **НЕ МЕНЯТЬ DEFAULTS!**

### ❌ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО (КАТЕГОРИИ):

1. **Менять логику `findMappedCategory`**
   - Удалён `partial match` по КРИТИЧЕСКОЙ причине
   - "IRL" находил "IRL: Italian Ritual Live" → сломанный маппинг
   - Текущая логика: ТОЛЬКО точное совпадение или маппинг

2. **Добавлять обратно `partial match` в поиск категорий**
   - Это было источником ВСЕХ проблем в Session 6
   - Ломало автосинхронизацию
   - Ломало ручной выбор

3. **Менять структуру payload для VK API**
   - ТОЛЬКО полный объект категории:
     ```javascript
     {
       id: "UUID",
       name: "Category Name",
       title: "Category Title",
       type: "games",
       cover_url: "https://..." // ОПЦИОНАЛЬНО, только если НЕ пустая строка!
     }
     ```

4. **Трогать `calculateRelevance`**
   - Сложная логика scoring (0-100 баллов)
   - 8 уровней релевантности
   - Fuzzy matching с Levenshtein distance
   - Работает корректно - НЕ ТРОГАТЬ!

5. **Удалять проверку `isVkUUID`**
   - Защита от отправки Twitch ID в VK API
   - Критическая защита - НЕ ТРОГАТЬ!

6. **Менять таймер автосброса**
   - 10 секунд - оптимальное время
   - Протестировано UX-специалистом
   - Менять ТОЛЬКО если есть серьёзная причина

7. **Менять логику `handleCategorySelect`**
   - Запускает API поиск для маппинга
   - Обрабатывает успех/ошибки
   - Отправляет уведомления
   - СЛОЖНАЯ ЛОГИКА - НЕ ТРОГАТЬ!

8. **Менять логику `handleToggleChange`**
   - Автосинхронизация через toggle
   - Строгая проверка релевантности
   - Fallback на Twitch-only если VK не найдена
   - РАБОТАЕТ КОРРЕКТНО - НЕ ТРОГАТЬ!

---

## ✅ ЧТО МОЖНО ДЕЛАТЬ:

### Безопасные изменения:

1. **Добавлять категории в `categoryMapping.js`**
   ```javascript
   'New Game': 'Новая Игра',  // OK
   ```

2. **Добавлять алиасы в `categoryAliases.js`**
   ```javascript
   'ng': ['New Game'],  // OK
   ```

3. **Менять ТЕКСТЫ уведомлений** (НО НЕ ЛОГИКУ!)
   ```javascript
   addToast({
       type: 'success',
       message: 'Новый текст',  // OK
       duration: 3000
   });
   ```

4. **Менять длительность уведомлений**
   ```javascript
   duration: 5000  // Было 3000, можно изменить
   ```

5. **Менять таймер автосброса** (ОСТОРОЖНО!)
   ```javascript
   }, 15000);  // Было 10000, можно изменить НО ТОЛЬКО ЕСЛИ НУЖНО!
   ```

---

## 📊 СТАТИСТИКА СИСТЕМ:

### TTS Система:
- **Файлов:** 8
- **Строк кода:** 1500+
- **Платформ:** 2 (Twitch, VK Live)
- **API endpoints:** 2 (GET/POST platform-settings)
- **Компонентов синхронизации:** 4
- **Время на разработку:** Session 7
- **Критических исправлений:** 3+ (inconsistent state, localStorage, sync)

### Система Категорий:
- **Файлов:** 6
- **Строк кода:** 893+ (главный компонент)
- **Категорий в маппинге:** 230+
- **Алиасов:** 460+
- **Типов уведомлений:** 5
- **Уровней релевантности:** 8 (в scoring)
- **Время автосброса:** 10 секунд
- **Время на разработку:** Session 6 (12 частей)
- **Критических исправлений:** 8+

---

## 🔧 ИСТОРИЯ КРИТИЧЕСКИХ ИСПРАВЛЕНИЙ:

1. **Part 9:** Убрано копирование Twitch → VK в `handleSelect`
2. **Part 10:** Удалён `partial match` из `findMappedCategory` (КРИТИЧЕСКОЕ!)
3. **Part 10:** Добавлен API поиск в `handleCategorySelect`
4. **Part 11:** Система уведомлений (5 типов)
5. **Part 12:** Автосброс через 10 секунд

---

## ⚡ ПОСЛЕДСТВИЯ НАРУШЕНИЯ:

Если изменить защищённые файлы:

- ❌ Сломается синхронизация Twitch ↔ VK Live
- ❌ Категории не будут находиться
- ❌ Маппинг перестанет работать
- ❌ Пользователи получат неверные категории на VK
- ❌ API вернёт 400 ошибки
- ❌ Потребуется ПОЛНАЯ переработка (как в Session 6)

---

## 📞 КОНТАКТ ПРИ НЕОБХОДИМОСТИ ИЗМЕНЕНИЙ:

Если **КРИТИЧЕСКИ НЕОБХОДИМО** изменить защищённые файлы:

1. **Обсудите с владельцем проекта**
2. **Прочитайте ВСЮ документацию Session 6** (12 частей)
3. **Поймите ВСЮ логику** (893+ строк)
4. **Протестируйте на ВСЕХ сценариях:**
   - Twitch → VK (с маппингом)
   - Twitch → VK (без маппинга, точное совпадение)
   - VK → Twitch
   - Автосинхронизация (toggle)
   - Ручной выбор
   - Несохранённые изменения (автосброс)
   - Уведомления (5 типов)

---

## 📊 СТАТИСТИКА ЗАЩИЩЁННЫХ СИСТЕМ:

### TTS Система:
- **Файлов:** 8 (5 frontend + 3 backend)
- **Строк кода:** 2000+
- **Платформ:** 2 (Twitch, VK Live)
- **API endpoints:** 5+ (settings, engine, platform-settings, filtered-words, blocked-users)
- **Компонентов синхронизации:** 5
- **Статус:** ✅ Полностью рабочая и оптимизированная

### Система Категорий:
- **Файлов:** 5 (3 frontend + 2 backend)
- **Строк кода:** 900+ (главный компонент)
- **Категорий в маппинге:** 230+
- **Алиасов:** 460+
- **Типов уведомлений:** 5
- **Уровней релевантности:** 8 (в scoring)
- **Статус:** ✅ Полностью рабочая, мигрирована на TypeScript

### WebSocket Система:
- **Файлов:** 3 (1 frontend + 2 backend)
- **Строк кода:** 400+
- **Оптимизации:** Leader Election, BroadcastChannel, Heartbeat, Exponential Backoff
- **Статус:** ✅ Оптимизирована для production

### Система Производительности:
- **Оптимизаций:** 5 (code splitting, virtualization, memoization, connection pooling, async)
- **Улучшение load time:** < 3 seconds
- **Улучшение API response:** < 100ms
- **Статус:** ✅ Полностью оптимизирована

### Система Обработки Ошибок:
- **Компонентов:** 4 (error boundaries, API handler, exception handlers, logging)
- **Error boundaries:** 3 уровня (app, route, component)
- **Статус:** ✅ Comprehensive error handling

### Drops Система:
- **Файлов:** 3 (1 service + 1 API + 1 animation)
- **Строк кода:** 300+
- **Разделение:** Backend (calculation) + Frontend (animation)
- **Статус:** ✅ Secure server-side calculation

### Система Конфигурации:
- **Файлов:** 3 (1 config + 2 .env.example)
- **Строк кода:** 250+
- **Environment variables:** 40+
- **Validators:** 8+
- **Статус:** ✅ Централизована и валидируется

---

**ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ:** 15 ноября 2025  
**СТАТУС:** 🔒 ЗАЩИЩЕНО И ПРОВЕРЕНО

**ЗАЩИЩЕНО 7 СИСТЕМ:**
- ✅ TTS (Text-to-Speech) - базовая озвучка, настройки платформ, синхронизация, оптимизация
- ✅ Категории и названия стримов - умный поиск, маппинг, автосинхронизация (TypeScript)
- ✅ WebSocket - Leader Election, единое соединение, reconnection logic
- ✅ Производительность - code splitting, virtualization, database pooling
- ✅ Обработка ошибок - error boundaries, retry logic, structured logging
- ✅ Drops - server-side calculation, secure probability logic
- ✅ Конфигурация - environment variables, pydantic validation, security checks

**ЕСЛИ ВЫ AI РАЗРАБОТЧИК:**  
Сохраните этот файл в контекст и **НЕ ПРЕДЛАГАЙТЕ ИЗМЕНЕНИЯ** в защищённых файлах!

**ВАЖНЫЕ ИЗМЕНЕНИЯ (November 2025):**
- ✅ Все frontend файлы мигрированы на TypeScript (.tsx, .ts)
- ✅ Добавлены новые защищённые системы (WebSocket, Performance, Error Handling, Drops, Configuration)
- ✅ Обновлены пути файлов в соответствии с текущей структурой
- ✅ Удалены устаревшие файлы, которые больше не существуют
- ✅ Добавлена детальная статистика по каждой системе
- ✅ Все хардкоды заменены на environment variables
- ✅ Централизованная конфигурация через `core/config.py`

**УДАЛЁННЫЕ ФАЙЛЫ (больше не существуют):**
- ❌ `frontend/src/context/DataContext.jsx` - функциональность перенесена в другие компоненты
- ❌ `frontend/src/components/tts/TtsControlPanel.jsx` - заменён на TtsFilterManager.tsx

**ПЕРЕИМЕНОВАННЫЕ ФАЙЛЫ (TypeScript Migration):**
- 📝 `.jsx` → `.tsx` для всех React компонентов
- 📝 `.js` → `.ts` для всех utility файлов и констант

