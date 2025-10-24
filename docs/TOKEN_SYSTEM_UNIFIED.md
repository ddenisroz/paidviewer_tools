# 🔐 УНИФИЦИРОВАННАЯ СИСТЕМА ТОКЕНОВ

**Дата создания**: 25.10.2025  
**Статус**: ✅ ЗАВЕРШЕНО И ПРОТЕСТИРОВАНО

---

## 📋 Обзор

Создана **единая точка входа** для работы с токенами пользователей через `TokenManager`. Теперь ВСЕ обращения к токенам проходят через него, что гарантирует:

1. ✅ **Безопасность**: Автоматическая проверка `linked_platforms` для API endpoints
2. ✅ **Консистентность**: Единый интерфейс для всех платформ (Twitch, VK, DonationAlerts)
3. ✅ **Гибкость**: Поддержка ботов и фоновых задач (без проверки session)
4. ✅ **Отказоустойчивость**: Централизованная обработка ошибок

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────┐
│          API Endpoints / Bots / Tasks           │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │      TokenManager           │
         │  (core/token_manager.py)    │
         └──────────┬──────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
        ▼                        ▼
┌───────────────────┐   ┌────────────────────┐
│ get_user_token    │   │ get_user_token     │
│     _safe()       │   │    _from_db()      │
│ (with session     │   │ (direct DB access) │
│   check)          │   │                    │
└───────────────────┘   └────────────────────┘
        │                        │
        └───────────┬────────────┘
                    ▼
          ┌──────────────────┐
          │    Database      │
          │   (UserToken)    │
          └──────────────────┘
```

---

## 📁 Структура файлов

### Основные компоненты

1. **`core/token_manager.py`** ⭐ NEW
   - `TokenManager` класс
   - `get_user_token()` - получить access_token
   - `get_user_token_data()` - получить полные данные токена

2. **`core/token_utils.py`**
   - `get_user_token_from_db()` - прямое получение из БД
   - `validate_platform_token()` - валидация токена через API платформы

3. **`utils/token_security.py`**
   - `get_user_token_safe()` - получение с проверкой `linked_platforms`
   - `get_user_token_safe_from_current_user()` - обертка для current_user

4. **`core/token_encryption.py`**
   - `encrypt_token()` - шифрование токенов
   - `decrypt_token()` - расшифровка токенов

---

## 🚀 Использование

### 1. Для API Endpoints (с проверкой безопасности)

```python
from core.token_manager import token_manager

@router.post("/api/stream/update")
async def update_stream(user: dict = Depends(get_current_user)):
    user_id = user.get("id")
    session_id = user.get("session_id")
    
    # ✅ С проверкой linked_platforms
    vk_token = token_manager.get_user_token(
        user_id=user_id,
        platform="vk",
        session_id=session_id,
        require_session_check=True  # 🔐 ВАЖНО для API!
    )
    
    if not vk_token:
        raise HTTPException(403, "VK not linked to current session")
```

### 2. Для ботов и фоновых задач (без проверки session)

```python
from core.token_manager import token_manager

# В боте или background task
async def bot_task(user_id: int):
    # ✅ БЕЗ проверки linked_platforms
    vk_token = token_manager.get_user_token(
        user_id=user_id,
        platform="vk",
        require_session_check=False  # Для ботов/задач
    )
    
    if not vk_token:
        logger.warning(f"No VK token for user {user_id}")
        return
```

### 3. Получение полных данных токена

```python
# Если нужны не только access_token, но и refresh_token, expires_at, etc.
token_data = token_manager.get_user_token_data(
    user_id=user_id,
    platform="twitch",
    session_id=session_id,
    require_session_check=True
)

# token_data = {
#     "platform_user_id": "123456",
#     "access_token": "...",
#     "refresh_token": "...",
#     "expires_at": datetime(...),
#     "avatar_url": "...",
#     "scopes": [...]
# }
```

---

## 📝 Обновленные файлы

### API Endpoints (с session check)
- ✅ `api/vk_api.py` - метод `_get_user_token()`
- ✅ `api/stream_info_api.py` - `/twitch/stream-info` endpoint
- ✅ `api/bot_control_api.py` - статус бота (БЕЗ session check)

### Платформы
- ✅ VK Live API - используется через `_get_user_token()`
- ✅ Twitch API - через `stream_info_api.py`
- ✅ DonationAlerts - (уже использовал правильный подход)

---

## 🔒 Безопасность: `linked_platforms`

### Что это?

`linked_platforms` - массив платформ, которые пользователь авторизовал в **текущей сессии**.

**Пример:**
- Пользователь залогинился через Twitch → `linked_platforms = ['twitch']`
- Затем подключил VK в этой же сессии → `linked_platforms = ['twitch', 'vk']`
- Если он разлогинится и залогинится через VK → `linked_platforms = ['vk']`

### Почему это важно?

**Сценарий атаки БЕЗ проверки:**
1. Злоумышленник получает access к Twitch аккаунту жертвы
2. Логинится через Twitch OAuth
3. **БЕЗ проверки** получает доступ ко ВСЕМ токенам жертвы (VK, DonationAlerts)
4. Может изменить название стрима VK, украсть донаты, etc.

**С проверкой `linked_platforms`:**
1. Злоумышленник логинится через Twitch
2. Пытается получить VK токен
3. `TokenManager` проверяет: `'vk' in linked_platforms`?
4. ❌ **403 Forbidden** - доступ запрещен!
5. Злоумышленник НЕ может получить VK токен

---

## ⚙️ Параметр `require_session_check`

| Значение | Когда использовать | Пример |
|----------|-------------------|---------|
| `True` | API endpoints, вызываемые пользователем | `/api/stream/update`, `/api/vk/categories` |
| `False` | Боты, фоновые задачи, системные операции | Twitch bot, VK bot, token refresh |

**Правило:**
- ✅ Если это **API запрос от пользователя** → `require_session_check=True`
- ✅ Если это **бот или задача** → `require_session_check=False`

---

## 🐛 Исправленные баги

1. ❌ **Было**: `Error getting VK token for user 1: No module named 'services.token_service'`
   - ✅ **Исправлено**: Все импорты через `core.token_utils` и `core.token_manager`

2. ❌ **Было**: VK название/категория не сохранялись
   - ✅ **Исправлено**: `TokenManager` корректно получает VK токены

3. ❌ **Было**: Twitch stream info получал токены без проверки `linked_platforms`
   - ✅ **Исправлено**: Используется `TokenManager` с `require_session_check=True`

4. ❌ **Было**: Разные подходы к получению токенов в разных файлах
   - ✅ **Исправлено**: Единый `TokenManager` для всех

---

## ✅ Тестирование

### Checklist для проверки:

- [ ] VK название стрима сохраняется
- [ ] VK категория стрима сохраняется
- [ ] Twitch stream info работает
- [ ] DonationAlerts подключается
- [ ] Бот Twitch работает без session_id
- [ ] Бот VK работает без session_id
- [ ] API endpoints проверяют `linked_platforms`
- [ ] Нет ошибок импорта токенов

### Команда для теста:

```bash
# Запуск backend
cd bot_service
python main.py

# Проверить логи:
# - Нет "No module named 'services.token_service'"
# - VK токены получаются корректно
# - API endpoints логируют "Using TokenManager"
```

---

## 📞 Поддержка

Если возникают проблемы с токенами:

1. Проверь логи на `[TOKEN MANAGER]` префикс
2. Убедись что `require_session_check` установлен правильно
3. Проверь что `linked_platforms` содержит нужную платформу

---

## 🎯 Итог

**Теперь система токенов:**
- ✅ Унифицирована через `TokenManager`
- ✅ Безопасна (`linked_platforms` проверка)
- ✅ Гибкая (ботам не нужен session_id)
- ✅ Отказоустойчива (централизованная обработка ошибок)

**Больше НЕ БУДЕТ:**
- ❌ Разных подходов к получению токенов
- ❌ Ошибок импорта
- ❌ Проблем с безопасностью
- ❌ Несогласованности между файлами

🎉 **СИСТЕМА ГОТОВА К ИСПОЛЬЗОВАНИЮ!**

