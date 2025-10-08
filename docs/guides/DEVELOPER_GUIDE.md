# 👨‍💻 Руководство разработчика - Новые утилиты

## 📚 Обзор новых модулей

После оптимизации проекта добавлены новые утилиты для упрощения разработки и повышения качества кода.

---

## 🛡️ Валидация входных данных

### Модуль: `bot_service/utils/validators.py`

#### InputValidator

Используйте для валидации всех пользовательских данных:

```python
from utils.validators import InputValidator, ValidationError

# Санитизация текста
try:
    clean_text = InputValidator.sanitize_text(
        user_input,
        max_length=500,
        allow_multiline=False
    )
except ValidationError as e:
    return {"error": str(e)}

# Валидация username
try:
    InputValidator.validate_username("user_123")
    # Валидация пройдена
except ValidationError as e:
    return {"error": str(e)}

# Валидация email
try:
    InputValidator.validate_email("user@example.com")
except ValidationError as e:
    return {"error": str(e)}

# Валидация YouTube URL
try:
    video_data = InputValidator.validate_youtube_url(youtube_url)
    video_id = video_data['video_id']
except ValidationError as e:
    return {"error": "Invalid YouTube URL"}

# Валидация числового диапазона
try:
    volume = InputValidator.validate_number_range(
        value=user_volume,
        min_value=0,
        max_value=100,
        field_name="Volume"
    )
except ValidationError as e:
    return {"error": str(e)}
```

#### FileValidator

Для валидации загружаемых файлов:

```python
from utils.validators import FileValidator, ValidationError

# Валидация аудио файла
try:
    FileValidator.validate_audio_file(
        filename="voice.wav",
        content_type="audio/wav",
        file_size=file.size
    )
except ValidationError as e:
    return {"error": str(e)}
```

---

## ⚡ Оптимизация запросов к БД

### Модуль: `bot_service/utils/db_optimizer.py`

#### QueryOptimizer

Используйте для кэширования и оптимизации запросов:

```python
from utils.db_optimizer import QueryOptimizer

# Кэширование данных
# Сохранить в кэш
QueryOptimizer.set_cached("user_123_data", user_data, ttl=300)

# Получить из кэша
cached_data = QueryOptimizer.get_cached("user_123_data")
if cached_data:
    return cached_data

# Очистить кэш
QueryOptimizer.clear_cache()  # Все
QueryOptimizer.clear_cache("user_")  # По паттерну

# Оптимизированные запросы
# Пользователь с токенами (без N+1)
user = QueryOptimizer.get_user_with_tokens(db, user_id)

# Batch загрузка команд
user_ids = [1, 2, 3, 4, 5]
commands = QueryOptimizer.get_user_commands_batch(db, user_ids, platform="twitch")

# Статистика пользователя (с кэшированием)
stats = QueryOptimizer.get_user_stats_optimized(db, user_id)
print(f"Average viewers: {stats['avg_viewers']}")

# Batch вставка данных
data_list = [
    {"user_id": 1, "viewer_count": 100, "is_live": True},
    {"user_id": 2, "viewer_count": 200, "is_live": True},
]
inserted = QueryOptimizer.bulk_insert_stream_data(db, data_list)

# Очистка старых данных (batch)
result = QueryOptimizer.cleanup_old_data_batch(db, days_old=90)
print(f"Cleaned {result['streams']} streams, {result['messages']} messages")
```

#### IndexOptimizer

Для анализа и создания индексов:

```python
from utils.db_optimizer import IndexOptimizer

# Проверить отсутствующие индексы
recommendations = IndexOptimizer.analyze_missing_indexes(db)
for rec in recommendations:
    print(f"Missing index: {rec['table']}.{rec['column']}")
    print(f"SQL: {rec['query']}")

# Создать рекомендуемые индексы
created = IndexOptimizer.create_recommended_indexes(db)
print(f"Created {created} indexes")
```

---

## 🤖 Базовый класс для ботов

### Модуль: `bot_service/bots/base_bot.py`

При создании нового бота наследуйтесь от `BaseBot`:

```python
from bots.base_bot import BaseBot

class MyNewBot(BaseBot):
    def __init__(self, token: str, connection_manager):
        super().__init__(connection_manager)
        self.token = token
    
    async def start_bot(self):
        """Реализация запуска бота"""
        self.is_running = True
        # Ваша логика
    
    async def stop_bot(self):
        """Реализация остановки бота"""
        self.is_running = False
        # Ваша логика
    
    async def join_channel(self, channel_name: str) -> bool:
        """Реализация подключения к каналу"""
        if channel_name not in self.connected_channels:
            self.connected_channels.append(channel_name)
            return True
        return False
    
    async def leave_channel(self, channel_name: str) -> bool:
        """Реализация отключения от канала"""
        if channel_name in self.connected_channels:
            self.connected_channels.remove(channel_name)
            return True
        return False
    
    async def send_message(self, channel_name: str, message: str) -> bool:
        """Реализация отправки сообщения"""
        # Ваша логика
        pass
```

### Использование общих методов

```python
# Генерация фейкового IP
fake_ip = self.generate_fake_ip()
await self.send_message(channel, f"Connected from {fake_ip}")

# Получение ID владельца канала
owner_id = await self.get_channel_owner_id(channel_name, platform="twitch")

# Проверка прав пользователя
has_permission = await self.check_user_permissions(
    user_roles=["viewer"],
    required_roles="moderator,broadcaster",
    platform="twitch"
)

# Проверка кулдауна команды
remaining = await self.check_command_cooldown(command, channel_name)
if remaining:
    await self.send_message(channel, f"Cooldown: {remaining}s left")

# Создание базовой команды
command = await self.create_basic_command_if_not_exists(
    db, channel_name, "help", user_id
)

# Санитизация ввода
clean_text = await self.validate_and_sanitize_input(user_input, max_length=200)
```

---

## 🔧 Best Practices

### 1. Всегда валидируйте пользовательский ввод

```python
# ❌ Плохо
def create_command(command_name: str):
    # Прямое использование без валидации
    db.execute(f"INSERT INTO commands VALUES ('{command_name}')")

# ✅ Хорошо
def create_command(command_name: str):
    try:
        # Валидация
        InputValidator.validate_command_name(command_name)
        # Санитизация
        clean_name = InputValidator.sanitize_text(command_name, max_length=20)
        # Безопасное использование
        command = BotCommand(command_name=clean_name)
        db.add(command)
        db.commit()
    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
```

### 2. Используйте кэширование для часто запрашиваемых данных

```python
# ❌ Плохо
def get_user_voices(user_id: int):
    # Каждый раз запрос к БД
    return db.query(Voice).filter(Voice.owner_id == user_id).all()

# ✅ Хорошо
def get_user_voices(user_id: int):
    cache_key = f"user_voices_{user_id}"
    
    # Проверяем кэш
    cached = QueryOptimizer.get_cached(cache_key)
    if cached:
        return cached
    
    # Запрос к БД
    voices = db.query(Voice).filter(Voice.owner_id == user_id).all()
    
    # Сохраняем в кэш
    QueryOptimizer.set_cached(cache_key, voices, ttl=300)
    return voices
```

### 3. Используйте batch операции для множественных записей

```python
# ❌ Плохо
for data in large_data_list:
    stream = StreamData(**data)
    db.add(stream)
    db.commit()  # N транзакций!

# ✅ Хорошо
QueryOptimizer.bulk_insert_stream_data(db, large_data_list)  # 1 транзакция
```

### 4. Избегайте N+1 проблемы

```python
# ❌ Плохо
users = db.query(User).all()
for user in users:
    tokens = db.query(UserToken).filter(UserToken.user_id == user.id).all()  # N запросов!

# ✅ Хорошо
users = db.query(User).options(joinedload(User.tokens)).all()  # 1 запрос
```

### 5. Обрабатывайте ошибки валидации

```python
# ✅ Хорошо
@app.post("/api/commands")
async def create_command(command_data: dict):
    try:
        # Валидация имени команды
        InputValidator.validate_command_name(command_data['name'])
        
        # Санитизация ответа
        clean_response = InputValidator.sanitize_text(
            command_data['response'],
            max_length=500
        )
        
        # Создание команды
        command = BotCommand(
            command_name=command_data['name'],
            response_text=clean_response
        )
        db.add(command)
        db.commit()
        
        return {"success": True, "command": command_data['name']}
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating command: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

---

## 🧪 Тестирование

### Unit тесты для валидаторов

```python
import pytest
from utils.validators import InputValidator, ValidationError

def test_validate_username():
    # Валидные
    assert InputValidator.validate_username("user_123")
    assert InputValidator.validate_username("test-user")
    
    # Невалидные
    with pytest.raises(ValidationError):
        InputValidator.validate_username("a")  # Слишком короткое
    
    with pytest.raises(ValidationError):
        InputValidator.validate_username("user@123")  # Недопустимые символы

def test_sanitize_text():
    # XSS защита
    dangerous = "<script>alert('xss')</script>"
    safe = InputValidator.sanitize_text(dangerous)
    assert "<script>" not in safe
    assert "script" in safe  # Текст остается, теги удалены

def test_validate_youtube_url():
    # Валидный URL
    result = InputValidator.validate_youtube_url(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    )
    assert result['video_id'] == "dQw4w9WgXcQ"
    
    # Невалидный URL
    with pytest.raises(ValidationError):
        InputValidator.validate_youtube_url("https://example.com")
```

---

## 📊 Мониторинг и отладка

### Логирование использования кэша

```python
import logging

logger = logging.getLogger(__name__)

# В вашем коде
cached = QueryOptimizer.get_cached(cache_key)
if cached:
    logger.debug(f"Cache HIT: {cache_key}")
else:
    logger.debug(f"Cache MISS: {cache_key}")
```

### Метрики производительности

```python
import time

# Замер времени запроса
start = time.time()
result = QueryOptimizer.get_user_with_tokens(db, user_id)
duration = time.time() - start

logger.info(f"Query took {duration:.3f}s")

# Если запрос медленный, логируем
if duration > 1.0:
    logger.warning(f"Slow query detected: {duration:.3f}s for user {user_id}")
```

---

## 🚀 Быстрый старт

### Чеклист для нового эндпоинта

1. **Валидация входных данных**
   ```python
   try:
       InputValidator.validate_...()
       clean_data = InputValidator.sanitize_text(...)
   except ValidationError as e:
       raise HTTPException(400, str(e))
   ```

2. **Проверка кэша**
   ```python
   cached = QueryOptimizer.get_cached(cache_key)
   if cached:
       return cached
   ```

3. **Оптимизированный запрос к БД**
   ```python
   result = db.query(...).options(joinedload(...)).all()
   ```

4. **Сохранение в кэш**
   ```python
   QueryOptimizer.set_cached(cache_key, result, ttl=300)
   ```

5. **Логирование**
   ```python
   logger.info(f"Processed request for {user_id}")
   ```

6. **Обработка ошибок**
   ```python
   try:
       # Ваш код
   except Exception as e:
       logger.error(f"Error: {e}")
       raise HTTPException(500, "Internal error")
   ```

---

## 📖 Дополнительные ресурсы

- [OPTIMIZATION_REPORT.md](./OPTIMIZATION_REPORT.md) - Полный отчет по оптимизации
- [TECHNICAL_REPORT.md](./TECHNICAL_REPORT.md) - Техническая документация
- [PROJECT_REPORT.md](./PROJECT_REPORT.md) - Обзор проекта

---

**Дата создания:** 2025-10-05  
**Версия:** 1.0  
**Статус:** ✅ Актуально

