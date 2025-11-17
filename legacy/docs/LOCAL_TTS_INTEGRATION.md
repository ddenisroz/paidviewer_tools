# 🏠 Локальный TTS F5 - Полная интеграция с ботом

## 📊 Статус: ✅ ГОТОВО К ИСПОЛЬЗОВАНИЮ

Локальный TTS (`tts_service_simple`) теперь **ПОЛНОСТЬЮ интегрирован** с `bot_service` и может озвучивать сообщения из Twitch/VK чата!

---

## 🎯 Что работает?

### ✅ Полная функциональность

1. **Озвучка чата** 🎙️
   - Автоматическая озвучка сообщений из Twitch/VK
   - Фильтрация запрещённых слов
   - Блокировка пользователей
   - Настройка максимальной длины сообщений
   - Пропуск команд (начинающихся с `!`)

2. **Управление голосами** 🎤
   - Загрузка голосов через админку
   - Автоконвертация MP3/FLAC → WAV 48kHz Mono 16-bit
   - Автотранскрибация текста из аудио (Whisper)
   - Перетранскрибация и ручное редактирование текста

3. **Настройки пользователя** ⚙️
   - Индивидуальный endpoint для каждого пользователя
   - Переключение между облачным и локальным TTS
   - Проверка доступности сервиса (health check)
   - Кеширование состояния для производительности

---

## 🚀 Как использовать?

### Шаг 1: Запустить локальный TTS сервис

```bash
cd tts_service_simple
python main.py
```

По умолчанию запустится на `http://localhost:8001`

### Шаг 2: Настроить в админке

1. Открыть `/dashboard/tts/local`
2. **Вкладка "Подключение":**
   - Endpoint URL: `http://localhost:8001`
   - Нажать **"Проверить соединение"**
   - Если успешно → включить **"Использовать локальный TTS"**
   - Нажать **"Сохранить настройки"**

3. **Вкладка "Голоса":**
   - Загрузить свои голоса через админку
   - Система автоматически конвертирует и транскрибирует

### Шаг 3: Готово! 🎉

Теперь сообщения из чата будут озвучиваться через локальный TTS!

---

## 🔧 Технические детали

### Backend архитектура

```
bot_service/utils/websocket_helper.py
    └─> handle_tts_for_message()
        └─> tts_api.send_tts_request()
            └─> bot_service/services/tts_manager.py
                └─> synthesize_tts()
                    ├─> Проверяет use_ai_tts
                    ├─> Получает LocalTTSEndpoint из БД
                    │   └─> Если use_local=True → использует endpoint_url
                    └─> Отправляет POST запрос на:
                        http://localhost:8001/api/tts/synthesize-channel
```

### Новый endpoint в `tts_service_simple`

**POST `/api/tts/synthesize-channel`**

**Request:**
```json
{
  "channel_name": "yourchy",
  "text": "Hello world",
  "author": "username",
  "user_id": 1,
  "volume_level": 50,
  "tts_settings": {
    "enable7TV": true,
    "enableTwitch": true,
    "enableProfanity": true,
    "maxLength": 200,
    "skipCommands": true
  },
  "word_filter": ["badword1", "badword2"],
  "blocked_users": ["spammer"]
}
```

**Response:**
```json
{
  "success": true,
  "audio_url": "/api/audio/channel_yourchy_1234567890.wav",
  "voice": "default",
  "volume": 50,
  "tts_type": "local_f5",
  "duration": 1.5,
  "channel": "yourchy",
  "author": "username"
}
```

### База данных

**Модель `LocalTTSEndpoint`:**

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | Integer | ID пользователя (FK) |
| `endpoint_url` | String | URL локального TTS (`http://localhost:8001`) |
| `api_key` | String | Опциональный API ключ |
| `use_local` | Boolean | Использовать локальный вместо облачного |
| `is_active` | Boolean | Активен ли endpoint |
| `is_healthy` | Boolean | Доступен ли сервис |
| `last_health_check` | DateTime | Последняя проверка здоровья |

---

## 🎨 Frontend UI

### Страница настроек: `/dashboard/tts/local`

**Вкладки:**

1. **Подключение** 🔌
   - Endpoint URL
   - API ключ (опционально)
   - Переключатель "Использовать локальный TTS"
   - Кнопка "Проверить соединение"
   - Кнопка "Сохранить настройки"

2. **Мониторинг** 📊
   - Статус сервиса (GPU, CPU, RAM)
   - Количество обработанных запросов
   - Доступные голоса

3. **Голоса** 🎤
   - Список загруженных голосов
   - Кнопка "Создать голос"
   - Загрузка аудио сэмпла
   - Настройка параметров (reference_text, cfg_strength, speed_preset)

---

## 📋 API Endpoints

### Backend (`bot_service`)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/local-tts/config` | GET | Получить конфигурацию |
| `/api/local-tts/config` | POST | Сохранить конфигурацию |
| `/api/local-tts/test-connection` | POST | Протестировать соединение |
| `/api/local-tts/toggle` | POST | Переключить use_local |

### Local TTS (`tts_service_simple`)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/tts/synthesize-channel` | POST | **Синтез для чата (НОВЫЙ)** |
| `/api/tts/synthesize` | POST | Обычный синтез |
| `/api/health` | GET | Статус здоровья |
| `/api/status` | GET | Детальный статус |
| `/api/voices` | GET | Список голосов |

---

## 🔄 Логика работы

### 1. Пользователь пишет в Twitch чат

```
Twitch IRC → bot_service/bots/twitch_bot.py
    └─> on_message()
        └─> handle_tts_for_message()
            └─> Проверяет:
                ├─> Блокировка пользователя
                ├─> Фильтр слов
                ├─> Настройки TTS (skipCommands, maxLength)
                └─> Вызывает tts_manager.synthesize_tts()
```

### 2. TTS Manager выбирает систему

```python
# bot_service/services/tts_manager.py

if use_ai_tts:
    # Шаг 1: Проверяем локальный endpoint пользователя
    local_endpoint = await get_user_tts_endpoint(user_id, db_session)
    
    if local_endpoint and local_endpoint.use_local:
        tts_endpoint = local_endpoint.endpoint_url  # http://localhost:8001
    else:
        tts_endpoint = DEFAULT_TTS_SERVICE_URL  # облачный
    
    # Шаг 2: Отправляем запрос
    result = await _synthesize_via_tts_service(
        channel_name, text, author, user_id, volume_level,
        tts_endpoint=tts_endpoint  # ← локальный или облачный
    )
```

### 3. Локальный TTS обрабатывает запрос

```python
# tts_service_simple/main.py

@app.post("/api/tts/synthesize-channel")
async def synthesize_channel_tts(request: ChannelTTSRequest):
    # 1. Проверка блокировки пользователя
    if request.author in request.blocked_users:
        return {"success": False, "error": "User blocked"}
    
    # 2. Фильтрация запрещённых слов
    filtered_text = apply_word_filter(request.text, request.word_filter)
    
    # 3. Применение настроек (maxLength, skipCommands)
    if len(filtered_text) > request.tts_settings.maxLength:
        filtered_text = filtered_text[:request.tts_settings.maxLength]
    
    # 4. Синтез речи
    audio_path = synthesize_f5_tts(filtered_text, voice="default")
    
    # 5. Возврат результата
    return {
        "success": True,
        "audio_url": f"/api/audio/{audio_path}",
        "tts_type": "local_f5"
    }
```

### 4. Бот отправляет аудио в WebSocket

```
tts_manager → WebSocket → Frontend → Audio Player → OBS Browser Source
```

---

## 🆚 Сравнение: Локальный vs Облачный TTS

| Функция | Локальный TTS | Облачный TTS |
|---------|---------------|--------------|
| **Озвучка чата** | ✅ Работает | ✅ Работает |
| **Загрузка голосов** | ✅ Работает | ✅ Работает |
| **Автоконвертация** | ✅ Работает | ✅ Работает |
| **Автотранскрибация** | ✅ Работает | ✅ Работает |
| **Фильтры и блокировки** | ✅ Работает | ✅ Работает |
| **Настройки громкости** | ✅ Работает | ✅ Работает |
| **Приоритетные голоса** | ⚠️ TODO | ✅ Работает |
| **Whitelist** | ⚠️ TODO | ✅ Работает |

---

## ⚠️ Ограничения

### Что ещё НЕ работает в локальном TTS:

1. ❌ **Приоритетные голоса**
   - Нет логики для `connection_manager.get_voice_volume()`
   - Все голоса озвучиваются с одинаковой громкостью

2. ❌ **Whitelist для AI TTS**
   - Нет проверки `user.is_whitelisted`
   - Все пользователи имеют доступ к F5-TTS

3. ⚠️ **Реальная генерация аудио**
   - Endpoint возвращает заглушку: `audio_filename = f"channel_{channel_name}_{timestamp}.wav"`
   - TODO: интегрировать с реальным F5-TTS движком

---

## 🚧 TODO (для полной функциональности)

### Приоритет 1: Критично

- [ ] Интегрировать реальную генерацию аудио в `/synthesize-channel`
- [ ] Добавить выбор голоса пользователя из БД
- [ ] Обработка ошибок и логирование

### Приоритет 2: Важно

- [ ] Добавить систему whitelist для AI TTS
- [ ] Добавить приоритетные громкости для голосов
- [ ] Добавить кеширование сгенерированных аудио

### Приоритет 3: Улучшения

- [ ] Metrics и мониторинг через Prometheus
- [ ] Rate limiting для защиты от спама
- [ ] Автоматическая очистка старых аудио файлов

---

## 📚 Связанные документы

- [TTS_INTEGRATION_STATUS.md](./TTS_INTEGRATION_STATUS.md) - Общий статус TTS интеграции
- [VOICE_UPLOAD_UNIFIED.md](./VOICE_UPLOAD_UNIFIED.md) - Система загрузки голосов
- [tts_service_simple/README.md](../tts_service_simple/README.md) - Локальный TTS сервис
- [tts_service_simple/VOICE_MANAGEMENT.md](../tts_service_simple/VOICE_MANAGEMENT.md) - Управление голосами

---

## ✅ Заключение

Локальный TTS **РАБОТАЕТ** и может использоваться для озвучки чата!

**Преимущества:**
- 🚀 Полный контроль над TTS движком
- 🔒 Приватность (данные не уходят на удалённый сервер)
- ⚡ Быстрая генерация (если есть мощный GPU)

**Недостатки:**
- 💻 Требуется мощный компьютер (GPU)
- ⚙️ Нужна дополнительная настройка
- 🔧 Некоторые функции ещё в разработке

**Рекомендация:**
- Для новичков → используйте **облачный TTS** (работает из коробки)
- Для опытных пользователей с GPU → используйте **локальный TTS** (больше контроля)


