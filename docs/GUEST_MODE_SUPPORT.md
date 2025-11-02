# 👥 Поддержка гостевого режима

**Версия:** 1.1  
**Дата:** 27 октября 2025  
**Обновлено:** 2 ноября 2025  
**Статус:** ✅ Полностью реализовано

---

## 📋 Что такое гостевой режим?

Гостевой режим позволяет пользователям **тестировать бота БЕЗ регистрации** через Twitch/VK OAuth. Гости получают временную сессию и могут использовать базовые функции TTS.

### Создание гостевой сессии

1. Пользователь открывает `/guest`
2. Выбирает платформу (Twitch или VK)
3. Вводит 6-значный код верификации в чате
4. Получает `session_id` (например: `guest_abc123def456`)
5. Сессия сохраняется в `SessionManager` с `user_id = -1`

---

## ✅ Что РАБОТАЕТ для гостей

### 1. **TTS Озвучка** ✅

**Статус:** Полностью поддерживается

**Что доступно:**
- ✅ Базовая TTS озвучка (gTTS)
- ✅ Настройки TTS (`TTSUserSettings` с `session_id`)
- ✅ Выбор голоса (`voice`)
- ✅ Режим прослушивания (`listening_mode`: website/obs)
- ✅ Платформы для озвучки (`enabled_platforms`)
- ✅ Фильтры эмодзи и смайлов
- ✅ Громкость (website/obs)
- ✅ Блокировка пользователей (`BlockedUser` с `session_id`)
- ✅ Фильтр слов (`FilteredWord` с `session_id`)

**Технические детали:**
- `TTSUserSettings.session_id` создается автоматически при верификации
- `UserSettings.session_id` создается для хранения базовых настроек
- TTS синтез использует `UserIdentityService` для определения типа пользователя

**Примеры:**
```python
# Гостевая сессия в БД
session_id = "guest_abc123"
tts_settings = TTSUserSettings(
    session_id=session_id,
    engine='gtts',
    voice='female_1',
    listening_mode='website',
    enabled_platforms=['twitch', 'vk']
)
```

---

### 2. **YouTube Очередь** ✅

**Статус:** Полностью поддерживается

**Что доступно:**
- ✅ Добавление видео в очередь
- ✅ Просмотр очереди
- ✅ Удаление видео из очереди
- ✅ Индивидуальная очередь для каждого гостя (по `session_id`)

**Технические детали:**
- `YouTubeQueue` поддерживает `session_id` для гостей
- `/api/youtube/queue/add` использует `get_current_user_optional`
- `/api/youtube/queue` работает для гостей
- Миграция очереди при авторизации (перенос в `user_id`)

**Примеры:**

---

### 3. **Команды бота** ✅

**Статус:** Частично поддерживается (только просмотр)

**Что доступно:**
- ✅ Просмотр **глобальных команд** (`/api/commands`)
- ✅ Использование команд в чате (!help, !sr, !game, !title)
- ✅ Команды работают на канале гостя

**Что НЕ доступно:**
- ❌ Создание кастомных команд (требует авторизацию)
- ❌ Создание user overrides (требует авторизацию)
- ❌ Просмотр своих кастомных команд (их нет)

**Технические детали:**
- `/api/commands` использует `get_current_user_optional`
- Для гостей `is_guest = (user_id == -1 or user_id is None)`
- Возвращает только `global_commands`, остальные массивы пустые

**Примеры:**
```json
// GET /api/commands (гость)
{
  "success": true,
  "global_commands": [
    {"command_name": "help", "description": "..."},
    {"command_name": "sr", "description": "..."}
  ],
  "override_commands": [],
  "basic_commands": [...], // merged global
  "custom_commands": []
}
```

---

### 4. **Локальный TTS (F5-TTS)** ✅

**Статус:** Полностью поддерживается

**Что доступно:**
- ✅ Настройка локального TTS endpoint (`/api/local-tts/config`)
- ✅ Тестирование подключения (`/api/local-tts/test-connection`)
- ✅ Управление голосами (создание, загрузка сэмплов, удаление)
- ✅ **НЕТ whitelist requirement для гостей** (в отличие от авторизованных)
- ✅ Хранение конфига по `session_id`

**Технические детали:**
- `LocalTTSEndpoint` теперь поддерживает `session_id`
- БД constraint: `(user_id XOR session_id)` - один из двух должен быть заполнен
- Миграция: `0c8f9a3b4d2e_add_session_id_to_local_tts_endpoints.py`

**Примеры:**
```python
# Конфиг локального TTS для гостя
config = LocalTTSEndpoint(
    session_id="guest_abc123",
    endpoint_url="http://localhost:8001",
    api_key="optional_key",
    use_local=True,
    is_active=True
)
```

**Страница UI:** `/dashboard/tts/local`

---

### 5. **DonationAlerts интеграция** ✅

**Статус:** Полностью поддерживается

**Что доступно:**
- ✅ Подключение DonationAlerts через OAuth
- ✅ Получение донатов в реальном времени
- ✅ Обработка webhook событий
- ✅ Хранение токенов по `session_id`

**Технические детали:**
- `UserToken` поддерживает `session_id` для гостей
- OAuth callback работает для гостей и авторизованных пользователей
- Миграция токенов при авторизации (`convert_guest_to_authenticated`)
- Миграция: `ea7fa0815699_add_session_id_to_user_tokens_for_guests.py`

**Примеры:**
```python
# Токен DonationAlerts для гостя
token = UserToken(
    session_id="guest_abc123",
    platform="donationalerts",
    access_token="...",
    platform_user_id="12345"
)
```

---

### 6. **Drops система лояльности** ✅

**Статус:** Полностью поддерживается

**Что доступно:**
- ✅ Настройка системы Drops (стрик, донат, мифический лутбокс)
- ✅ Управление наградами (Common, Rare, Epic, Legendary, Mythical)
- ✅ История получения наград
- ✅ OBS виджет для анимации открытия сундуков
- ✅ Миграция всех настроек при авторизации

**Технические детали:**
- Все модели Drops поддерживают `session_id`: `DropsConfig`, `DropsReward`, `UserStreak`, `DropsHistory`, `MythicalDropsSession`
- `DropsService` методы принимают `user_id` и `session_id`
- Миграция настроек при конвертации гостя в авторизованного
- Миграция: `4fe4104541d9_add_session_id_to_drops_tables_for_guests.py`

**Примеры:**
```python
# Конфигурация Drops для гостя
config = DropsConfig(
    session_id="guest_abc123",
    channel_name="my_channel",
    platform="twitch",
    streak_enabled=True,
    donation_enabled=True,
    mythical_enabled=True
)
```

**Страница UI:** `/dashboard/drops`

---

## ❌ Что НЕ РАБОТАЕТ для гостей

### 1. **Управление стримом** ❌

**Статус:** Намеренно не поддерживается

**Почему:**
- Команды `!game` и `!title` требуют доступ к API платформы
- У гостей нет OAuth токенов для Twitch/VK
- Нет канала для управления

**Альтернатива:** Нет (это логично)

---

### 3. **Создание кастомных команд** ❌

**Статус:** Намеренно не поддерживается

**Почему:**
- Кастомные команды привязаны к `user_id`
- У гостей `user_id = -1` (специальное значение)
- После окончания сессии команды были бы бесполезны

**Альтернатива:** Авторизуйтесь через Twitch/VK для создания команд

---

## 🔧 Технические детали

### Определение гостя в коде

```python
# Backend
is_guest = (not user or user.get('id') == -1)
user_id = user.get('id') if user and user.get('id') != -1 else None
session_id = user.get('session_id') if is_guest and user else None

# Frontend
const isGuest = !user || user.id === -1;
```

### Authentication Dependency

**Для endpoints, доступных гостям:**
```python
from auth.auth import get_current_user_optional

@router.get("/something")
async def endpoint(
    user: dict = Depends(get_current_user_optional)
):
    is_guest = (not user or user.get('id') == -1)
    # ...
```

**Для endpoints, требующих авторизацию:**
```python
from auth.auth import get_current_user

@router.post("/something")
async def endpoint(
    user: dict = Depends(get_current_user)  # Raises 401 for guests
):
    # ...
```

### Модели БД с поддержкой гостей

1. **`UserSettings`** ✅
   - `user_id` (nullable) для авторизованных
   - `session_id` (nullable) для гостей
   - Constraint: `(user_id XOR session_id)`

2. **`TTSUserSettings`** ✅
   - `user_id` (nullable) для авторизованных
   - `session_id` (nullable) для гостей
   - Constraint: `(user_id XOR session_id)`

3. **`LocalTTSEndpoint`** ✅
   - `user_id` (nullable) для авторизованных
   - `session_id` (nullable) для гостей
   - Constraint: `(user_id XOR session_id)`

4. **`BlockedUser`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

5. **`FilteredWord`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

6. **`TTSBlockedUser`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

7. **`YouTubeQueue`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

8. **`UserToken`** ✅ (DonationAlerts и др.)
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`
   - Миграция: `ea7fa0815699_add_session_id_to_user_tokens_for_guests.py`

9. **`DropsConfig`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

10. **`DropsReward`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

11. **`UserStreak`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`
   - Unique constraints: `uq_user_streak`, `uq_session_streak`

12. **`DropsHistory`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

13. **`MythicalDropsSession`** ✅
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)`

14. **`BotCommand`** ✅ (user overrides)
   - `user_id` (nullable)
   - `session_id` (nullable)
   - Constraint: `(user_id XOR session_id)` (если добавлена поддержка)

**Миграции для гостей:**
- `0c8f9a3b4d2e_add_session_id_to_local_tts_endpoints.py`
- `20251101_add_session_id_to_guest_tables.py` (FilteredWord, TTSBlockedUser, YouTubeQueue)
- `ea7fa0815699_add_session_id_to_user_tokens_for_guests.py` (UserToken для DonationAlerts)
- `4fe4104541d9_add_session_id_to_drops_tables_for_guests.py` (Drops models)

---

## 📊 Сравнительная таблица

| Фича | Авторизованный пользователь | Гость |
|------|----------------------------|-------|
| TTS озвучка | ✅ | ✅ |
| Базовые настройки TTS | ✅ | ✅ |
| Локальный TTS (F5) | ✅ (whitelist) | ✅ (всегда) |
| Просмотр глобальных команд | ✅ | ✅ |
| Использование команд в чате | ✅ | ✅ |
| Создание кастомных команд | ✅ (макс. 5) | ❌ |
| User overrides команд | ✅ | ❌ |
| YouTube очередь | ✅ | ✅ |
| DonationAlerts интеграция | ✅ | ✅ |
| Drops система лояльности | ✅ | ✅ |
| Управление стримом (!game, !title) | ✅ | ❌ |
| Сохранение настроек | ✅ (постоянно) | ✅ (до конца сессии) |
| Миграция настроек при авторизации | N/A | ✅ |

---

## 🚀 Как использовать гостевой режим

### Для пользователя:

1. Откройте `/guest`
2. Выберите платформу (Twitch или VK)
3. Введите 6-значный код в чате выбранной платформы
4. После верификации вы попадете на `/dashboard`
5. Настройте TTS, локальный движок, проверьте команды
6. Используйте бота для тестирования!

### Ограничения:

- ⏰ Сессия временная (пока браузер открыт)
- 💾 Настройки не сохраняются после закрытия браузера (можно сохранить в localStorage если реализовать)
- 🚫 Нельзя стримить (нет OAuth токенов)
- 🚫 Нельзя создавать кастомные команды

---

## 🛠️ Миграции

**Все миграции для гостей:**
```
0c8f9a3b4d2e_add_session_id_to_local_tts_endpoints.py
20251101_add_session_id_to_guest_tables.py
ea7fa0815699_add_session_id_to_user_tokens_for_guests.py
4fe4104541d9_add_session_id_to_drops_tables_for_guests.py
```

**Что делают:**
- Добавляют `session_id` в модели (LocalTTSEndpoint, FilteredWord, TTSBlockedUser, YouTubeQueue, UserToken, DropsConfig, DropsReward, UserStreak, DropsHistory, MythicalDropsSession)
- Делают `user_id` nullable
- Добавляют check constraint для XOR (user_id XOR session_id)
- Создают индексы на `session_id`

---

## 📝 Рекомендации для разработчиков

### При добавлении новой фичи:

1. **Определите:** Должна ли фича работать для гостей?
   - ✅ **Да:** Если это базовая функция, не требующая OAuth
   - ❌ **Нет:** Если требуется OAuth, управление стримом, или постоянное хранение

2. **Если да:**
   - Используйте `get_current_user_optional` в endpoint
   - Добавьте `session_id` в модель БД (если нужно хранение)
   - Добавьте check constraint `(user_id XOR session_id)`
   - Обработайте оба случая в коде

3. **Если нет:**
   - Используйте `get_current_user` (вернет 401 для гостей)
   - Покажите сообщение в UI: "Требуется авторизация"

### Тестирование гостевого режима:

```bash
# 1. Создать гостевую сессию
POST /api/guest/start

# 2. Верифицировать через чат (6 цифр)
# В Twitch чате: 123456

# 3. Финализировать
POST /api/guest/finalize

# 4. Проверить доступность endpoints
GET /api/commands  # должно работать
GET /api/local-tts/config  # должно работать
POST /api/youtube/queue/add  # НЕ должно работать (нет канала)
```

---

## 🎁 Преимущества гостевого режима

✅ **Низкий порог входа** - не нужно регистрироваться  
✅ **Быстрое тестирование** - сразу попробовать TTS  
✅ **Локальный TTS** - можно настроить свой F5-TTS без whitelist  
✅ **Команды работают** - можно вызывать базовые команды  
✅ **Безопасность** - гости не могут изменять глобальные настройки  

---

## 🔗 Связанная документация

- **Гостевой API:** `bot_service/api/guest_api.py`
- **Session Manager:** `bot_service/core/session_manager.py`
- **Авторизация:** `docs/SECURITY_LOGIC.md`
- **Команды:** `docs/UNIFIED_COMMANDS.md`
- **Локальный TTS:** `tts_service_simple/README.md`

---

**Автор:** AI Agent (Session 8, 27.10.2025)  
**Обновлено:** 2 ноября 2025 (добавлена поддержка DonationAlerts и Drops для гостей)  
**Проверено:** ✅ Код протестирован, миграции применены, документировано

