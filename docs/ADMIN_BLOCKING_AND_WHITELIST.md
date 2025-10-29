# 🛡️ Система блокировки и Whitelist

**Версия:** 1.0.0  
**Дата:** 29.10.2025  
**Статус:** ✅ Актуально

---

## 📋 Оглавление

1. [Уровни блокировки пользователей](#уровни-блокировки-пользователей)
2. [Whitelist система](#whitelist-система)
3. [Заблокированные боты](#заблокированные-боты)
4. [API Endpoints](#api-endpoints)
5. [Использование в админ панели](#использование-в-админ-панели)

---

## 🚫 Уровни блокировки пользователей

Система имеет **3 независимых уровня блокировки**, каждый на своем уровне абстракции:

### **Уровень 1: Блокировка доступа (Самый строгий)** 🔐

- **Таблица БД:** `User.is_blocked`
- **Где проверяется:** `bot_service/auth/auth.py`
- **Что блокирует:** Полный доступ к системе
- **Когда применяется:**
  - Нарушение правил пользования
  - Запрос на удаление аккаунта (`blocked_reason = "account_deleted"`)
  - Ручная блокировка администратором

```python
# auth.py
if session_data.get('is_blocked', False):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User is blocked"
    )
```

**🔴 Эффект:** Пользователь **не может войти** в систему вообще.

---

### **Уровень 2: Блокировка канала** 📺

- **Таблица БД:** `BlockedChannel`
- **Где проверяется:** `bot_service/api/guest_api.py`
- **Что блокирует:** Подключение гостевого режима к конкретному каналу
- **Когда применяется:**
  - Канал спамит
  - Канал нарушает ToS
  - Ручная блокировка администратором

```python
# guest_api.py
is_blocked, reason = is_channel_blocked(channel_name, db)
if is_blocked:
    raise HTTPException(
        status_code=403, 
        detail=f"Channel blocked: {reason}"
    )
```

**🟡 Эффект:** Нельзя подключиться к **конкретному каналу** в гостевом режиме. Владелец канала может войти.

---

### **Уровень 3: Блокировка TTS для пользователя** 🎤

- **Таблица БД:** `TTSBlockedUser`
- **Где проверяется:** `bot_service/utils/websocket_helper.py`
- **Что блокирует:** TTS (озвучку) для конкретного пользователя на канале
- **Когда применяется:**
  - Владелец канала блокирует конкретного зрителя от TTS
  - Пользователь спамит TTS

```python
# websocket_helper.py
is_blocked = db.query(TTSBlockedUser).filter(
    TTSBlockedUser.user_id == user_id,
    TTSBlockedUser.username == username.lower(),
    TTSBlockedUser.platform == platform
).first()

if is_blocked:
    logger.info(f"⛔ User {username} is blocked from TTS by owner")
    return
```

**🟢 Эффект:** Пользователь **не будет озвучен** на канале, но может смотреть стрим и писать в чат.

---

### **Дополнительно: Заблокированные боты** 🤖

- **Таблица БД:** `BlockedBot`
- **Где проверяется:** `bot_service/utils/websocket_helper.py`
- **Что блокирует:** TTS для системных ботов (Nightbot, StreamElements, etc.)
- **Список:**
  - `payedviewer` (наш бот)
  - `streamelements`
  - `nightbot`
  - `streamlabs`
  - `moobot`
  - `fossabot`
  - и другие...

```python
is_blocked_bot = db.query(BlockedBot).filter(
    func.lower(BlockedBot.bot_name) == username.lower()
).first()

if is_blocked_bot:
    logger.debug(f"🤖 Bot {username} is in blocked list, skipping TTS")
    return {"success": False, "error": "Bot is blocked from TTS"}
```

---

## ✅ Whitelist система

**Whitelist** используется для предоставления **привилегированного доступа** к функциям системы.

### **Что дает Whitelist:**

| Функция | Доступ без Whitelist | Доступ с Whitelist |
|---------|---------------------|-------------------|
| **Базовая TTS (gTTS)** | ✅ Доступно | ✅ Доступно |
| **AI TTS (F5-TTS)** | ❌ Fallback на gTTS | ✅ Полный доступ |
| **Загрузка голосов** | ❌ Запрещено | ✅ Разрешено |

### **Как работает:**

1. **Проверка в `websocket_helper.py`:**

```python
if use_ai_tts:
    is_whitelisted = False
    
    # Проверяем Twitch
    if channel_owner.twitch_username:
        twitch_whitelisted = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == channel_owner.twitch_username.lower()
        ).first()
        is_whitelisted = bool(twitch_whitelisted)
    
    # Проверяем VK
    if not is_whitelisted and channel_owner.vk_username:
        vk_whitelisted = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == channel_owner.vk_username.lower()
        ).first()
        is_whitelisted = bool(vk_whitelisted)
    
    # Fallback на gTTS если не в whitelist
    if not is_whitelisted:
        logger.warning(f"⚠️ User not in whitelist, falling back to gTTS")
        use_ai_tts = False
```

2. **Проверка при загрузке голосов в `tts_api.py`:**

```python
# Проверяем whitelist
is_whitelisted = False

if db_user.twitch_username:
    twitch_whitelisted = db.query(WhitelistedChannel).filter(
        WhitelistedChannel.channel_name == db_user.twitch_username.lower()
    ).first()
    is_whitelisted = bool(twitch_whitelisted)

if not is_whitelisted and db_user.vk_username:
    vk_whitelisted = db.query(WhitelistedChannel).filter(
        WhitelistedChannel.channel_name == db_user.vk_username.lower()
    ).first()
    is_whitelisted = bool(vk_whitelisted)

return {"is_whitelisted": is_whitelisted, "can_manage_voices": is_whitelisted}
```

---

## 🎯 API Endpoints

### **Блокировка пользователей**

```http
POST /api/admin/users/{user_id}/block
Content-Type: application/json

{
    "reason": "Spam"
}
```

```http
POST /api/admin/users/{user_id}/unblock
```

### **Whitelist управление**

```http
POST /api/admin/whitelist/add
Content-Type: application/json

{
    "username": "channelname",
    "platform": "twitch"  // или "vk"
}
```

```http
GET /api/admin/whitelist
```

```http
DELETE /api/admin/whitelist/{username}
```

### **Заблокированные каналы**

```http
GET /api/admin/blocked-channels
```

```http
POST /api/admin/blocked-channels
Content-Type: application/json

{
    "channel_name": "spam_channel",
    "reason": "Spam"
}
```

```http
DELETE /api/admin/blocked-channels/{channel_id}
```

---

## 🖥️ Использование в админ панели

### **Страница: Пользователи** (`/dashboard/dolbaebadmintts` → Вкладка "Пользователи")

#### **Действия с пользователями:**

| Кнопка | Иконка | Цвет | Действие |
|--------|--------|------|----------|
| **Редактировать** | ✏️ Edit | Серая | Изменить роль (админ/юзер) |
| **Whitelist Toggle** | ✅/❌ UserCheck/UserX | Синяя/Зеленая | Добавить/Удалить из whitelist |
| **Блокировать** | 🚫 Ban | Оранжевая | Заблокировать/Разблокировать доступ |
| **Удалить** | 🗑️ Trash2 | Красная | Удалить пользователя (помечает как `is_blocked=True`) |

#### **Фильтры:**

- **Поиск:** По ID, Twitch, VK username
- **Роль:** Все / Админы / Пользователи
- **Статус:** Все / Активные / Заблокированные
- **Интеграции:** Все / Twitch / VK / Без интеграций
- **Whitelist:** Все / В whitelist / Не в whitelist

#### **Добавление в whitelist:**

1. Нажмите `+ Добавить в whitelist`
2. Введите название канала (Twitch или VK)
3. Нажмите `Добавить`

**Или:**

1. В таблице пользователей найдите нужного юзера
2. Нажмите синюю кнопку **UserCheck** (✅)
3. Пользователь будет добавлен в whitelist (кнопка станет зеленой ❌)

---

### **Страница: Блокировки** (`/dashboard/dolbaebadmintts` → Вкладка "Блокировки")

#### **Что это:**

Черный список каналов, которым **запрещено** подключение в гостевом режиме.

#### **Добавление канала:**

1. Введите название канала в поле
2. Нажмите `Заблокировать`
3. Канал добавлен в черный список

#### **Удаление канала:**

1. Найдите канал в списке
2. Нажмите `Разблокировать`

---

## 📊 Сравнительная таблица

| Тип блокировки | Уровень | Таблица БД | Что блокирует | Как снять |
|----------------|---------|------------|---------------|-----------|
| **User Block** | 🔴 Высокий | `User.is_blocked` | Вход в систему | `/api/admin/users/{id}/unblock` |
| **Channel Block** | 🟡 Средний | `BlockedChannel` | Гостевой режим | `/api/admin/blocked-channels/{id}` (DELETE) |
| **TTS Block** | 🟢 Низкий | `TTSBlockedUser` | TTS для юзера | Через настройки канала |
| **Bot Block** | 🔵 Системный | `BlockedBot` | TTS для ботов | Через скрипт `init_blocked_bots.py` |

---

## 🔍 Логи и отладка

### **Проверка блокировки:**

```python
# Уровень 1: User blocked
logger.error(f"❌ [AUTH] User {user_id} is blocked")

# Уровень 2: Channel blocked
logger.warning(f"🚫 Blocked channel attempted: {channel_name} (reason: {reason})")

# Уровень 3: TTS blocked
logger.info(f"⛔ User {username} is blocked from TTS by owner")

# Bot blocked
logger.debug(f"🤖 Bot {username} is in blocked list, skipping TTS")
```

### **Проверка whitelist:**

```python
# Не в whitelist - fallback на gTTS
logger.warning(f"⚠️ User {user_id} not in whitelist, falling back to gTTS")

# В whitelist - используем AI TTS
logger.info(f"✅ User {username} whitelisted on {platform}")
```

---

## ✅ Итоги

| Система | Назначение | Управление |
|---------|-----------|------------|
| **Блокировка пользователя** | Запрет доступа к системе | Админ панель → Пользователи → 🚫 |
| **Блокировка канала** | Запрет гостевого режима | Админ панель → Блокировки |
| **Блокировка TTS** | Запрет озвучки для юзера | Настройки канала |
| **Блокировка ботов** | Запрет озвучки системных ботов | Автоматически (скрипт) |
| **Whitelist** | Доступ к AI TTS и загрузке голосов | Админ панель → Пользователи → ✅ |

---

**Документация обновлена:** 29.10.2025 ✅

