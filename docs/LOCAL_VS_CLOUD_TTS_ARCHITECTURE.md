# 🏗️ Архитектура: Локальный vs Облачный TTS

**Дата:** 27 октября 2025  
**Версия:** 1.0

---

## 📋 Обзор

Система поддерживает **два режима** TTS:
1. **Облачный TTS** (`tts_service`) - для whitelist пользователей
2. **Локальный TTS** (`tts_service_simple`) - для всех пользователей

---

## 🎯 Логика выбора

```python
if user.use_local_tts:
    # Используем локальный TTS
    voice_source = "tts_service_simple"
    endpoint = user.local_tts_endpoint
    voices = load_from_local(endpoint)
else:
    # Используем облачный TTS
    if user.in_whitelist:
        voice_source = "tts_service"
        endpoint = "http://localhost:8001"
        voices = load_from_cloud(endpoint)
    else:
        # Fallback на gTTS
        voice_source = "gtts"
        voices = ["ru", "en"]
```

---

## 🔧 Облачный TTS (`tts_service`)

### Местоположение
```
tts_service/
├── main.py
├── async_tts_engine.py
├── user_configs/           # Голоса пользователей
│   ├── user_1/
│   │   ├── voice_1.json
│   │   └── samples/
│   └── user_2/
└── models/
```

### Особенности
- ✅ Запускается автоматически с ботом
- ✅ Порт: `8001`
- ✅ Доступен только для **whitelist** пользователей
- ✅ Централизованное управление голосами
- ✅ Администратор может управлять голосами пользователей

### Управление голосами
**UI:** `/dashboard/tts/voices` (VoiceManagementPage.jsx)

**Функционал:**
- Создание голосов
- Загрузка референсных аудио
- Просмотр/удаление сэмплов
- Доступно только в whitelist

---

## 🖥️ Локальный TTS (`tts_service_simple`)

### Местоположение
```
tts_service_simple/
├── main.py
├── user_voices/            # Пользовательские голоса
│   ├── custom_abc123/
│   │   ├── metadata.json
│   │   ├── samples.json
│   │   ├── sample_1.wav
│   │   └── sample_2.wav
│   └── custom_def456/
├── reference_audio/        # Общие сэмплы
└── models/
```

### Особенности
- ✅ Запускается **пользователем вручную**
- ✅ Порт: Автоопределение (8001-8010)
- ✅ Доступен **всем пользователям**
- ✅ Локальное управление голосами
- ✅ Работает на GPU пользователя

### Управление голосами
**UI:** `/dashboard/tts/local` → вкладка "Управление голосами"

**Функционал:**
- Создание голосов
- Загрузка референсных аудио (WAV, MP3, FLAC)
- Просмотр/удаление сэмплов
- Доступно всем

---

## 🔄 Взаимодействие с ботом

### Backend (`bot_service`)

#### Конфигурация пользователя
```python
# models/user.py
class User:
    use_local_tts: bool = False
    local_tts_endpoint: str = "http://localhost:8001"
    local_tts_api_key: str = ""
```

#### Выбор источника голосов
```python
# services/tts_service.py
def get_user_voices(user_id):
    user = get_user(user_id)
    
    if user.use_local_tts:
        # Локальный TTS
        return fetch_voices_from_endpoint(
            user.local_tts_endpoint,
            user.local_tts_api_key
        )
    else:
        # Облачный TTS
        if user.in_whitelist:
            return fetch_voices_from_cloud()
        else:
            return get_gtts_voices()
```

---

## 📊 Сравнительная таблица

| Критерий | Облачный TTS | Локальный TTS |
|----------|--------------|---------------|
| **Запуск** | Автоматически | Вручную пользователем |
| **Доступ** | Только whitelist | Все пользователи |
| **GPU** | Сервер | Локальная машина |
| **Порт** | 8001 (фиксированный) | 8001-8010 (автовыбор) |
| **Голоса** | Централизованные | Локальные |
| **UI управления** | `/dashboard/tts/voices` | `/dashboard/tts/local` |
| **API endpoint** | `http://localhost:8001` | Настраиваемый |
| **Директория голосов** | `tts_service/user_configs/` | `tts_service_simple/user_voices/` |
| **Администрирование** | Да | Нет (только свои) |

---

## 🎨 UI/UX Разделение

### Облачный TTS
**Страница:** `/dashboard/tts/voices`

**Навигация:**
```
Dashboard → TTS ИИ озвучка → Управление голосами (облачный)
```

**Видимость:**
- ✅ Показывается если `isWhitelisted = true`
- ✅ Показывается если `use_local = false`

### Локальный TTS
**Страница:** `/dashboard/tts/local` (вкладка "Управление голосами")

**Навигация:**
```
Dashboard → TTS ИИ озвучка → Локальный TTS
```

**Структура:**
```
Tabs:
├── Подключение (connection)
│   ├── Инструкции по установке
│   ├── Настройка endpoint
│   ├── Тест соединения
│   └── Переключатель use_local
└── Управление голосами (voices) [disabled if not connected]
    ├── Список голосов (base + custom)
    ├── Создание голоса
    ├── Загрузка сэмплов
    └── Рекомендации
```

---

## 🔐 Безопасность

### Облачный TTS
- ✅ JWT токен для авторизации
- ✅ Проверка whitelist
- ✅ Доступ только к своим голосам
- ✅ Администратор видит всё

### Локальный TTS
- ✅ API ключ (генерируется автоматически)
- ✅ Только localhost доступ
- ✅ CORS настроен на фронтенд
- ✅ Изолированное хранилище

---

## 📡 API Endpoints

### Облачный TTS (`tts_service`)
```
GET  /api/voices                    # Список голосов
POST /api/voices                    # Создать голос
POST /api/voices/{id}/upload        # Загрузить сэмпл
GET  /api/voices/{id}/samples       # Список сэмплов
DELETE /api/voices/{id}/samples/{n} # Удалить сэмпл
```

### Локальный TTS (`tts_service_simple`)
```
GET  /api/voices/list               # Список голосов
POST /api/voices/create             # Создать голос
POST /api/voices/{id}/upload        # Загрузить сэмпл
GET  /api/voices/{id}/samples       # Список сэмплов
DELETE /api/voices/{id}/samples/{f} # Удалить сэмпл
DELETE /api/voices/{id}             # Удалить голос
```

---

## 🚀 Workflow пользователя

### Сценарий 1: Облачный TTS (whitelist)
1. Пользователь в whitelist
2. Переходит на `/dashboard/tts/voices`
3. Создаёт голос
4. Загружает 5+ сэмплов
5. Использует голос в чате через `!voice myvoice`

### Сценарий 2: Локальный TTS
1. Скачивает `tts_service_simple`
2. Запускает `start.bat` / `start.sh`
3. Переходит на `/dashboard/tts/local`
4. Вкладка "Подключение":
   - Вводит endpoint (например `http://localhost:8002`)
   - Вводит API ключ
   - Тестирует соединение
   - Включает "Использовать локальный TTS"
5. Вкладка "Управление голосами":
   - Создаёт голос
   - Загружает 5+ сэмплов
6. Использует голос в чате через `!voice custom_abc123`

---

## ⚙️ Переключение режимов

### В UI (`/dashboard/tts/local`)
```jsx
<Button onClick={toggleService}>
  {config.use_local ? 'Включено' : 'Выключено'}
</Button>
```

### В Backend
```python
# API: POST /api/local-tts/toggle
user.use_local_tts = !user.use_local_tts
save_user(user)
```

### Эффект
- ✅ Бот сразу переключается на новый источник
- ✅ Голоса берутся из нового endpoint
- ✅ TTS запросы идут на новый сервис

---

## 📖 Связанные документы

- `tts_service_simple/VOICE_MANAGEMENT.md` - Управление голосами локального TTS
- `tts_service_simple/README.md` - Установка и запуск
- `frontend/src/pages/tts/LocalTTSSettingsPage.jsx` - UI локального TTS
- `frontend/src/pages/tts/VoiceManagementPage.jsx` - UI облачного TTS
- `bot_service/services/tts_service.py` - Логика выбора TTS

---

## 🎯 Ключевые принципы

1. **Разделение ответственности**: Облачный для администрирования, локальный для пользователей
2. **Изоляция**: Голоса облачного и локального не пересекаются
3. **Гибкость**: Пользователь выбирает что использовать
4. **Простота**: Один переключатель для смены режима
5. **Безопасность**: Каждый видит только свои голоса

---

**Статус:** ✅ Implemented  
**Тестирование:** ⏳ Pending  
**Документация:** ✅ Complete

