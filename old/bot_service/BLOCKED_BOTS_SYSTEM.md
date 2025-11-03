# 🤖 Система блокировки ботов от TTS

## 📋 Описание

Система автоматической фильтрации сообщений от ботов для предотвращения озвучивания их через TTS.

**Проблема:** На Twitch и VK Live много сервисных ботов (StreamElements, Nightbot, наш бот и т.д.). Их сообщения не должны озвучиваться, так как это создает спам.

**Решение:** Таблица `blocked_bots` в базе данных содержит список имён ботов, чьи сообщения игнорируются TTS системой.

---

## 🗄️ База данных

### Таблица `blocked_bots`

```sql
CREATE TABLE blocked_bots (
    id INTEGER PRIMARY KEY,
    bot_name VARCHAR UNIQUE NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Поля
- `id` - уникальный идентификатор
- `bot_name` - имя бота (lowercase, уникальное)
- `added_at` - дата добавления

---

## 🤖 Список заблокированных ботов

### ⭐ Наш бот
- **payedviewer** - основной бот приложения (не озвучивается)

### 📺 Популярные Twitch боты
- **streamelements** - алерты и события
- **nightbot** - модерация
- **streamlabs** - донаты и алерты
- **moobot** - модерация
- **fossabot** - модерация
- **wizebot** - модерация
- **botrix** - модерация
- **coebot** - модерация
- **ankhbot** - модерация
- **deepbot** - модерация
- **xanbot** - модерация
- **vivbot** - модерация
- **ohbot** - модерация
- **scorpstradamus** - модерация
- **twirapp** - турниры и розыгрыши

### 🎥 VK Live боты
- **chatbot** - системный бот VK Live (награды, уведомления)
- **sery_bot** - модерация VK

---

## ⚙️ Как работает

### 1. Проверка при обработке сообщения

Файл: `bot_service/utils/websocket_helper.py`

```python
# Проверяем заблокированных ботов
from core.database import BlockedBot
from sqlalchemy import func

db_blocked = SessionLocal()
try:
    is_blocked_bot = db_blocked.query(BlockedBot).filter(
        func.lower(BlockedBot.bot_name) == username.lower()
    ).first()
    
    if is_blocked_bot:
        logger.debug(f"🤖 Bot {username} is in blocked list, skipping TTS")
        return {"success": False, "error": "Bot is blocked from TTS"}
finally:
    db_blocked.close()
```

### 2. Порядок проверок

При получении сообщения для TTS:

1. ✅ Проверка включен ли TTS для канала
2. ✅ Проверка режима TTS (все сообщения / только за баллы)
3. ✅ **Проверка заблокированных пользователей** (`TTSBlockedUser`)
4. ✅ **Проверка заблокированных ботов** (`BlockedBot`) ⬅️ **НОВОЕ**
5. ✅ Проверка настроек TTS (фильтры emoji, ответов и т.д.)
6. ✅ Отправка на озвучивание

---

## 🛠️ Управление списком

### Инициализация (первый запуск)

```bash
cd bot_service
python scripts/init_blocked_bots.py
```

**Результат:**
```
✅ Blocked bots initialization complete!
   Added: 9
   Skipped (already exists): 10
   Total blocked bots: 19
```

### Добавить бота через Admin API

**Endpoint:** `POST /api/admin/blocked-bots`

```json
{
  "bot_name": "somebot"
}
```

### Удалить бота через Admin API

**Endpoint:** `DELETE /api/admin/blocked-bots/{bot_name}`

### Получить список

**Endpoint:** `GET /api/admin/blocked-bots`

**Ответ:**
```json
[
  {
    "id": 1,
    "bot_name": "payedviewer",
    "added_at": "2025-10-29T12:00:00"
  },
  {
    "id": 2,
    "bot_name": "nightbot",
    "added_at": "2025-10-29T12:00:00"
  }
]
```

---

## 📂 Файлы

### Основные файлы
- `bot_service/core/database.py` - модель `BlockedBot`
- `bot_service/utils/websocket_helper.py` - проверка при TTS
- `bot_service/services/admin_service.py` - CRUD операции
- `bot_service/constants.py` - список по умолчанию
- `bot_service/scripts/init_blocked_bots.py` - инициализация

### API endpoints
- `bot_service/api/admin_api_endpoints.py` - админ панель управления

---

## 🔍 Логирование

При блокировке бота в логах:

```
🤖 Bot payedviewer is in blocked list, skipping TTS
🤖 Bot nightbot is in blocked list, skipping TTS
```

**Уровень:** `DEBUG` - не спамит консоль, но видно в логах

---

## ✅ Результат

### До исправления
- ❌ Таблица `blocked_bots` существовала, но не использовалась
- ❌ **Наш бот озвучивался** через TTS
- ❌ StreamElements, Nightbot и другие боты озвучивались

### После исправления
- ✅ Таблица `blocked_bots` активно используется
- ✅ **Наш бот НЕ озвучивается** (payedviewer)
- ✅ 19 популярных ботов заблокированы
- ✅ Легко добавлять новых ботов через Admin API
- ✅ Case-insensitive проверка (PAYEDVIEWER = payedviewer)

---

## 🎯 Важно

1. **Имя бота должно быть lowercase** в базе данных
2. **Проверка case-insensitive** - `func.lower()` используется
3. **Наш бот (payedviewer) всегда заблокирован** - не озвучивается
4. **VK ChatBot заблокирован** - системные сообщения о наградах не озвучиваются

---

## 📊 Статистика

- **Всего ботов в списке:** 19
- **Платформы:** Twitch (15), VK (2), Универсальные (2)
- **Дата внедрения:** 29.10.2025
- **Версия:** 1.0.0

---

**Автор:** AI Assistant  
**Дата:** 29 октября 2025  
**Статус:** ✅ Активно используется

