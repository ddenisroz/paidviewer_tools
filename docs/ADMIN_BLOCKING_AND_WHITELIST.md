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

## 🚫 Комплексная блокировка пользователя

**Важно:** Блокировка пользователя и блокировка канала - это **одно и то же действие**.

Когда админ блокирует пользователя, система **автоматически**:

### **Что происходит при блокировке:**

1. **🔐 OAuth блокировка** (`User.is_blocked = True`)
   - Пользователь **не может войти** через Twitch/VK OAuth
   - При попытке входа видит: `"Account blocked: {reason}"`
   
2. **📺 Блокировка всех каналов** (`BlockedChannel`)
   - Все каналы пользователя (`twitch.tv/username`, `vk.com/username`) добавляются в черный список
   - **Гости** (включая владельца) **не могут подключиться** к каналам в гостевом режиме
   
3. **🤖 Отключение ботов**
   - Twitch бот покидает канал `twitch.tv/username`
   - VK бот отключается от `vk.com/username`

### **Два способа доступа к системе:**

| Способ | Как работает | Где блокируется |
|--------|--------------|-----------------|
| **🎭 Гостевой режим** | Ввел `twitch.tv/streamer` + проверочный код → подключился БЕЗ логина | `BlockedChannel` (гостевая блокировка) |
| **🔐 OAuth авторизация** | Вошел через Twitch/VK → полный доступ | `User.is_blocked` (OAuth блокировка) |

### **Проверки в коде:**

```python
# 1. OAuth блокировка (auth.py)
if session_data.get('is_blocked', False):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Account blocked: {session_data.get('blocked_reason')}"
    )

# 2. Гостевая блокировка (guest_api.py)
is_blocked, reason = is_channel_blocked(channel_name, db)
if is_blocked:
    raise HTTPException(
        status_code=403, 
        detail=f"Channel blocked: {reason}"
    )
```

**🔴 Итоговый эффект:** Пользователь **полностью лишен доступа** к системе любым способом.

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

### **Комплексная блокировка пользователей**

**Блокировка:**
```http
POST /api/admin/users/{user_id}/block?reason=Spam
```

**Ответ:**
```json
{
    "success": true,
    "message": "User 123 fully blocked",
    "details": {
        "oauth_blocked": true,
        "channels_blocked": [
            "twitch.tv/streamer123",
            "vk.com/streamer123"
        ],
        "bots_disconnected": [
            "Twitch: streamer123",
            "VK: streamer123"
        ],
        "reason": "Spam"
    }
}
```

**Разблокировка:**
```http
POST /api/admin/users/{user_id}/unblock
```

**Ответ:**
```json
{
    "success": true,
    "message": "User 123 fully unblocked",
    "details": {
        "oauth_unblocked": true,
        "channels_unblocked": [
            "twitch.tv/streamer123",
            "vk.com/streamer123"
        ]
    }
}
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

### **Блокировка каналов**

**Важно:** Отдельной вкладки "Блокировки" больше нет. Блокировка каналов выполняется через **управление пользователями**.

#### **Как заблокировать канал:**

**Вариант 1: Через блокировку пользователя (рекомендуется)**
1. Перейдите в админ-панель → Вкладка "Пользователи"
2. Найдите пользователя в таблице
3. Нажмите кнопку **🚫 Ban** (Оранжевая)
4. Укажите причину блокировки
5. Система автоматически:
   - Заблокирует пользователя (OAuth доступ)
   - Заблокирует все его каналы (гостевой режим)
   - Отключит ботов от каналов

**Вариант 2: Ручная блокировка через API (для редких случаев)**
```http
POST /api/admin/blocked-channels
Content-Type: application/json

{
    "channel_name": "spam_channel",
    "reason": "Spam"
}
```

**Примечание:** Ручная блокировка используется только для каналов без связанного пользователя (гостевой режим). В большинстве случаев рекомендуется блокировать пользователя через админ-панель.

---

## 📊 Сравнительная таблица

| Тип блокировки | Уровень | Таблица БД | Что блокирует | Как снять |
|----------------|---------|------------|---------------|-----------|
| **Комплексная блокировка пользователя** | 🔴 Критический | `User.is_blocked` + `BlockedChannel` | OAuth + Гостевой режим + Боты | `/api/admin/users/{id}/unblock` |
| **Ручная блокировка канала** | 🟡 Средний | `BlockedChannel` | Только гостевой режим | `/api/admin/blocked-channels/{id}` (DELETE) |
| **TTS блокировка зрителя** | 🟢 Низкий | `TTSBlockedUser` | TTS для конкретного зрителя на канале | Через настройки канала владельцем |
| **Системные боты** | 🔵 Автоматический | `BlockedBot` | TTS для ботов (Nightbot, etc.) | Через скрипт `init_blocked_bots.py` |

### **Когда что использовать:**

- **🔴 Комплексная блокировка** - нарушение ToS, спам, удаление аккаунта → **полное лишение доступа**
- **🟡 Блокировка канала** - проблемный канал, который используется для спама в гостевом режиме → **только гости заблокированы**
- **🟢 TTS блокировка** - надоедливый зритель → **только его сообщения не озвучиваются**
- **🔵 Блокировка ботов** - системные боты не должны озвучиваться → **автоматически**

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

| Система | Назначение | Управление | Что делает |
|---------|-----------|------------|------------|
| **Комплексная блокировка пользователя** | Полный запрет доступа | Админ панель → Пользователи → 🚫 | OAuth + Гостевой режим + Отключение ботов |
| **Ручная блокировка канала** | Запрет гостевого режима | API `/api/admin/blocked-channels` (для редких случаев) | Только гостевой доступ |
| **TTS блокировка зрителя** | Запрет озвучки для зрителя | Настройки канала владельцем | Только TTS |
| **Блокировка системных ботов** | Запрет озвучки ботов | Автоматически (скрипт) | Только TTS для ботов |
| **Whitelist** | Доступ к AI TTS и загрузке голосов | Админ панель → Пользователи → ✅ | F5-TTS + Upload |

### **Ключевые моменты:**

- **Гость** = любой пользователь (включая владельца), который вводит название канала + проверочный код БЕЗ OAuth
- **Комплексная блокировка** = одновременно блокирует OAuth, гостевой режим и отключает ботов
- **Ручная блокировка канала** = блокирует только гостевой режим (владелец может войти через OAuth)
- **Whitelist** = доступ к AI TTS (F5-TTS), без него fallback на gTTS

---

**Документация обновлена:** 2025-01-09 ✅  
**Версия:** 2.1.0 (Упрощенная админка - блокировки через управление пользователями)

