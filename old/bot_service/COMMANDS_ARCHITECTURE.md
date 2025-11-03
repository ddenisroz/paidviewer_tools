# 🎮 Архитектура команд бота

## 📋 Типы команд

### 1. Глобальные команды (`command_type='global'`)
**Рекомендуемый подход** ✅

- **`user_id = NULL`** - доступны ВСЕМ пользователям
- **Создаются один раз** через `init_global_commands.py`
- **Не создают дубликатов** в БД
- **Автоматически доступны** всем новым пользователям

**Примеры:**
- `!help`, `!sr`, `!skip`, `!queue`, `!clear`
- `!tts`, `!voice`, `!randomvoice`, `!mute`, `!unmute`
- `!title`, `!game`, `!analyze`

### 2. Кастомные команды (`command_type='custom'`)
**Создаются пользователями** через веб-интерфейс

- **`user_id = <user_id>`** - принадлежат конкретному пользователю
- **Создаются через API** (`/api/commands`)
- **Уникальные для каждого канала**

**Примеры:**
- `!discord`, `!vk`, `!donate`
- Любые пользовательские команды с текстовыми ответами

### 3. ~~Базовые команды (`command_type='basic'`)~~ ❌ УСТАРЕЛИ
**НЕ ИСПОЛЬЗОВАТЬ!**

- Создавали дубликаты для каждого пользователя
- Приводили к множественным записям в БД
- Заменены на глобальные команды

---

## 🔍 Как работает система команд

### Запрос команд в `!help`
```python
# Получаем команды из БД
all_commands = db.query(BotCommand).filter(
    or_(
        BotCommand.command_type == 'global',  # Глобальные (доступны всем)
        BotCommand.user_id == user.id          # Кастомные (этого пользователя)
    )
).filter(
    or_(
        BotCommand.platforms.like('%twitch%'),  # Для текущей платформы
        BotCommand.platforms.like('%all%')
    )
).filter(
    BotCommand.is_enabled == True
).order_by(BotCommand.command_name).all()

# Убираем дубликаты по имени
seen_commands = set()
unique_commands = []
for cmd in all_commands:
    if cmd.command_name not in seen_commands:
        seen_commands.add(cmd.command_name)
        unique_commands.append(cmd)
```

### Выполнение команды
1. **Поиск команды:** глобальные → кастомные пользователя
2. **Проверка прав:** `allowed_roles` (all, moderator, broadcaster)
3. **Проверка кулдауна:** `cooldown_seconds`
4. **Выполнение:** вызов обработчика или отправка текста

---

## 🛠️ Управление командами

### Инициализация глобальных команд
```bash
cd bot_service
python init_global_commands.py
```

Этот скрипт:
- Создает/обновляет глобальные команды
- Не создает дубликатов (проверка по `command_name`)
- Безопасен для повторного запуска

### ❌ Устаревшие скрипты (НЕ ИСПОЛЬЗОВАТЬ)
```bash
# ❌ Создает дублирующиеся 'basic' команды
python init_commands.py  

# ❌ init_commands_for_user() устарела
python scripts/fix_existing_users.py
```

**Вместо них:**
```bash
# ✅ Используйте только это
python init_global_commands.py
```

---

## 🆕 Регистрация нового пользователя

При регистрации (Twitch/VK OAuth):
1. ✅ Создается `User`
2. ✅ Создается `UserToken`
3. ✅ Создается `UserSettings`
4. ✅ Бот подключается к каналу
5. ❌ **Команды НЕ создаются** (используются глобальные)

**Глобальные команды уже доступны новому пользователю!**

---

## 📊 Проверка состояния БД

### Подсчет команд по типам
```python
from core.database import get_db, BotCommand

db = next(get_db())

# Глобальные команды (должно быть ~15)
global_count = db.query(BotCommand).filter(
    BotCommand.command_type == 'global'
).count()

# Кастомные команды пользователей
custom_count = db.query(BotCommand).filter(
    BotCommand.command_type == 'custom'
).count()

# ❌ Базовые команды (должно быть 0)
basic_count = db.query(BotCommand).filter(
    BotCommand.command_type == 'basic'
).count()

print(f"Global: {global_count}")
print(f"Custom: {custom_count}")
print(f"Basic (should be 0): {basic_count}")
```

### Удаление дублирующихся команд
Если обнаружены `basic` команды:
```python
deleted = db.query(BotCommand).filter(
    BotCommand.command_type == 'basic'
).delete()
db.commit()
print(f"Deleted {deleted} duplicate commands")
```

---

## 🎯 Best Practices

### ✅ Правильно
1. **Используйте глобальные команды** для стандартного функционала
2. **Создавайте кастомные команды** только через веб-интерфейс
3. **Запускайте `init_global_commands.py`** при обновлении списка команд
4. **Не создавайте команды** при регистрации пользователя

### ❌ Неправильно
1. Создавать `basic` команды для каждого пользователя
2. Использовать `init_commands.py`
3. Вызывать `init_commands_for_user()` из `fix_existing_users.py`
4. Создавать дубликаты команд в БД

---

## 🔧 История изменений

### Session 18 (29.10.2025)
**Проблема:** Команда `!help` показывала дубликаты (каждая команда 3x)

**Причина:** 
- Старые скрипты создавали `basic` команды для каждого токена
- Запрос получал и `global` и `basic` команды
- Множественные токены = множественные дубликаты

**Решение:**
1. ✅ Добавлена дедупликация в `universal_command_handler.py`
2. ✅ Удалены 26 дублирующихся `basic` команд из БД
3. ✅ Помечены как устаревшие `init_commands.py` и `init_commands_for_user()`
4. ✅ Оставлено 15 глобальных команд

**Результат:**
- Было: 41 команда (с дубликатами)
- Стало: 15 уникальных команд
- `!help` работает корректно ✨

---

## 📚 См. также

- `init_global_commands.py` - скрипт инициализации глобальных команд
- `bots/universal_command_handler.py` - обработчик команд с дедупликацией
- `api/commands_api.py` - API для управления кастомными командами
- `docs/CURRENT_STATUS.md` - общий статус проекта

