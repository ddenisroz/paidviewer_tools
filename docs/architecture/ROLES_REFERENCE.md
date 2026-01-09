# 🎭 Справочник ролей платформ

**Дата:** 27 октября 2025  
**Версия:** 1.0

---

## 📋 Обзор

Система команд поддерживает роли для двух платформ: **Twitch** и **VK Live**.  
Роли используются для ограничения доступа к командам.

---

## 🟣 Twitch API Roles

Источник: [TwitchIO Documentation](https://twitchio.dev/)

| Роль | API Поле | Описание | Приоритет |
|------|----------|----------|-----------|
| **broadcaster** | `author.is_broadcaster` | Владелец канала | 🔴 Высший |
| **moderator** | `author.is_mod` | Модератор канала | 🟠 Высокий |
| **vip** | `author.is_vip` | VIP статус | 🟡 Средний |
| **subscriber** | `author.is_subscriber` | Подписчик канала | 🟢 Низкий |
| **founder** | `author.badges` (проверка) | Founder badge | 🟢 Низкий |
| **viewer** | По умолчанию | Обычный зритель | ⚪ Базовый |

### Дополнительные проверки:
```python
# Broadcaster также определяется по имени
if author.name.lower() == channel_name.lower():
    roles.append('broadcaster')
```

---

## 🔵 VK Live API Roles

Источник: [VK Streaming API](https://dev.vk.com/ru/api/streaming)

| Роль | API Поле | Описание | Приоритет |
|------|----------|----------|-----------|
| **owner** | `is_owner` | Владелец стрима | 🔴 Высший |
| **moderator** | `is_moderator` | Модератор стрима | 🟠 Высокий |
| **viewer** | По умолчанию | Обычный зритель | ⚪ Базовый |

### Алиасы для совместимости:
```python
# VK owner = Twitch broadcaster
if is_owner:
    roles.append('owner')
    roles.append('broadcaster')  # Алиас
```

---

## 🔄 Универсальные роли (кросс-платформенные)

Система использует **унифицированные** роли для работы с обеими платформами:

| Значение в БД | Описание | Twitch | VK Live |
|---------------|----------|--------|---------|
| `all` | Все зрители | ✅ Все | ✅ Все |
| `broadcaster` | Владелец канала | ✅ broadcaster | ✅ owner (алиас) |
| `moderator,broadcaster` | Модераторы и выше | ✅ mod + broadcaster | ✅ mod + owner |
| `moderator` | Только модераторы | ✅ moderator | ✅ moderator |
| `vip` | VIP (Twitch only) | ✅ vip | ❌ N/A |
| `subscriber` | Подписчики (Twitch only) | ✅ subscriber | ❌ N/A |

---

## 🎯 Примеры использования

### 1. Команда доступна всем
```python
allowed_roles = "all"
```
- Twitch: любой зритель
- VK: любой зритель

### 2. Команда только для владельца
```python
allowed_roles = "broadcaster"
```
- Twitch: `is_broadcaster = True`
- VK: `is_owner = True`

### 3. Команда для модераторов и владельца
```python
allowed_roles = "moderator,broadcaster"
```
- Twitch: `is_mod = True` или `is_broadcaster = True`
- VK: `is_moderator = True` или `is_owner = True`

### 4. Команда только для VIP (Twitch only)
```python
allowed_roles = "vip"
platforms = "twitch"  # Обязательно!
```
- Twitch: `is_vip = True`
- VK: Недоступно

---

## 🛠️ Реализация в коде

### Backend: `PlatformRoleChecker`

**Файл:** `bot_service/utils/platform_role_checker.py`

```python
# Twitch роли
roles = []
if author.is_broadcaster:
    roles.append('broadcaster')
    roles.append('owner')  # Алиас
if author.is_mod:
    roles.append('moderator')
if author.is_vip:
    roles.append('vip')
if author.is_subscriber:
    roles.append('subscriber')

# VK роли
roles = []
if author_data.get('is_owner', False):
    roles.append('owner')
    roles.append('broadcaster')  # Алиас
if author_data.get('is_moderator', False):
    roles.append('moderator')
```

### Backend: `CommandExecutor`

**Файл:** `bot_service/core/command_executor.py`

```python
# Проверка доступа
allowed_roles = command.allowed_roles.split(',')
user_has_access = any(role in user_roles for role in allowed_roles)
```

### Frontend: Role Options

**Файл:** `frontend/src/pages/CommandsPage.jsx`

```javascript
const roleOptions = [
    { value: 'all', label: 'Все зрители' },
    { value: 'broadcaster', label: 'Владелец канала' },
    { value: 'moderator,broadcaster', label: 'Модераторы и выше' },
    { value: 'moderator', label: 'Только модераторы' },
    { value: 'vip', label: 'VIP (только Twitch)' },
    { value: 'subscriber', label: 'Подписчики (только Twitch)' }
];
```

---

## ⚠️ Важные замечания

### 1. Нормализация ролей
Составные роли (`moderator,broadcaster`) должны быть отсортированы для совместимости:
```javascript
// Frontend нормализация
const normalizedRole = role?.split(',').sort().join(',');
// "broadcaster,moderator" => "broadcaster,moderator"
```

### 2. Приоритет ролей
При наличии нескольких ролей у пользователя:
- Владелец канала **игнорирует** все cooldown'ы
- Модераторы **соблюдают** cooldown'ы
- Проверка идёт через `any()` - достаточно одной подходящей роли

### 3. Платформо-специфичные роли
- `vip`, `subscriber`, `founder` - **только Twitch**
- Если команда использует эти роли, рекомендуется `platforms = "twitch"`

### 4. Алиасы
- `broadcaster` = `owner` (кросс-платформенная совместимость)
- Оба добавляются в список ролей для гибкости проверок

---

## 📊 Диаграмма иерархии ролей

```
┌─────────────────────────────────────────┐
│          Twitch Hierarchy               │
├─────────────────────────────────────────┤
│  broadcaster (владелец)     🔴          │
│       ↓                                 │
│  moderator                  🟠          │
│       ↓                                 │
│  vip                        🟡          │
│       ↓                                 │
│  subscriber / founder       🟢          │
│       ↓                                 │
│  viewer (зритель)           ⚪          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           VK Live Hierarchy             │
├─────────────────────────────────────────┤
│  owner (владелец)           🔴          │
│       ↓                                 │
│  moderator                  🟠          │
│       ↓                                 │
│  viewer (зритель)           ⚪          │
└─────────────────────────────────────────┘
```

---

## 🧪 Тестирование

### Проверка Twitch ролей:
```python
from utils.platform_role_checker import PlatformRoleChecker

roles = PlatformRoleChecker.get_twitch_roles(author, channel_name)
print(f"User roles: {roles}")

# Проверки
assert PlatformRoleChecker.is_broadcaster(roles)
assert PlatformRoleChecker.has_mod_access(roles)
assert PlatformRoleChecker.has_vip_access(roles)
```

### Проверка VK ролей:
```python
roles = PlatformRoleChecker.get_vk_roles(author_data, channel_id)
print(f"User roles: {roles}")

assert 'owner' in roles
assert 'broadcaster' in roles  # Алиас
```

---

## 📖 Связанные документы

- `bot_service/utils/platform_role_checker.py` - Реализация проверки ролей
- `bot_service/core/command_executor.py` - Использование ролей в командах
- `frontend/src/pages/CommandsPage.jsx` - UI выбора ролей
- `docs/architecture/ARCHITECTURE_GUIDE.md` - Общая архитектура
- `docs/vk/VK_STREAMING_PROTOCOL.md` - VK API документация

---

## 🔄 История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 27.10.2025 | 1.0 | Создан первичный справочник ролей |

---

**Статус:** ✅ Production Ready  
**Поддержка:** Twitch ✅ | VK Live ✅  
**Тестирование:** ✅ Протестировано на обеих платформах

