# 🎤 Состояние интеграции TTS систем

**Дата:** 29 октября 2025  
**Проверка:** Облачный TTS (tts_service) vs Локальный TTS (tts_service_simple)

---

## 📊 Краткое резюме

| Аспект | Облачный TTS | Локальный TTS | Статус |
|--------|--------------|---------------|--------|
| **Получение настроек из БД** | ✅ Полностью | ⚠️ Частично | 🔧 Требует доработки |
| **Озвучка сообщений из чата** | ✅ Работает | ❌ НЕ работает | 🔧 Требует доработки |
| **Управление голосами** | ✅ Работает | ✅ Работает | ✅ OK |
| **Автоконвертация/Транскрибация** | ✅ Работает | ✅ Работает | ✅ OK |
| **UI настроек** | ✅ Работает | ✅ Работает | ✅ OK |

---

## 🌐 Облачный TTS (tts_service) - ✅ ПОЛНОСТЬЮ РАБОТАЕТ

### 1. ✅ Получение настроек из БД

**Где хранятся настройки:**
```python
# tts_service/database.py

class User(Base):
    id = Column(Integer, primary_key=True)
    tts_max_text_length = Column(Integer, default=200)
    tts_daily_limit = Column(Integer, default=100)
    tts_gpu_time_limit = Column(Float, default=300.0)
    tts_priority_level = Column(Integer, default=2)
    tts_enabled = Column(Boolean, default=True)

class Voice(Base):
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    reference_text = Column(String, nullable=True)
    cfg_strength = Column(Float, default=2.5)
    speed_preset = Column(String, default='normal')
    owner_id = Column(Integer, ForeignKey('users.id'))
```

**Как получает настройки:**
```python
# tts_service/tts_limits_service.py:32

def get_user_limits(self, user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    return {
        'max_text_length': user.tts_max_text_length,
        'daily_limit': user.tts_daily_limit,
        'gpu_time_limit': user.tts_gpu_time_limit,
        'priority_level': user.tts_priority_level,
        'tts_enabled': user.tts_enabled
    }
```

**API Endpoints:**
- `GET /api/tts/user/limits/{user_id}` - получить лимиты
- `PUT /api/tts/user/limits/{user_id}` - обновить лимиты

---

### 2. ✅ Озвучка сообщений из чата

**Полный поток:**

```
1. Twitch/VK чат
   ↓
2. bot_service/bots/twitch_bot.py (_handle_tts)
   ↓
3. bot_service/utils/websocket_helper.py (handle_tts_for_message)
   ↓
   - Загружает TTSUserSettings из bot_service БД
   - Проверяет фильтры, блокировки
   - Определяет use_ai_tts / use_basic_tts
   ↓
4. bot_service/services/tts_manager.py (synthesize_tts)
   ↓
   Decision: AI TTS или Basic TTS?
   ↓
5a. AI TTS: HTTP POST → tts_service:8001/synthesize-channel
    {
        "channel_name": "yourchy",
        "text": "Hello",
        "author": "username",
        "user_id": 1,
        "volume_level": 50,
        "tts_settings": {...}
    }
    ↓
    tts_service получает настройки из СВОЕЙ БД
    ↓
    Генерирует аудио
    ↓
    Возвращает audio_url
    
5b. Basic TTS: Локальный gTTS в bot_service
    ↓
    Генерирует WAV файл
    ↓
    Возвращает file path
    
6. bot_service отправляет аудио на фронтенд через WebSocket
   ↓
7. Фронтенд воспроизводит аудио
```

**Код интеграции:**

```python
# bot_service/utils/websocket_helper.py:404

await tts_api.send_tts_request(
    channel_name=channel_identifier,
    text=text_for_tts,
    author=username,
    user_id=user_id,
    volume_level=volume_level,
    use_ai_tts=use_ai_tts,
    use_basic_tts=use_basic_tts,
    connection_manager=connection_manager,
    tts_settings={
        "enable7TV": tts_user_settings.enable_7tv,
        "enableTwitch": tts_user_settings.enable_twitch,
        "enableProfanity": tts_user_settings.enable_lexicon_filter,
        "maxLength": tts_user_settings.max_message_length,
        "skipCommands": tts_user_settings.skip_commands
    }
)
```

**Статус:** ✅ **ПОЛНОСТЬЮ РАБОТАЕТ**

---

## 💻 Локальный TTS (tts_service_simple) - ⚠️ ЧАСТИЧНО РАБОТАЕТ

### 1. ⚠️ Получение настроек из БД

**Где хранятся настройки:**

```python
# bot_service/core/database.py:456

class LocalTTSEndpoint(Base):
    __tablename__ = 'local_tts_endpoints'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    session_id = Column(String, nullable=True)
    
    # Конфигурация endpoint
    endpoint_url = Column(String, nullable=False)  # http://localhost:8001
    api_key = Column(String, nullable=True)
    use_local = Column(Boolean, default=False)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

**Как работает:**

1. **Пользователь настраивает** через `/dashboard/tts/local`:
   - Указывает endpoint_url (например: `http://localhost:8001`)
   - Указывает api_key (опционально)
   - Включает `use_local = true`

2. **bot_service сохраняет** в `LocalTTSEndpoint`:
   ```python
   # bot_service/api/tts_api.py (endpoint /local-tts/config)
   
   endpoint = LocalTTSEndpoint(
       user_id=user_id,
       endpoint_url=config.endpoint_url,
       api_key=config.api_key,
       use_local=config.use_local
   )
   db.add(endpoint)
   db.commit()
   ```

3. **TTS Manager проверяет** наличие локального endpoint:
   ```python
   # bot_service/services/tts_manager.py:49
   
   async def get_user_tts_endpoint(self, user_id: int, db_session):
       endpoint = db_session.query(LocalTTSEndpoint).filter(
           LocalTTSEndpoint.user_id == user_id,
           LocalTTSEndpoint.use_local == True
       ).first()
       
       if endpoint:
           return endpoint.endpoint_url  # http://localhost:8001
       return None
   ```

4. **При озвучке** использует локальный endpoint:
   ```python
   # bot_service/services/tts_manager.py:169-173
   
   tts_endpoint = self.tts_service_url  # по умолчанию облачный
   if user_id and db_session:
       local_endpoint = await self.get_user_tts_endpoint(user_id, db_session)
       if local_endpoint:
           tts_endpoint = local_endpoint  # переключаемся на локальный!
   ```

**Проблема:**
- ✅ TTS Manager умеет переключаться на локальный endpoint
- ✅ Настройки хранятся в БД
- ❌ **НО!** tts_service_simple **НЕ ИМЕЕТ** endpoint `/synthesize-channel`!

---

### 2. ❌ Озвучка сообщений из чата - **НЕ РАБОТАЕТ**

**Текущий поток:**

```
1. Twitch/VK чат
   ↓
2. bot_service/bots/twitch_bot.py
   ↓
3. bot_service/utils/websocket_helper.py
   ↓
4. bot_service/services/tts_manager.py
   ↓
   Проверяет: есть ли локальный endpoint?
   ↓
   ✅ Да! Использует http://localhost:8001
   ↓
5. HTTP POST → http://localhost:8001/synthesize-channel
   ↓
   ❌ 404 NOT FOUND!
   ↓
   Fallback на Basic TTS (gTTS)
```

**Проблема:**

`tts_service_simple/main.py` **НЕ ИМЕЕТ** endpoint `/synthesize-channel`!

**Доступные endpoints в tts_service_simple:**
```python
# tts_service_simple/main.py

✅ GET  /health
✅ GET  /status
✅ POST /synthesize  # ДЛЯ ПРЯМОГО ВЫЗОВА (не из чата!)
✅ POST /voices/create
✅ POST /voices/{voice_id}/upload
❌ POST /synthesize-channel  # НЕТ ТАКОГО!
```

**Что НЕ работает:**
1. Автоматическая озвучка сообщений из чата через локальный TTS
2. Передача настроек пользователя в локальный TTS
3. Интеграция с TTS Channel Points Mode
4. Фильтрация forbidden words через локальный TTS
5. Передача volume_level, tts_settings

---

## 🔧 Требуемые доработки для локального TTS

### Критические (для работы озвучки чата):

#### 1. Добавить endpoint `/synthesize-channel` в `tts_service_simple/main.py`

```python
@app.post("/synthesize-channel")
async def synthesize_channel(request: dict):
    """
    Синтезировать аудио для канала (совместимость с tts_service)
    
    Request body:
    {
        "channel_name": "yourchy",
        "text": "Hello world",
        "author": "username",
        "user_id": 1,
        "volume_level": 50,
        "tts_settings": {...},
        "word_filter": [...],
        "blocked_users": [...]
    }
    """
    try:
        channel_name = request.get("channel_name")
        text = request.get("text")
        author = request.get("author")
        user_id = request.get("user_id")
        volume_level = request.get("volume_level", 50)
        tts_settings = request.get("tts_settings", {})
        word_filter = request.get("word_filter", [])
        blocked_users = request.get("blocked_users", [])
        
        # Применяем фильтры (если нужно)
        # ...
        
        # Синтезируем речь
        result = await synthesize_speech_local(
            text=text,
            voice="default",
            volume=volume_level
        )
        
        return {
            "success": True,
            "audio_url": result["audio_url"],
            "voice": result["voice"],
            "duration": result["duration"],
            "tts_type": "local_f5"
        }
        
    except Exception as e:
        logger.error(f"Error in synthesize_channel: {e}")
        return {
            "success": False,
            "error": str(e)
        }
```

#### 2. Добавить систему хранения настроек пользователя

Опции:
- **A) Использовать SQLite БД** (как у tts_service)
- **B) Использовать JSON файлы** (проще, но менее масштабируемо)
- **C) Получать настройки из bot_service** (через API)

Рекомендация: **B) JSON файлы** для простоты

```python
# tts_service_simple/user_settings.py

import json
from pathlib import Path

class UserSettingsManager:
    def __init__(self):
        self.settings_file = Path("user_configs/settings.json")
        self.settings_file.parent.mkdir(exist_ok=True)
    
    def get_user_settings(self, user_id: int):
        if not self.settings_file.exists():
            return self.get_default_settings()
        
        with open(self.settings_file, 'r') as f:
            all_settings = json.load(f)
        
        return all_settings.get(str(user_id), self.get_default_settings())
    
    def get_default_settings(self):
        return {
            "max_text_length": 200,
            "volume": 50,
            "voice": "default"
        }
```

#### 3. Интеграция с фильтрами и блокировками

```python
def apply_word_filter(text: str, word_filter: list) -> str:
    """Фильтрация запрещенных слов"""
    filtered = text
    for word in word_filter:
        filtered = filtered.replace(word, "***")
    return filtered

def is_user_blocked(author: str, blocked_users: list) -> bool:
    """Проверка блокировки пользователя"""
    return author.lower() in [u.lower() for u in blocked_users]
```

---

## 📋 План действий

### Приоритет 1: Минимальная работа озвучки чата

- [ ] Добавить endpoint `/synthesize-channel` в `tts_service_simple`
- [ ] Добавить обработку volume_level
- [ ] Добавить базовую фильтрацию текста
- [ ] Тестирование с реальным чатом

### Приоритет 2: Полная интеграция

- [ ] Добавить систему хранения настроек пользователя
- [ ] Добавить поддержку word_filter и blocked_users
- [ ] Добавить поддержку tts_settings (enable7TV, enableTwitch и т.д.)
- [ ] Добавить логирование использования

### Приоритет 3: Дополнительные функции

- [ ] Интеграция с TTS Channel Points Mode
- [ ] Поддержка множественных голосов на пользователя
- [ ] API для управления настройками через фронтенд
- [ ] Синхронизация с облачным TTS

---

## 🎯 Рекомендации

### Для быстрого старта:
**Используй облачный TTS (tts_service)** - он полностью интегрирован и работает "из коробки"

### Для локального TTS:
1. Добавь `/synthesize-channel` endpoint (30 минут работы)
2. Протестируй базовую озвучку чата
3. Постепенно добавляй остальные функции

### Для production:
- **Облачный TTS** - для пользователей без GPU
- **Локальный TTS** - для опытных пользователей с мощным железом

---

## 📊 Итоговая таблица

| Функция | Облачный TTS | Локальный TTS | Приоритет исправления |
|---------|--------------|---------------|----------------------|
| Endpoint /synthesize-channel | ✅ Есть | ❌ Нет | 🔥 Критический |
| Получение user settings | ✅ БД | ❌ Нет | 🔥 Критический |
| Фильтрация текста | ✅ Работает | ❌ Нет | ⚠️ Важный |
| Volume control | ✅ Работает | ⚠️ Частично | ⚠️ Важный |
| Блокировка пользователей | ✅ Работает | ❌ Нет | ℹ️ Средний |
| Управление голосами | ✅ Работает | ✅ Работает | ✅ OK |
| Автоконвертация | ✅ Работает | ✅ Работает | ✅ OK |
| Транскрибация | ✅ Работает | ✅ Работает | ✅ OK |

---

**Вывод:** Облачный TTS **полностью работает**. Локальный TTS **требует критических доработок** для озвучки чата.


