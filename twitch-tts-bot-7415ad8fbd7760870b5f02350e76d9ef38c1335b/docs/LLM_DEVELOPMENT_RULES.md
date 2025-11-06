# Правила разработки для AI-агентов

**Версия:** 3.0.0 | **Дата:** 22 октября 2025

---

## КРИТИЧЕСКОЕ ПРАВИЛО #1: НЕ ЛОМАЙ РАБОЧИЕ ФИЧИ!

### АБСОЛЮТНЫЙ ЗАПРЕТ

**ПЕРЕД любым изменением файла:**

1. Прочитай **ВЕСЬ** файл целиком
2. Проверь `docs/CURRENT_STATUS.md` - что работает
3. Убедись что твои изменения **НЕ** затрагивают рабочие фичи
4. Используй **ТОЧЕЧНЫЕ** изменения, а не переписывание

### Если фича отмечена как "Работает" - НЕ ТРОГАЙ ЕЁ!

**Пример ЗАПРЕЩЕННЫХ действий:**

```python
# ЗАПРЕЩЕНО: Переписывать рабочую функцию
def working_function():
    # Эта функция работает! НЕ ТРОГАЙ!
    pass

# НЕ делай так:
def working_function():
    # "Улучшил" код - теперь сломано
    pass

# Делай так:
# Оставь working_function как есть!
# Создай новую функцию если нужно
def new_helper_function():
    pass
```

---

## Главные принципы

### 1. **Минимальные изменения**

- Изменяй **ТОЛЬКО** то что сломано
- Используй `search_replace` для точечных правок
- НЕ переписывай большие блоки кода
- НЕ "улучшай" работающий код

### 2. **Читай перед изменением**

```python
# ПРАВИЛЬНЫЙ порядок действий:
1. read_file() - прочитай ВЕСЬ файл
2. Изучи контекст и зависимости
3. Проверь CURRENT_STATUS.md
4. Найди ТОЧНОЕ место бага
5. search_replace() - ТОЧЕЧНОЕ изменение
6. read_lints() - проверь что ничего не сломал
```

### 3. **Сохраняй архитектуру**

- ✅ API endpoints в `api/`
- ✅ Auth логика в `auth/`
- ✅ Models в `core/database.py`
- ✅ Utils в `utils/`
- ✅ Bots в `bots/`
- ✅ Components в `components/`

---

## Правила для конкретных областей

### Авторизация (OAuth, Tokens, Sessions)

**СТАТУС: РАБОТАЕТ - НЕ ТРОГАТЬ!**

```python
# ❌ ЗАПРЕЩЕНО изменять:
- auth/oauth_handler.py (OAuth flow)
- core/session_manager.py (Session logic)
- core/token_utils.py (Token validation)
- api/session_api.py (Session endpoints)

# Можно только:
- Добавлять логирование (logger.info)
- Исправлять опечатки в комментариях
```

### TTS (Text-to-Speech)

**СТАТУС: Базовая озвучка РАБОТАЕТ - НЕ ТРОГАТЬ!**

```python
# ❌ ЗАПРЕЩЕНО изменять:
- utils/websocket_helper.py (handle_tts_for_message)
- api/tts_api.py (основные endpoints)
- components/TtsQuickSettings.jsx (toggles)

# Можно:
- Добавлять новые опции TTS
- Исправлять баги в AI TTS (не базовой!)
- Улучшать UI настроек (не ломая существующие)
```

### ChatBox

**СТАТУС: Частично работает**

```python
# ✅ РАБОТАЕТ - НЕ ТРОГАТЬ:
- Отображение сообщений
- WebSocket соединение
- Фильтрация по платформам
- Цветные ники

# Баги - МОЖНО ИСПРАВЛЯТЬ:
- Сохранение истории Twitch
- Позиционирование контекстного меню

# Требует доработки:
- Кнопка "Настройка" (была "OBS")
```

### Управление стримом

**СТАТУС: Частично работает**

```python
# ✅ РАБОТАЕТ - НЕ ТРОГАТЬ:
- Смена названия стрима (Twitch + VK)
- Смена категории в раздельном режиме

# Баг - МОЖНО ИСПРАВЛЯТЬ:
- Смена категории в объединенном режиме
```

---

## 📝 Правила именования

- **Файлы**: `snake_case.py`, `PascalCase.jsx`
- **Классы**: `PascalCase`
- **Функции**: `snake_case`
- **Константы**: `UPPER_CASE`
- **React компоненты**: `PascalCase`
- **React hooks**: `useCamelCase`

---

## Код должен быть:

1. **Читаемым** - понятен с первого взгляда
2. **Безопасным** - нет утечек, валидация входных данных
3. **Быстрым** - оптимизирован для production
4. **Задокументированным** - docstrings где нужно
5. **Тестируемым** - можно проверить работу

---

## API Endpoints - паттерны

### ПРАВИЛЬНО:

```python
from fastapi import APIRouter, Depends
from core.database import get_db
from auth.auth import get_current_user
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api", tags=["feature"])

@router.post("/feature/action")
async def action_endpoint(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get('id')
    # Логирование
    logger.info(f"[FEATURE] User {user_id} action")
    
    try:
        # Валидация
        if not request.get('param'):
            raise HTTPException(400, "Missing param")
        
        # Бизнес-логика
        result = process_action(db, user_id, request)
        
        # Возврат
        return {"success": True, "data": result}
    
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(500, str(e))
```

### ❌ НЕПРАВИЛЬНО:

```python
# НЕ делай так:
@router.post("/action")  # Нет prefix
def action():  # Не async, нет зависимостей
    user = get_user()  # Прямой вызов
    db.execute("SELECT *")  # SQL injection!
    return result  # Нет обработки ошибок
```

---

## 🗄️ Работа с БД

### ✅ ПРАВИЛЬНО:

```python
from sqlalchemy import func
from core.database import User, get_db

# Case-insensitive поиск
user = db.query(User).filter(
    func.lower(User.twitch_username) == username.lower()
).first()

# Проверка существования
if user:
    # Обработка
    pass
else:
    # Ошибка
    raise HTTPException(404, "User not found")
```

### ❌ НЕПРАВИЛЬНО:

```python
# НЕ делай так:
user = db.query(User).filter(
    User.twitch_username == username  # Case-sensitive!
).first()

# Или
db.execute(f"SELECT * FROM users WHERE name='{name}'")  # SQL injection!
```

---

## 📊 Логирование

### ✅ ПРАВИЛЬНО:

```python
import logging
logger = logging.getLogger(__name__)

# Информация
logger.info(f"✅ User {user_id} logged in")

# Предупреждение
logger.warning(f"⚠️ Token expired for user {user_id}")

# Ошибка
logger.error(f"Failed to save: {e}", exc_info=True)

# Отладка
logger.debug(f"Processing data: {data}")
```

### НЕПРАВИЛЬНО:

```python
# НЕ делай так:
print("Debug info")  # Никогда!
print(f"User: {user}")  # Никогда!

# Только logger!
```

---

## Тестирование изменений

### Перед коммитом:

1. Прочитай изменения: `git diff`
2. Проверь линтер: `read_lints()`
3. Запусти backend: проверь на ошибки
4. Проверь frontend: нет консольных ошибок
5. Протестируй вручную фичу
6. Убедись что рабочие фичи не сломаны!

### Чек-лист до commit:

```bash
# Backend
- [ ] Backend запускается без ошибок
- [ ] Нет Python exceptions
- [ ] Все endpoints отвечают
- [ ] WebSocket соединяется

# Frontend  
- [ ] npm run dev работает
- [ ] Нет console.error
- [ ] UI рендерится корректно
- [ ] Рабочие фичи не сломаны

# Документация
- [ ] Обновлен CURRENT_STATUS.md если нужно
```

---

## Если сломал что-то

### 1. Не паникуй!

```bash
# Посмотри что изменилось
git diff

# Откат одного файла
git checkout -- <filename>

# Откат всех изменений
git reset --hard HEAD
```

### 2. Проверь логи

```bash
# Backend
tail -f bot_service/bot_service.log

# Frontend
F12 → Console → ищи красные ошибки
```

### 3. Читай документацию

- `CURRENT_STATUS.md` - текущий статус
- `QUICK_FIX_GUIDE.md` - быстрые фиксы
- `DEVELOPER_GUIDE.md` - гайд разработчика

---

## Обязательное чтение перед работой

1. `docs/CURRENT_STATUS.md` - ЧТО РАБОТАЕТ
2. `docs/ARCHITECTURE_GUIDE.md` - как устроен проект
3. `docs/DEVELOPER_GUIDE.md` - как разрабатывать

---

## Примеры ПРАВИЛЬНОГО подхода

### Пример 1: Исправление бага

```python
# ПЛОХО: Переписать всю функцию
def broken_function():
    # Переписал всё заново - сломал 5 фич
    pass

# ХОРОШО: Точечное исправление
# 1. Прочитал функцию
# 2. Нашёл строку с багом
# 3. Исправил ТОЛЬКО эту строку через search_replace
# 4. Проверил что остальное не сломалось
```

### Пример 2: Добавление фичи

```python
# ПЛОХО: Изменить существующую функцию
def existing_feature():
    # Добавил новую логику в старую функцию
    # Сломал старое поведение
    pass

# ХОРОШО: Создать новую функцию
def existing_feature():
    # НЕ ТРОГАЕМ!
    pass

def new_feature():
    # Новая логика отдельно
    # Вызываем existing_feature() если нужно
    pass
```

---

## Итоговый чек-лист

Перед **КАЖДЫМ** изменением файла:

- [ ] Прочитал `docs/CURRENT_STATUS.md`
- [ ] Прочитал **ВЕСЬ** файл который буду менять
- [ ] Убедился что не трогаю рабочие фичи
- [ ] Использую **точечные** изменения (search_replace)
- [ ] Проверил зависимости и импорты
- [ ] Добавил логирование если нужно
- [ ] Проверил линтер после изменений
- [ ] Протестировал изменения
- [ ] Убедился что ничего не сломал

---

**⚠️ ПОМНИ: Лучше НЕ исправить баг, чем сломать 5 работающих фич!**

**Версия:** 3.0.0 | **Статус:** Обязательно к выполнению | **Приоритет:** КРИТИЧЕСКИЙ
