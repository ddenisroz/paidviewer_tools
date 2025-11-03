# Объяснение: admin_users таблица и VK username проблема

## 🔴 **КРИТИЧЕСКАЯ ВАЖНОСТЬ `vk_username` ДЛЯ ЧАТА VK LIVE**

⚠️ **ВНИМАНИЕ**: `vk_username` используется НЕ ТОЛЬКО для отображения, но и для **подключения бота к чату**!

### 🚨 Почему `vk20416992` НЕ РАБОТАЕТ:

**Цепочка подключения бота к чату:**

1. **OAuth callback** (после авторизации) → сохраняет `vk_username` в БД
2. **Auto-connect bot** в `oauth_handler.py:371-372`:
   ```python
   # Для Twitch используем username вместо ID
   channel_identifier = user_data.username if user_data.username else user_data.platform_user_id
   await self._auto_connect_bot(platform, channel_identifier)
   ```
   - Передает `"vk20416992"` (НЕПРАВИЛЬНО!) или `"yourchy"` (ПРАВИЛЬНО!)

3. **VK Live Bot** → вызывает:
   ```python
   await vk_live_bot.connect_to_channel("vk20416992")  # ← Использует username из БД!
   ```

4. **WebSocket Client** → подписывается на канал:
   ```python
   await self.ws_client.subscribe_to_channel("vk20416992")
   # Форматы канала:
   # - api-channel-chat:vk20416992
   # - chat:vk20416992
   # - vk20416992
   ```

5. **VK Live API** → ожидает НИК (`yourchy`), а не ID (`vk20416992`)!
   - ❌ `api-channel-chat:vk20416992` → **НЕ СУЩЕСТВУЕТ** → чат НЕ работает
   - ✅ `api-channel-chat:yourchy` → **СУЩЕСТВУЕТ** → чат работает

### 🎯 Вывод:

| Username в БД | Подключение к каналу | Результат |
|--------------|---------------------|-----------|
| `vk20416992` | `api-channel-chat:vk20416992` | ❌ **НЕ РАБОТАЕТ** (канал не найден) |
| `yourchy` | `api-channel-chat:yourchy` | ✅ **РАБОТАЕТ** (чат читается) |

### ✅ Решение:

**Для новых пользователей**: Код уже исправлен - теперь используется поле `nick` из VK Live API.

**Для существующих пользователей**: ТРЕБУЕТСЯ ПЕРЕАВТОРИЗАЦИЯ!
1. Отключите VK Live интеграцию в UI
2. Переподключите VK Live (новая авторизация OAuth)
3. Username обновится на правильный (`yourchy` вместо `vk20416992`)
4. Бот автоматически подключится к правильному каналу

---

## 📊 Проблема #1: Зачем нужна таблица `admin_users`?

### Две разные концепции админов:

| Таблица | Назначение | Область действия |
|---------|-----------|------------------|
| **`users.is_admin`** | Владелец/админ **всего приложения** | Глобальный доступ ко всем функциям: настройки системы, управление пользователями, база данных |
| **`admin_users`** | Модераторы/админы **на конкретных платформах** | Управление чатом только на своей платформе (Twitch/VK): бан пользователей, модерация сообщений |

### Структура `admin_users`:

```python
class AdminUser(Base):
    """Модель администраторов системы"""
    __tablename__ = 'admin_users'
    
    id = Column(Integer, primary_key=True)
    platform = Column(String, nullable=False)        # 'twitch', 'vk', etc.
    platform_user_id = Column(String, nullable=False) # ID пользователя на платформе
    username = Column(String, nullable=True)          # Имя пользователя на платформе
    is_active = Column(Boolean, default=True)         # Активен ли админ
    permissions = Column(JSON, nullable=True)         # Дополнительные права
    created_by = Column(Integer, ForeignKey('users.id'))  # Кто создал админа
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

### Примеры использования:

1. **Владелец приложения** (`users.is_admin = True`):
   - Может изменять глобальные настройки
   - Управляет всеми интеграциями
   - Видит все логи и аналитику
   - Полный доступ к базе данных

2. **Модератор Twitch канала** (`admin_users` с `platform='twitch'`):
   - Может банить пользователей в Twitch чате
   - Управляет фильтрами слов для Twitch
   - НЕ может изменять настройки VK

3. **Модератор VK Live канала** (`admin_users` с `platform='vk'`):
   - Может банить пользователей в VK чате
   - Управляет фильтрами слов для VK
   - НЕ может изменять настройки Twitch

### ⚠️ Текущая проблема:

**Таблица `admin_users` существует, но НЕ ИСПОЛЬЗУЕТСЯ!**

Код проверяет только `users.is_admin`:
- ❌ Модераторы из `admin_users` не могут банить пользователей
- ❌ Права из `admin_users.permissions` игнорируются
- ❌ Функционал платформенных админов не реализован

### ✅ Решение:

**Вариант 1: Удалить таблицу** (если не планируется функционал модераторов)
```python
# Удалить класс AdminUser из database.py
# Создать миграцию: alembic revision -m "remove_admin_users"
```

**Вариант 2: Реализовать функционал** (если нужны модераторы)
```python
# 1. Создать middleware для проверки platform-админов
# 2. Добавить UI для управления модераторами
# 3. Использовать в ban/timeout endpoints
```

---

## 📊 Проблема #2: `vk_username` остается `None`

### Root Cause:

VK Live API **НЕ ВОЗВРАЩАЕТ** username в user info!

### Что происходит сейчас:

```570:215:bot_service/auth/vk_auth.py
vk_username = (
    user_info.get("login") or 
    user_info.get("username") or 
    user_info.get("screen_name") or
    None
)
```

**Проблема**: VK Live API возвращает только:
```json
{
    "id": "20416992",
    "avatar_url": "https://images.live.vkvideo.ru/user/20416992/avatar?change_time=1741367499"
}
```

❌ Нет поля `login`  
❌ Нет поля `username`  
❌ Нет поля `screen_name`

### Почему это происходит:

VK Live API (в отличие от основного VK API) не предоставляет username в `/me` endpoint.

Возможные причины:
1. VK Live API минималистичный и возвращает только базовую информацию
2. Username может быть доступен через другой endpoint
3. Username может быть в токене или дополнительных scopes

### ✅ Решение: Использовать поле "nick" из VK Live API!

**Согласно официальной документации VK Live API:**

Endpoint: `GET /v1/current_user`

Возвращает:
```json
{
  "data": {
    "user": {
      "id": 0,
      "nick": "yourchy",        ← ЭТО И ЕСТЬ USERNAME!
      "avatar_url": "string",
      "nick_color": 0,
      "is_streamer": true,
      "is_verified_streamer": true
    },
    "channel": {
      "url": "https://live.vkvideo.ru/yourchy"
    }
  }
}
```

**Исправленный код:**
```python
# bot_service/auth/vk_auth.py (строки 217-236)

vk_username = (
    user_info.get("nick") or          # ← ПРАВИЛЬНОЕ ПОЛЕ!
    user_info.get("login") or         # Fallback (legacy)
    user_info.get("username") or      # Fallback (legacy)
    user_info.get("screen_name") or   # Fallback (legacy)
    None
)

if vk_username:
    logger.info(f"✅ Extracted VK username from API: {vk_username}")
    # Проверяем что это не ID (если вдруг API вернет ID в nick)
    if vk_username.isdigit():
        logger.warning(f"⚠️ VK nick is numeric ({vk_username}), using fallback")
        vk_username = f"vk{platform_user_id}"
else:
    # VK Live API не вернул username, используем ID как fallback
    vk_username = f"vk{platform_user_id}"
    logger.warning(f"⚠️ VK API returned user_info without nick: {user_info}")
```

**Преимущества:**
- ✅ Использует официальное поле из документации
- ✅ Не требует дополнительных API запросов
- ✅ Возвращает настоящий username (например, "yourchy")
- ✅ Соответствует URL канала (`https://live.vkvideo.ru/yourchy`)
- ✅ Fallback на `vk{id}` на случай если API не вернет nick

---

## 🔧 Рекомендованные исправления:

### 1. ✅ ИСПРАВЛЕНО: VK username теперь использует поле "nick"

```python
# bot_service/auth/vk_auth.py (строки 217-236)

vk_username = (
    user_info.get("nick") or          # ← ИСПРАВЛЕНО! Теперь первым проверяется nick
    user_info.get("login") or 
    user_info.get("username") or 
    user_info.get("screen_name") or
    None
)

if vk_username:
    # Проверка на числовой nick
    if vk_username.isdigit():
        vk_username = f"vk{platform_user_id}"
else:
    vk_username = f"vk{platform_user_id}"  # Fallback
```

### 2. ⚠️ Для существующих пользователей: ПЕРЕАВТОРИЗАЦИЯ

**Скрипт для проверки:**
```bash
cd bot_service/scripts
python check_vk_usernames.py
```

**Если username = `vk{id}`:**
1. Перезапустите backend
2. Отключите VK Live интеграцию в UI
3. Переподключите VK Live (новая авторизация)
4. Username обновится на правильный (например, "yourchy")

### 3. ⚠️ TODO: Очистить устаревшую таблицу admin_users

Таблица существует но не используется. Рекомендуется удалить:

```bash
cd bot_service
alembic revision -m "remove_unused_admin_users_table"
```

В миграции:
```python
def upgrade():
    op.drop_table('admin_users')

def downgrade():
    # Recreate table if needed
    pass
```

---

## 📝 Итог:

| Проблема | Статус | Решение |
|----------|--------|---------|
| **admin_users не используется** | ⚠️ Техдолг | Удалить или реализовать функционал |
| **vk_username = None** | 🔴 Критично | Использовать fallback `vk{id}` |
| **Нет логов VK user_info** | ⚠️ Отладка | Добавить детальное логирование |


