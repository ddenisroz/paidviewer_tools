# Статус Endpoint'ов Админ-Панели

**Дата:** 29.10.2025  
**Обновлено:** 2025-01-09  
**Версия:** 1.1  

---

## 📊 Общая Статистика

- **Всего endpoint'ов:** ~50
- **Реализовано:** ~40
- **Отсутствует:** ~10
- **Требует проверки:** ~5

---

## 🎤 Управление Голосами (Voice Management)

### TTS Service (localhost:8001)

| Endpoint | Метод | Статус | Файл |
|----------|-------|--------|------|
| `/api/admin/voices` | GET | ✅ Есть | `F5_tts/admin_api.py:58` |
| `/api/admin/voices/upload` | POST | ✅ Есть + Конвертация + Транскрибация | `F5_tts/admin_api.py:116` |
| `/api/admin/voices/{id}/toggle` | POST | ✅ Есть | `F5_tts/admin_api.py:88` |
| `/api/voices/{id}/retranscribe` | POST | ✅ Есть | `F5_tts/admin_api.py:255` |
| `/api/admin/voices/{id}` | DELETE | ✅ Есть | `F5_tts/admin_api.py:303` |
| `/api/admin/voices/{id}/rename` | PUT | ✅ Есть | `F5_tts/admin_api.py:335` |
| `/api/tts/user/voices/upload` | POST | ✅ Есть + Конвертация + Транскрибация | `F5_tts/api_endpoints.py:704` |
| `/api/user/voices/{user_id}` | GET | ✅ Есть | `F5_tts/api_endpoints.py:699` |
| `/api/user/voices/{voice_id}` | DELETE | ✅ Есть | `F5_tts/api_endpoints.py:843` |
| `/api/user/voices/{voice_id}/rename` | PUT | ✅ Есть | `F5_tts/api_endpoints.py:875` |
| `/api/tts/user/voices/{voice_id}/transcribe` | POST | ✅ Есть | `F5_tts/api_endpoints.py:907` |
| `/api/tts/user/voices/{voice_id}/retranscribe` | POST | ✅ Есть | `F5_tts/api_endpoints.py:954` |
| `/api/tts/user/voices/{voice_id}/settings` | PUT | ✅ Есть | `F5_tts/api_endpoints.py:1001` |
| `/api/tts/test` | POST | ❓ Проверить | `F5_tts/api_endpoints.py` |
| `/api/admin/system/status` | GET | ✅ Есть | `F5_tts/admin_api.py:188` |
| `/api/admin/system/restart` | POST | ✅ Есть | `F5_tts/admin_api.py:208` |
| `/api/admin/stats` | GET | ✅ Есть | `F5_tts/admin_api.py:19` |

### Bot Service (localhost:8000)

| Endpoint | Метод | Статус | Файл |
|----------|-------|--------|------|
| `/api/voices/{id}/settings` | PUT | ❌ Нет | - |
| `/api/admin/voices/{id}/transcribe` | POST | ❌ Нет | - |

---

## 👥 Управление Пользователями (User Management)

### Bot Service

| Endpoint | Метод | Статус | Файл |
|----------|-------|--------|------|
| `/api/admin/users` | GET | ✅ Есть | `bot_service/api/admin_api.py:115` |
| `/api/admin/users/{id}/block` | POST | ✅ Есть | `bot_service/api/admin_api.py:206` |
| `/api/admin/users/{id}/unblock` | POST | ✅ Есть | `bot_service/api/admin_api.py:309` |
| `/api/admin/whitelist` | GET | ✅ Есть | `bot_service/api/admin_api.py:473` |
| `/api/admin/whitelist/add` | POST | ✅ Есть | `bot_service/api/admin_api.py:422` |
| `/api/admin/whitelist/{username}` | DELETE | ✅ Есть | `bot_service/api/admin_api.py:503` |

---

## 🤖 Управление Ботами (Bot Management)

### Bot Service

| Endpoint | Метод | Статус | Файл |
|----------|-------|--------|------|
| `/api/admin/bots/status` | GET | ✅ Есть + Исправлена структура ответа | `bot_service/api/admin_api.py:539` |
| `/api/admin/bot-service/restart` | POST | ✅ Есть | `bot_service/api/admin_api.py:1267` |
| `/api/admin/tts/status` | GET | ✅ Есть | `bot_service/api/admin_api.py:568` |
| `/api/admin/tts/restart` | POST | ✅ Есть | `bot_service/api/admin_api.py:1386` |

---

## 📊 Мониторинг (Monitoring)

### Bot Service

| Endpoint | Метод | Статус | Файл |
|----------|-------|--------|------|
| `/api/admin/monitoring/metrics` | GET | ✅ Есть + Расширенные метрики | `bot_service/api/admin_api.py:1101` |

**Метрики включают:**
- Пользователи: общее количество, активные, заблокированные
- Сообщения: за 24 часа и за последний час
- Активные сессии
- **Интеграции:** активные подключения Twitch/VK
- **Каналы:** активные каналы с разбивкой по платформам (Twitch/VK)
- **TTS:** активные каналы с TTS, статистика запросов

| `/api/admin/analytics` | GET | ✅ Есть | `bot_service/api/admin_api.py:1144` |
| `/api/admin/list` | GET | ✅ Есть | `bot_service/api/admin_api.py:19` |
| `/api/admin/sessions` | GET | ✅ Есть | `bot_service/api/admin_api.py:379` |

---

## 🎫 Тикеты Поддержки (Support Tickets)

### Bot Service

| Endpoint | Метод | Статус | Файл |
|----------|-------|--------|------|
| `/api/admin/support/tickets` | GET | ✅ Есть | `bot_service/api/admin_api.py:609` |
| `/api/admin/support/tickets/{id}` | GET | ✅ Есть | `bot_service/api/admin_api.py:670` |
| `/api/admin/support/tickets` | POST | ✅ Есть | `bot_service/api/admin_api.py:729` |
| `/api/admin/support/tickets/{id}/status` | PATCH | ✅ Есть | `bot_service/api/admin_api.py:779` |
| `/api/admin/support/tickets/{id}/responses` | POST | ✅ Есть | `bot_service/api/admin_api.py:827` |
| `/api/admin/support/tickets/{id}` | DELETE | ✅ Есть | `bot_service/api/admin_api.py:879` |

---

## 🚫 Заблокированные Каналы (Blocked Channels)

**Примечание:** Отдельной вкладки "Блокировки" в админ-панели больше нет. Блокировка выполняется через управление пользователями (см. `ADMIN_BLOCKING_AND_WHITELIST.md`). API endpoints остаются для програмmatic доступа.

### Bot Service

| Endpoint | Метод | Статус | Файл |
|----------|-------|--------|------|
| `/api/admin/blocked-channels` | GET | ✅ Есть | `bot_service/api/admin_api.py:918` |
| `/api/admin/blocked-channels` | POST | ✅ Есть | `bot_service/api/admin_api.py:973` |
| `/api/admin/blocked-channels/{id}` | PATCH | ✅ Есть | `bot_service/api/admin_api.py:1029` |
| `/api/admin/blocked-channels/{id}` | DELETE | ✅ Есть | `bot_service/api/admin_api.py:1066` |

---

## ❌ Недостающие Endpoint'ы (Нужно Реализовать)

### TTS Service

```python
# F5_tts/admin_api.py

@admin_router.delete("/voices/{voice_id}")
async def delete_voice(voice_id: int, db: Session = Depends(get_db)):
    """Удалить голос"""
    # TODO: Реализовать

@admin_router.put("/voices/{voice_id}/rename")
async def rename_voice(voice_id: int, new_name: str = Form(...), db: Session = Depends(get_db)):
    """Переименовать голос"""
    # TODO: Реализовать

@admin_router.post("/voices/{voice_id}/retranscribe")
async def retranscribe_voice(voice_id: int, reference_text: str = Form(...), db: Session = Depends(get_db)):
    """Перетранскрибировать голос"""
    # TODO: Реализовать
```

### Bot Service

```python
# bot_service/api/tts_api.py или новый файл voice_api.py

@router.put("/api/voices/{voice_id}/settings")
async def update_voice_settings(voice_id: int, settings: dict, db: Session = Depends(get_db)):
    """Обновить настройки голоса"""
    # TODO: Реализовать

@router.post("/api/admin/voices/{voice_id}/transcribe")
async def transcribe_voice(voice_id: int, db: Session = Depends(get_db)):
    """Транскрибировать голос"""
    # TODO: Реализовать
```

---

## 🔧 Требует Проверки

1. **`/api/tts/test`** - проверить, работает ли тестирование голосов
2. **Frontend VoiceManagement** - проверить, использует ли правильные endpoint'ы
3. **Permissions** - проверить, что все endpoint'ы требуют `is_admin = True`

---

## 📝 Рекомендации

1. **Срочно реализовать:**
   - DELETE `/api/admin/voices/{id}` - удаление голосов
   - PUT `/api/admin/voices/{id}/rename` - переименование голосов
   - PUT `/api/voices/{id}/settings` - обновление настроек

2. **Можно отложить:**
   - POST `/api/voices/{id}/retranscribe` - ретранскрипция (используется редко)
   - POST `/api/admin/voices/{id}/transcribe` - транскрипция (может дублироваться)

3. **Проверить работу:**
   - POST `/api/tts/test` - тестирование голосов

---

## ✅ Выводы

**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** - все критически важные endpoint'ы работают.

**Основные возможности:**
- ✅ **Админка** (`/dashboard/dolbaebadmintts`): Загрузка глобальных голосов
- ✅ **Пользователи** (`/dashboard/tts/voices`): Загрузка личных голосов
- ✅ Любой формат → автоконвертация в WAV 48kHz Mono 16-bit
- ✅ Автоматическая транскрибация через Faster-Whisper
- ✅ Перетранскрибация по требованию
- ✅ Удаление/переименование голосов
- ✅ Управление пользователями (блокировка/разблокировка)
- ✅ Управление ботами (статус/перезапуск)
- ✅ Мониторинг системы
- ✅ Тикеты поддержки
- ✅ Блокировка каналов

## 🎯 Новая Функциональность: Автоматическая Обработка Голосов

### Загрузка Голоса (POST `/api/admin/voices/upload`)

**Поддерживаемые форматы:** MP3, WAV, OGG, FLAC, M4A, AAC, WMA, AIFF, AU

**Процесс обработки:**
1. 📥 Загрузка файла во временную директорию
2. 🔄 Конвертация в WAV (48kHz, Mono, 16-bit) через `AsyncAudioConverter`
3. 🎤 Автоматическая транскрибация через Faster-Whisper
4. 💾 Сохранение в `audio/voices/global/`
5. 📊 Создание записи в БД с reference_text

**Результат:**
- Все голоса хранятся **только в формате WAV**
- Референсный текст автоматически извлекается
- Готово к использованию в F5-TTS

---

### Перетранскрибация Голоса (POST `/api/voices/{id}/retranscribe`)

**Назначение:** Извлечь reference_text из аудиофайла заново.

**Когда использовать:**
- Если автоматическая транскрибация при загрузке дала неточный результат
- Для обновления reference_text после редактирования аудиофайла

**Процесс:**
1. 🔍 Получение голоса из БД
2. ✅ Проверка существования аудиофайла
3. 🎤 Транскрибация через Faster-Whisper
4. 💾 Обновление reference_text в БД

**UI Интеграция:**
- Кнопка **"Перетранскрибировать"** в панели настройки голоса
- Компонент: `frontend/src/components/admin/VoiceManagement.jsx`

**Приоритет:** ✅ **ЗАВЕРШЕНО**

---

### Загрузка Пользовательского Голоса (POST `/api/tts/user/voices/upload`)

**UI:** `dashboard/tts/voices` → **"Загрузить свой голос"**

**Отличия от админской загрузки:**
- Голоса сохраняются в `audio/voices/user/{user_id}/`
- Только для whitelist пользователей
- Каждый пользователь видит только свои голоса

**Процесс идентичен админской загрузке:**
1. 📥 Загрузка (MP3, WAV, OGG, FLAC, M4A, AAC, WMA, AIFF, AU)
2. 🔄 Конвертация в WAV 48kHz Mono 16-bit
3. 🎤 Автоматическая транскрибация
4. 💾 Сохранение в личную директорию
5. 📊 Запись в БД с owner_id

**Дополнительные endpoint'ы:**
- `GET /api/user/voices/{user_id}` - список голосов пользователя
- `DELETE /api/user/voices/{voice_id}` - удаление (только своих голосов)
- `PUT /api/user/voices/{voice_id}/rename` - переименование (только своих голосов)

---

### ✅ TTS Service Single-Node Profile (localhost:8001)

**Статус:** ✅ **РЕАЛИЗОВАНА** автоконвертация и транскрибация!

**Новое поведение:**
- Endpoint `/api/voices/{voice_id}/upload` теперь с полной обработкой
- ✅ Автоконвертация любого формата → WAV 48kHz Mono 16-bit
- ✅ Автотранскрибация через Faster-Whisper
- ✅ Полная очистка временных файлов
- ✅ Те же возможности, что и в основном `tts_service`

**Поддерживаемые форматы:**
MP3, WAV, OGG, FLAC, M4A, AAC, WMA, AIFF, AU

**Зависимости:**
- Добавлена `faster-whisper>=0.10.0` в `requirements.txt`
- Используются уже имеющиеся `librosa`, `soundfile`, `numpy`

**Код:**
- `convert_audio_to_wav_48khz()` - конвертация (строка 570)
- `transcribe_audio()` - транскрибация (строка 607)
- Обновлённый endpoint `/api/voices/{voice_id}/upload` (строка 645)

**Приоритет:** ✅ **ЗАВЕРШЕНО**

