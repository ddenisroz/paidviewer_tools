# 🎯 TTS - Поток управления и обработки

**Дата:** 27 октября 2025  
**Версия:** 1.0

---

## 📊 Полная диаграмма потока

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ПОЛЬЗОВАТЕЛЬ                                  │
│                                                                       │
│  🌐 Веб-интерфейс: http://localhost:8000/dashboard                  │
│     ├─ /tts/                  → Настройки TTS                       │
│     ├─ /tts/voices            → Облачные голоса (whitelist)         │
│     └─ /tts/local             → Локальный TTS                       │
│                                                                       │
│  💬 Чат (Twitch/VK):                                                 │
│     ├─ "Привет всем!" → текст для озвучки                          │
│     ├─ !voice myvoice → выбор голоса                               │
│     ├─ !ttsvolume 80  → громкость                                  │
│     └─ !mute username → заглушить пользователя                     │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│              BOT SERVICE (localhost:8000)                             │
│                                                                       │
│  📦 Что хранится в БД (bot_service/data/app_data.db):               │
│     ├─ user.tts_volume              → Громкость (0-100)             │
│     ├─ user.tts_enabled             → Включен ли TTS                │
│     ├─ user.selected_voice          → Выбранный голос               │
│     ├─ user.use_local_tts           → Локальный/Облачный            │
│     ├─ user.local_tts_endpoint      → URL локального TTS            │
│     ├─ user.local_tts_api_key       → API ключ                      │
│     ├─ blocked_users                → Черный список                 │
│     └─ filtered_words               → Фильтр слов                   │
│                                                                       │
│  🎛️ Обработка команд:                                               │
│     ┌────────────────────────────────────────────────┐              │
│     │  UniversalCommandHandler                       │              │
│     │                                                │              │
│     │  !voice <name>:                               │              │
│     │    1. user = get_user(user_id)                │              │
│     │    2. if user.use_local_tts:                  │              │
│     │         voices = fetch_local_voices()         │              │
│     │       else:                                   │              │
│     │         voices = fetch_cloud_voices()         │              │
│     │    3. if voice in voices:                     │              │
│     │         user.selected_voice = voice           │              │
│     │         save_to_db(user)                      │              │
│     └────────────────────────────────────────────────┘              │
│                                                                       │
│  🎙️ Обработка TTS сообщения:                                        │
│     ┌────────────────────────────────────────────────┐              │
│     │  TTSManager.synthesize_tts()                  │              │
│     │                                                │              │
│     │  1. Применить фильтры (на стороне бота!)     │              │
│     │     • Проверить blocked_users                 │              │
│     │     • Проверить filtered_words                │              │
│     │                                                │              │
│     │  2. Получить настройки пользователя:          │              │
│     │     • volume = user.tts_volume                │              │
│     │     • voice = user.selected_voice             │              │
│     │     • use_local = user.use_local_tts          │              │
│     │                                                │              │
│     │  3. Выбрать источник TTS:                     │              │
│     │     if use_local:                             │              │
│     │       endpoint = user.local_tts_endpoint      │              │
│     │       ┌──> LOCAL TTS                          │              │
│     │     else:                                     │              │
│     │       endpoint = DEFAULT_TTS_URL              │              │
│     │       └──> CLOUD TTS или gTTS                 │              │
│     │                                                │              │
│     │  4. POST {endpoint}/api/tts/synthesize        │              │
│     │     • text: "Привет всем!"                    │              │
│     │     • voice: user.selected_voice              │              │
│     │     • user_id: user.id                        │              │
│     │                                                │              │
│     │  5. Получить WAV файл                         │              │
│     │  6. Применить громкость (bot side!)           │              │
│     │  7. Отправить в OBS/плеер                     │              │
│     └────────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
                        │                     │
                        │                     │
          ┌─────────────┘                     └─────────────┐
          │                                                  │
          ▼                                                  ▼
┌───────────────────────┐                    ┌──────────────────────────┐
│   LOCAL TTS           │                    │   CLOUD TTS              │
│   (User's PC)         │                    │   (Server)               │
│                       │                    │                          │
│  📍 localhost:8001    │                    │  📍 localhost:8001       │
│     (или другой порт) │                    │     (фиксированный)      │
│                       │                    │                          │
│  🖥️ Где работает:     │                    │  ☁️ Где работает:        │
│   • Компьютер польз.  │                    │   • Сервер с ботом       │
│   • Своя GPU          │                    │   • Общая GPU            │
│                       │                    │                          │
│  📁 Что хранится:     │                    │  📁 Что хранится:        │
│   ├─ user_voices/     │                    │   ├─ user_configs/       │
│   │   ├─ custom_1/    │                    │   │   ├─ user_1/         │
│   │   │   ├─ meta..   │                    │   │   │   ├─ voice.json  │
│   │   │   └─ *.wav    │                    │   │   │   └─ samples/    │
│   │   └─ custom_2/    │                    │   │   └─ user_2/         │
│   ├─ generated_audio/ │                    │   ├─ generated_audio/    │
│   └─ models/          │                    │   └─ models/             │
│                       │                    │                          │
│  🎤 API:              │                    │  🎤 API:                 │
│   POST /api/tts/      │                    │   POST /api/tts/         │
│        synthesize     │                    │        synthesize        │
│   GET /api/voices/    │                    │   GET /api/voices        │
│        list           │                    │                          │
│   POST /api/voices/   │                    │   POST /api/voices       │
│        create         │                    │                          │
│   POST /api/voices/   │                    │   POST /api/voices/      │
│        {id}/upload    │                    │        {id}/upload       │
│                       │                    │                          │
│  ⚙️ Что делает:       │                    │  ⚙️ Что делает:          │
│   1. Получает запрос  │                    │   1. Получает запрос     │
│   2. Загружает модель │                    │   2. Загружает модель    │
│   3. Генерирует WAV   │                    │   3. Генерирует WAV      │
│   4. Возвращает файл  │                    │   4. Возвращает файл     │
│                       │                    │                          │
│  📤 Файл возвращается │                    │  📤 Файл возвращается    │
│     обратно в бот     │                    │     обратно в бот        │
└───────────────────────┘                    └──────────────────────────┘
          │                                                  │
          └──────────────────┐      ┌──────────────────────┘
                             │      │
                             ▼      ▼
                    ┌──────────────────────┐
                    │   BOT SERVICE        │
                    │   Audio Player       │
                    │                      │
                    │  🔊 OBS/Плеер        │
                    │  • Воспроизведение   │
                    │  • Управление        │
                    │    громкостью        │
                    └──────────────────────┘
```

---

## 🎯 Ключевые моменты

### ✅ Что управляется через бот (веб-интерфейс):

| Функция | Где хранится | Как управляется |
|---------|--------------|-----------------|
| **Громкость** | БД бота | UI `/tts/` или `!ttsvolume` |
| **Фильтры** | БД бота | UI `/tts/` (черный список, слова) |
| **Выбор голоса** | БД бота | Команда `!voice <name>` |
| **Включить/выключить TTS** | БД бота | UI `/tts/` или `!mute`/`!unmute` |
| **Локальный/Облачный** | БД бота | UI `/tts/local` (переключатель) |
| **Endpoint локального TTS** | БД бота | UI `/tts/local` (ввод URL) |

### 📁 Что хранится локально (на ПК пользователя):

| Данные | Где хранится | Размер |
|--------|--------------|--------|
| **Референсные аудио** | `user_voices/{id}/*.wav` | ~5-50 MB |
| **Сгенерированные WAV** | `generated_audio/*.wav` | ~1-5 MB каждый |
| **Модели F5-TTS** | `models/*.pth` | ~500 MB - 2 GB |
| **Конфигурация** | `config.json` | ~1 KB |

### 🔄 Что НЕ хранится локально:

- ❌ База данных пользователей
- ❌ Настройки фильтров
- ❌ Черный список
- ❌ История команд
- ❌ Выбранный голос (хранится в БД бота)
- ❌ Настройки громкости

---

## 🚀 Пример: Полный workflow

### Сценарий: Пользователь пишет в чат

```
1. Пользователь в Twitch чате: "Привет всем!"
   └─> TwitchIO получает сообщение

2. Bot Service обрабатывает:
   ├─ Проверяет: user.tts_enabled? ✅
   ├─ Проверяет: user in blocked_users? ❌
   ├─ Проверяет: text has filtered_words? ❌
   └─> Все проверки пройдены ✅

3. Получаем настройки из БД:
   ├─ user.tts_volume = 80
   ├─ user.selected_voice = "custom_abc123"
   ├─ user.use_local_tts = True
   └─ user.local_tts_endpoint = "http://localhost:8002"

4. Отправляем запрос на ЛОКАЛЬНЫЙ TTS:
   POST http://localhost:8002/api/tts/synthesize
   {
     "text": "Привет всем!",
     "voice": "custom_abc123",
     "user_id": 1
   }

5. ЛОКАЛЬНЫЙ TTS (на ПК пользователя):
   ├─ Загружает модель F5-TTS
   ├─ Загружает сэмплы из user_voices/custom_abc123/
   ├─ Генерирует WAV файл (используя свою GPU!)
   ├─ Сохраняет в generated_audio/tts_123456.wav
   └─> Возвращает файл обратно боту

6. Bot Service получает WAV:
   ├─ Применяет громкость 80% (на стороне бота!)
   └─> Отправляет в OBS/плеер

7. 🔊 Звук воспроизводится на стриме
```

---

## 💡 Важные принципы

### 1. Централизованное управление
```
✅ Все настройки управляются через сайт
✅ Команды обрабатываются ботом
✅ Фильтры применяются на стороне бота
✅ Громкость управляется ботом
```

### 2. Децентрализованное хранение
```
✅ Голоса хранятся локально (экономия места на сервере)
✅ WAV файлы генерируются локально (экономия CPU/GPU сервера)
✅ Модели хранятся локально (не занимают место на сервере)
```

### 3. Гибкость источника
```
if user.use_local_tts:
    ┌─> Локальный TTS (свой GPU, свои голоса)
else:
    └─> Облачный TTS (сервер, требует whitelist)
```

### 4. Прозрачность для пользователя
```
Пользователь НЕ знает откуда берётся озвучка:
• Команды работают одинаково
• Фильтры работают одинаково
• Громкость управляется одинаково
• UI одинаковый

Разница только в:
• Скорости генерации (зависит от GPU)
• Доступных голосах (свои vs облачные)
```

---

## 🔧 Техническая реализация

### Bot Service (`tts_manager.py`)

```python
async def synthesize_tts(self, user_id, text, ...):
    # 1. Применяем фильтры (БОТ!)
    if self._is_filtered(text, word_filter):
        return {"success": False, "reason": "filtered"}
    
    if self._is_user_blocked(author, blocked_users):
        return {"success": False, "reason": "blocked"}
    
    # 2. Получаем endpoint
    tts_endpoint = self.tts_service_url  # Default cloud
    
    if user_id and db_session:
        local_endpoint = await self.get_user_tts_endpoint(user_id, db_session)
        if local_endpoint:
            tts_endpoint = local_endpoint  # Override with local
    
    # 3. Отправляем запрос
    result = await self._synthesize_via_tts_service(
        text, voice, tts_endpoint=tts_endpoint
    )
    
    # 4. Применяем громкость (БОТ!)
    audio_with_volume = self._apply_volume(result['audio'], volume_level)
    
    return audio_with_volume
```

### Local TTS (`main.py`)

```python
@app.post("/api/tts/synthesize")
async def synthesize_tts(request: TTSRequest):
    # 1. Загружаем голос
    voice_path = config.voices_dir / request.voice
    samples = load_samples(voice_path)
    
    # 2. Генерируем аудио (используем локальную GPU!)
    audio_data = f5_tts.generate(
        text=request.text,
        reference_audio=samples
    )
    
    # 3. Сохраняем (локально!)
    output_path = Path("generated_audio") / f"tts_{timestamp}.wav"
    save_audio(audio_data, output_path)
    
    # 4. Возвращаем файл
    return FileResponse(output_path)
```

---

## 📖 См. также

- `docs/LOCAL_VS_CLOUD_TTS_ARCHITECTURE.md` - Сравнение режимов
- `tts_service_simple/VOICE_MANAGEMENT.md` - Управление голосами
- `bot_service/services/tts_manager.py` - Реализация выбора TTS
- `frontend/src/pages/tts/LocalTTSSettingsPage.jsx` - UI управления

---

**Статус:** ✅ Fully Implemented  
**Тестирование:** ⏳ Ready for Testing  
**Документация:** ✅ Complete

