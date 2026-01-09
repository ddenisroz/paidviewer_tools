# 🎤 Единая Система Загрузки Голосов

**Дата:** 29 октября 2025  
**Последнее обновление:** 29 октября 2025 (Bugfix: frontend voice loading)  
**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО**

---

## 📊 Обзор

Все три варианта загрузки голосов теперь используют **единый подход**:
- ✅ Автоконвертация любого формата → WAV 48kHz Mono 16-bit
- ✅ Автотранскрибация через Faster-Whisper
- ✅ Полная очистка временных файлов
- ✅ Обработка ошибок с rollback

---

## 🎯 Три Способа Загрузки

### 1. Админка (`/dashboard/dolbaebadmintts`)

**Назначение:** Загрузка **глобальных** голосов (доступны всем пользователям)

**Endpoint:** `POST /api/admin/voices/upload`

**Процесс:**
```
MP3/FLAC/OGG → Temp → Конвертация WAV 48kHz → Транскрибация → audio/voices/global/{name}.wav
```

**Код:** `tts_service/admin_api.py:116`

**UI:** Кнопка **"Загрузить голос"** в админке

---

### 2. Пользовательские голоса (`/dashboard/tts/voices`)

**Назначение:** Загрузка **личных** голосов (только для whitelist пользователей)

**Endpoint:** `POST /api/tts/user/voices/upload`

**Процесс:**
```
MP3/FLAC/OGG → Temp → Конвертация WAV 48kHz → Транскрибация → audio/voices/user/{user_id}/{name}.wav
```

**Код:** `tts_service/api_endpoints.py:704`

**UI:** Кнопка **"Загрузить свой голос"**

**Особенности:**
- Требует `user_id` в Form data
- Проверка на whitelist
- Изоляция голосов по пользователям

**Дополнительные endpoint'ы:**
- `GET /api/user/voices/{user_id}` - список голосов пользователя
- `DELETE /api/user/voices/{voice_id}` - удаление своего голоса
- `PUT /api/user/voices/{voice_id}/rename` - переименование своего голоса
- `POST /api/tts/user/voices/{voice_id}/transcribe` - первичная транскрибация
- `POST /api/tts/user/voices/{voice_id}/retranscribe` - перетранскрибация (кнопка в UI)
- `PUT /api/tts/user/voices/{voice_id}/settings` - обновление настроек (reference_text, cfg_strength, speed_preset)

---

### 3. TTS Service Simple (`/dashboard/tts/local`)

**Назначение:** Локальный TTS сервис (независимый микросервис)

**Endpoint:** `POST /api/voices/{voice_id}/upload`

**Процесс:**
```
MP3/FLAC/OGG → Temp → Конвертация WAV 48kHz → Транскрибация → user_voices/{voice_id}/sample_{timestamp}.wav
```

**Код:** `tts_service_simple/main.py:645`

**UI:** Диалог настройки сэмпла с референсным текстом (`LocalTTSSettingsPage.jsx`)

**Особенности:**
- Работает автономно (без основного бота)
- Использует файловую систему вместо БД
- Поддерживает множественные сэмплы для одного голоса
- **НОВОЕ:** Диалог с настройками как в облачном TTS
- **НОВОЕ:** Автотранскрибация через Whisper

**Дополнительные endpoint'ы:**
- `POST /api/voices/{voice_id}/samples/{filename}/retranscribe` - перетранскрибация
- `PUT /api/voices/{voice_id}/samples/{filename}/update-text` - обновить текст вручную

---

## 🔄 Единый Алгоритм Обработки

Все три варианта используют **идентичную логику**:

### Шаг 1: Валидация
```python
allowed_extensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.aiff', '.au']
if file_extension not in allowed_extensions:
    raise HTTPException(400, "Неподдерживаемый формат")
```

### Шаг 2: Сохранение во временную директорию
```python
with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
    shutil.copyfileobj(file.file, temp_file)
    temp_input_path = temp_file.name
```

### Шаг 3: Конвертация в WAV 48kHz Mono 16-bit
```python
# tts_service: AsyncAudioConverter
converter = AsyncAudioConverter(max_workers=1)
success = converter._convert_audio_sync(temp_input_path, temp_converted_path, "task")

# tts_service_simple: librosa + soundfile
audio, sr = librosa.load(input_path, sr=48000, mono=True)
audio = librosa.util.normalize(audio)
sf.write(output_path, audio, 48000, subtype='PCM_16')
```

### Шаг 4: Автотранскрибация
```python
if tts_engine_manager.transcriber:  # или faster-whisper
    reference_text = transcribe(temp_converted_path)
```

### Шаг 5: Сохранение финального файла
```python
shutil.copy2(temp_converted_path, final_voice_path)
```

### Шаг 6: Создание записи в БД (или metadata.json)
```python
# tts_service
new_voice = VoiceModel(
    name=voice_name,
    file_path=str(final_voice_path),
    reference_text=reference_text,
    cfg_strength=2.5,
    speed_preset='normal'
)
db.add(new_voice)
db.commit()

# tts_service_simple
sample_metadata = {
    "filename": sample_filename,
    "text": sample_text,
    "format": "WAV 48kHz Mono 16-bit"
}
json.dump(samples_meta, f)
```

### Шаг 7: Cleanup временных файлов
```python
finally:
    if temp_input_path and os.path.exists(temp_input_path):
        os.remove(temp_input_path)
    if temp_converted_path and os.path.exists(temp_converted_path):
        os.remove(temp_converted_path)
```

---

## 🎨 UI Интеграция

### Админка
```jsx
// frontend/src/components/admin/VoiceManagement.jsx
<input 
    type="file" 
    accept=".wav,.mp3,.flac,.ogg,.m4a,.aac,.wma,.aiff,.au"
/>
```

### Пользовательские голоса
```jsx
// frontend/src/pages/tts/VoiceManagementPage.jsx
<Dialog>
    <DialogTrigger>
        <Button>Загрузить свой голос</Button>
    </DialogTrigger>
</Dialog>
```

### TTS Service Simple
```jsx
// frontend/src/pages/tts/LocalTTSSettingsPage.jsx
<Input
    type="file"
    accept=".wav,.mp3,.flac"
    onChange={(e) => uploadSample(voice.id, e.target.files[0])}
/>
```

---

## 📦 Зависимости

### tts_service
```txt
librosa>=0.10.1
soundfile>=0.12.1
pydub>=0.25.1
faster-whisper>=0.10.0
```

### tts_service_simple
```txt
librosa>=0.10.1
soundfile>=0.12.1
pydub>=0.25.1
faster-whisper>=0.10.0  # ДОБАВЛЕНО!
```

---

## 🧪 Тестирование

### 1. Админка
```bash
# Запусти TTS Service
cd tts_service
python main.py

# Открой http://localhost:5173/dashboard/dolbaebadmintts
# Нажми "Загрузить голос"
# Выбери MP3/FLAC файл
# Ожидай: автоконвертация + транскрибация
```

### 2. Пользовательские голоса
```bash
# Открой http://localhost:5173/dashboard/tts/voices
# Нажми "Загрузить свой голос"
# Выбери MP3/FLAC файл
# Ожидай: сохранение в audio/voices/user/{user_id}/
```

### 3. TTS Service Simple
```bash
# Запусти локальный TTS
cd tts_service_simple
python main.py

# Открой http://localhost:5173/dashboard/tts/local
# Создай голос → Загрузи сэмпл
# Ожидай: конвертация + транскрибация
```

---

## ✅ Результаты

### Было:
- ❌ Админка: MP3 сохранялся как есть
- ❌ Пользователи: endpoint не существовал
- ❌ Simple: файлы без конвертации

### Стало:
- ✅ **Все три системы:** единая обработка
- ✅ **Любой формат** → WAV 48kHz Mono 16-bit
- ✅ **Автотранскрибация** для всех
- ✅ **Полная очистка** временных файлов

---

## 📝 Changelog

**2025-10-29 (Session 3 - Bugfix)**
- 🐛 Исправлен баг загрузки голосов в админке
- ✅ Frontend теперь корректно парсит `data.voices` из backend ответа
- ✅ Голоса отображаются в `/dashboard/dolbaebadmintts` после загрузки

**2025-10-29 (Session 2)**
- ✅ Добавлена транскрибация для пользовательских голосов (`POST /api/tts/user/voices/{voice_id}/transcribe`)
- ✅ Добавлена перетранскрибация для пользовательских голосов (`POST /api/tts/user/voices/{voice_id}/retranscribe`)
- ✅ Добавлено обновление настроек для пользовательских голосов (`PUT /api/tts/user/voices/{voice_id}/settings`)
- ✅ Добавлен диалог настройки сэмпла в `tts_service_simple` (`LocalTTSSettingsPage.jsx`)
- ✅ Добавлены endpoint'ы для управления сэмплами в `tts_service_simple`:
  - `POST /api/voices/{voice_id}/samples/{filename}/retranscribe`
  - `PUT /api/voices/{voice_id}/samples/{filename}/update-text`

**2025-10-29 (Session 1)**
- ✅ Добавлена автоконвертация в админку (`tts_service/admin_api.py`)
- ✅ Добавлена перетранскрибация админских голосов (`POST /api/voices/{id}/retranscribe`)
- ✅ Создан endpoint для пользовательских голосов (`POST /api/tts/user/voices/upload`)
- ✅ Добавлены CRUD endpoints для пользовательских голосов
- ✅ Добавлена автоконвертация в `tts_service_simple`
- ✅ Добавлена автотранскрибация в `tts_service_simple`
- ✅ Обновлена документация

---

## 🚀 Следующие шаги

1. ✅ Протестировать все три способа загрузки
2. ✅ Убедиться, что все голоса в WAV формате
3. ✅ Проверить работу транскрибации
4. ✅ Очистить старые MP3/FLAC файлы (если есть)

---

**Все наработки интегрированы во все части системы!** 🎉

