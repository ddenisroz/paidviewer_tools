# VK Live: Подтверждение работы ролей в командах

**Дата:** 28 октября 2025  
**Статус:** ✅ РАБОТАЕТ КОРРЕКТНО

---

## 🎯 Подтверждение

VK Live **уже использует реальные роли из API** для проверки доступа к командам.

---

## 🔍 Как это работает

### 1️⃣ Получение ролей из VK API

**Файл:** `bot_service/bots/vk_live_bot_core.py`

```python
async def _handle_message(self, message: Dict[str, Any]):
    author = message.get("author", {})
    is_owner = author.get("is_owner", False) or author.get("is_broadcaster", False)
    is_moderator = author.get("is_moderator", False)
    
    # При обработке команд передаём РЕАЛЬНЫЕ роли из API
    if text.startswith('!'):
        command_message = {
            'message': text,
            'author_nick': user,
            'author_id': message.get("author", {}).get("id"),
            'is_moderator': message.get("author", {}).get("is_moderator", False),  # ✅ Из API
            'is_owner': message.get("author", {}).get("is_owner", False)          # ✅ Из API
        }
        await self.universal_command_handler.handle_vk_command(channel_id, command_message, self)
```

**Источник данных:** VK Live API возвращает:
- `author.is_owner` - владелец канала (broadcaster)
- `author.is_moderator` - модератор канала

---

### 2️⃣ Преобразование ролей

**Файл:** `bot_service/utils/platform_role_checker.py`

```python
@staticmethod
def get_vk_roles(author_data: Dict[str, Any], channel_id: str) -> List[str]:
    """
    Получить роли пользователя VK Live
    
    Returns:
        Список ролей: ['owner', 'moderator', 'viewer']
    """
    roles = []
    
    # 1. Owner (владелец стрима)
    if author_data.get('is_owner', False):
        roles.append('owner')
        roles.append('broadcaster')  # Алиас для совместимости
    
    # 2. Moderator
    if author_data.get('is_moderator', False):
        roles.append('moderator')
    
    # 3. Viewer (базовая роль)
    if not roles:
        roles.append('viewer')
    
    return roles
```

---

### 3️⃣ Проверка доступа к командам

**Файл:** `bot_service/utils/platform_role_checker.py`

```python
@staticmethod
def is_broadcaster(roles: List[str]) -> bool:
    """Проверить является ли пользователь владельцем канала"""
    return 'broadcaster' in roles or 'owner' in roles

@staticmethod
def has_mod_access(roles: List[str]) -> bool:
    """Проверить имеет ли пользователь права модератора или выше"""
    return any(role in roles for role in ['broadcaster', 'owner', 'moderator'])

@staticmethod
def has_vip_access(roles: List[str]) -> bool:
    """Проверить имеет ли пользователь VIP доступ или выше"""
    return any(role in roles for role in ['broadcaster', 'owner', 'moderator', 'vip', 'founder'])
```

---

## 📊 Поддерживаемые роли VK Live

| Роль API | Преобразуется в | Уровень доступа |
|----------|----------------|-----------------|
| `is_owner=true` | `['owner', 'broadcaster']` | Полный доступ (все команды) |
| `is_moderator=true` | `['moderator']` | Модераторский доступ |
| Никаких ролей | `['viewer']` | Базовый доступ (только публичные команды) |

---

## ✅ Примеры использования в командах

### Пример 1: Команда только для владельца

```python
if not PlatformRoleChecker.is_broadcaster(user_roles):
    return "❌ Только владелец канала может использовать эту команду"
```

**Работает для VK:** Проверяет `'owner'` или `'broadcaster'` в списке ролей.

---

### Пример 2: Команда для модераторов и выше

```python
if not PlatformRoleChecker.has_mod_access(user_roles):
    return "❌ Только модераторы и владелец могут использовать эту команду"
```

**Работает для VK:** Проверяет `'owner'`, `'broadcaster'` или `'moderator'` в списке ролей.

---

### Пример 3: Команда для всех привилегированных

```python
if not PlatformRoleChecker.has_vip_access(user_roles):
    return "❌ Недостаточно прав"
```

**Работает для VK:** Проверяет наличие любой привилегированной роли.

---

## 🔒 Безопасность

✅ **Роли берутся напрямую из VK API** - нельзя подделать  
✅ **Проверка происходит на стороне сервера** - клиент не может обмануть  
✅ **Универсальная система ролей** - одинаковая логика для Twitch и VK  

---

## 📝 Вывод

**VK Live роли полностью функциональны и используют реальные данные из API.**

Никаких дополнительных изменений не требуется. ✅

---

## 🚫 Что НЕ поддерживается

**VK Live НЕ предоставляет графические иконки (badges) для ролей в сообщениях чата.**

В отличие от Twitch, где есть API для получения URL'ов бейджей, VK Live API возвращает только булевые флаги:
- `is_owner` (boolean)
- `is_moderator` (boolean)

**Решение:** Используем текстовые роли (`role='broadcaster'` или `role='moderator'`) для отображения в UI.

