# 🎨 Система Персональных Настроек Голосов

**Дата:** 31 октября 2025  
**Версия:** 1.0.0  
**Статус:** ✅ Реализовано

---

## 📋 Обзор

Система позволяет каждому пользователю настраивать голоса под себя:
- **Админ** изменяет дефолтные настройки → хранятся в TTS Service
- **Пользователи** переопределяют для себя → хранятся в Bot Service

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────┐
│           Bot Service (8000)                │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  user_voice_settings (Новая!)       │   │
│  │  - user_id                          │   │
│  │  - voice_id                         │   │
│  │  - cfg_strength (персональный)      │   │
│  │  - speed_preset (персональный)      │   │
│  │  - volume (персональный)            │   │
│  └─────────────────────────────────────┘   │
│                    ↓                        │
│         Передаёт настройки при синтезе     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   TTS Service (advanced/single-node) (8001) │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  voices (Дефолтные настройки)       │   │
│  │  - id                               │   │
│  │  - name                             │   │
│  │  - cfg_strength (дефолт)            │   │
│  │  - speed_preset (дефолт)            │   │
│  │  - reference_text                   │   │
│  │  - voice_type (global/user)         │   │
│  └─────────────────────────────────────┘   │
│                    ↓                        │
│            Синтезирует речь                │
└─────────────────────────────────────────────┘
```

---

## 🗄️ База Данных

### Новая таблица `user_voice_settings`

```sql
CREATE TABLE user_voice_settings (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,          -- FK на users.id
    voice_id INTEGER NOT NULL,         -- ID голоса из TTS Service
    voice_name VARCHAR,                -- Название (для кэша)
    cfg_strength FLOAT,                -- Персональная стабильность (NULL = дефолт)
    speed_preset VARCHAR,              -- Персональная скорость (NULL = дефолт)
    volume FLOAT,                      -- Персональная громкость (NULL = общая)
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE(user_id, voice_id),        -- Уникальные настройки для каждого пользователя
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

---

## 🔄 Логика Работы

### ✅ Итоговая логика (обновлено 8 ноября 2025)

**Принцип работы:**
1. Если пользователь настроил параметры → используются его настройки
2. Если пользователь не настроил → используются дефолтные из таблицы `Voice` (настроенные админом)
3. Volume обрабатывается отдельно: персональный volume из `UserVoiceSettings` или базовый из `AudioSettings`

### Сценарий 1: Глобальный голос

**Админ устанавливает дефолт:**
```
Voice ID: 4
Name: "speaker_4"
cfg_strength: 2.5
speed_preset: "normal"
voice_type: "global"
```

**Пользователь А настраивает для себя:**
```sql
INSERT INTO user_voice_settings (user_id, voice_id, cfg_strength, speed_preset, volume)
VALUES (123, 4, 3.0, NULL, 75.0);
```

**Результат при синтезе для Пользователя А:**
- `cfg_strength: 3.0` ← из user_voice_settings (персональный)
- `speed_preset: "normal"` ← из voice (дефолт, потому что NULL в user_voice_settings)
- `volume: 75.0` ← из user_voice_settings (персональный)

**Результат для Пользователя Б (не настраивал):**
- `cfg_strength: 2.5` ← из voice (дефолт от админа)
- `speed_preset: "normal"` ← из voice (дефолт от админа)
- `volume: 50.0` ← из AudioSettings (базовый, или дефолтный 50%)

---

### Сценарий 2: Пользовательский голос

**Пользователь создал свой голос:**
```
Voice ID: 5
Name: "my_voice"
owner_id: 123
cfg_strength: 2.0
speed_preset: "fast"
voice_type: "user"
```

**Настройки:**
- Хранятся прямо в `voices` таблице TTS Service
- Только этот пользователь видит и использует голос
- Не нужна запись в `user_voice_settings` (уже персональный)

---

## 📡 API Endpoints

### `PUT /api/admin/voices/{voice_id}/settings`

**Описание:** Обновить персональные настройки голоса для текущего пользователя (админ)

**Расположение:** `bot_service/api/admin_api.py`

**Права:** Только админ

**Request Body:**
```json
{
  "cfg_strength": 3.0,
  "speed_preset": "fast",
  "volume": 75.0
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Персональные настройки голоса обновлены",
  "settings": {
    "voice_id": 4,
    "cfg_strength": 3.0,
    "speed_preset": "fast",
    "volume": 75.0
  }
}
```

**Логика:**
1. Проверяет права админа
2. Ищет запись в `user_voice_settings` для `(user_id, voice_id)`
3. Если есть → обновляет
4. Если нет → создаёт новую
5. Возвращает сохранённые настройки

---

## 🚀 Установка и Миграция

### Шаг 1: Запустить миграцию (PowerShell)

```powershell
cd bot_service
python -m alembic upgrade head
```

Или через отдельные команды:
```powershell
cd .\bot_service
python -m alembic upgrade head
```

### Шаг 2: Перезапустить Bot Service

```powershell
# Остановить (Ctrl+C в окне где запущен bot_service)
# Запустить заново
cd bot_service
python main.py
```

---

## 💻 Frontend

### Изменения в `microservices.js`

```javascript
// ДО (неправильно - шло в несуществующий endpoint):
export const updateVoiceSettings = async (voiceId, settings) => {
    return await botService.put(`/api/voices/${voiceId}/settings`, settings);
};

// ПОСЛЕ (правильно - идёт в bot_service):
export const updateVoiceSettings = async (voiceId, settings) => {
    return await botService.put(`/api/admin/voices/${voiceId}/settings`, settings);
};
```

---

## 🎯 Примеры Использования

### Пример 1: Админ настраивает глобальный голос

```javascript
// Админ открывает настройки голоса "speaker_4" (ID: 4)
const settings = {
  cfg_strength: 3.0,
  speed_preset: "fast",
  volume: 80.0
};

await updateVoiceSettings(4, settings);

// Результат: 
// - Создаётся запись в user_voice_settings
// - Настройки применяются только для этого админа
// - Другие пользователи продолжают использовать дефолты
```

### Пример 2: Обычный пользователь настраивает

```javascript
// Пользователь (не админ) открывает настройки глобального голоса
// Frontend должен использовать другой endpoint:
await updateUserVoiceSettings(voiceId, userId, settings);

// Этот endpoint должен быть создан отдельно для обычных пользователей
```

---

## ✅ Что Работает

- ✅ **Таблица `user_voice_settings`** создана в `bot_service/core/database.py`
- ✅ **Миграция** создана: `bot_service/alembic/versions/20251031_add_user_voice_settings.py`
- ✅ **API Endpoint** создан: `PUT /api/admin/voices/{voice_id}/settings`
- ✅ **Frontend** исправлен: `updateVoiceSettings` теперь идёт в `bot_service`
- ✅ **Админка** может сохранять настройки голосов
- ✅ **Получение настроек при синтезе** реализовано в `websocket_helper.py`
- ✅ **Fallback на дефолтные настройки** реализован в `tts_engine.py`
- ✅ **Обработка volume** реализована отдельно (персональный или базовый)
- ✅ **Логирование** добавлено для отладки используемых настроек

---

## 🔜 Что Нужно Доработать (Опционально)

### 1. Endpoint для обычных пользователей

Сейчас только админ может сохранять персональные настройки. Для обычных пользователей нужно:

```python
@router.put("/user/voices/{voice_id}/settings")
async def update_user_voice_settings(
    voice_id: int,
    settings: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить персональные настройки голоса для текущего пользователя"""
    # Аналогично админ endpoint, но без проверки is_admin
    pass
```

### 2. Получение настроек при синтезе ✅ РЕАЛИЗОВАНО

В `bot_service/utils/websocket_helper.py` при отправке запроса на синтез:

```python
# Загружаем персональные настройки голоса
user_voice_config = db.query(UserVoiceSettings).filter(
    UserVoiceSettings.user_id == user_id,
    UserVoiceSettings.voice_name == tts_user_settings.voice
).first()

if user_voice_config:
    # Передаем персональные настройки только если они есть
    voice_settings_dict = {}
    
    if user_voice_config.cfg_strength is not None:
        voice_settings_dict["cfg_strength"] = user_voice_config.cfg_strength
    
    if user_voice_config.speed_preset is not None:
        voice_settings_dict["speed_preset"] = user_voice_config.speed_preset
    
    # Volume обрабатывается отдельно через final_volume_level
    if voice_settings_dict:
        tts_settings_dict["voice_settings"] = voice_settings_dict
```

В `F5_tts/tts_engine.py` при синтезе:

```python
# Извлекаем voice_settings из tts_settings
voice_settings = voice_settings_raw if isinstance(voice_settings_raw, dict) else {}

# Безопасное извлечение параметров с fallback на значения из voice_record
cfg_strength = voice_settings.get("cfg_strength")
if cfg_strength is None:
    cfg_strength = voice_record.cfg_strength or 2.5  # Fallback на дефолт

speed_preset = voice_settings.get("speed_preset")
if speed_preset is None:
    speed_preset = voice_record.speed_preset or 'normal'  # Fallback на дефолт
```

### 3. UI для обычных пользователей

В `/dashboard/tts/voices` добавить возможность сохранять настройки для глобальных голосов.

---

## 📊 Итоговая Структура

```
Bot Service:
├── user_voice_settings ← Персональные настройки пользователей
├── tts_user_settings   ← Общие настройки TTS (движок, платформы)
└── audio_settings      ← Настройки громкости

TTS Service:
└── voices              ← Голоса и их дефолтные настройки
```

---

## 🎉 Заключение

Система персональных настроек голосов позволяет:
- ✅ Админу устанавливать дефолтные настройки для всех
- ✅ Пользователям переопределять настройки под себя
- ✅ Не влиять на настройки других пользователей
- ✅ Хранить все настройки в Bot Service
- ✅ Передавать их в TTS Service при синтезе

**Статус:** Базовая реализация готова, требуется доработка для обычных пользователей.

---

**Дата создания:** 31 октября 2025  
**Последнее обновление:** 8 ноября 2025  
**Автор:** AI Assistant  
**Версия:** 1.1.0

---

## 🆕 Обновления (8 ноября 2025)

### Исправления
- ✅ Исправлена обработка `voice_settings`: гарантируется, что это всегда словарь (не `None`)
- ✅ Добавлен корректный fallback на дефолтные значения из таблицы `Voice`, если персональные настройки отсутствуют
- ✅ Volume обрабатывается отдельно: персональный volume из `UserVoiceSettings` или базовый из `AudioSettings`
- ✅ Добавлено детальное логирование используемых настроек (персональные или дефолтные)

### Логика работы
1. **Если персональных настроек нет:**
   - `cfg_strength` → из `Voice.cfg_strength` (дефолт от админа)
   - `speed_preset` → из `Voice.speed_preset` (дефолт от админа)
   - `volume` → из `AudioSettings` (базовый, или дефолтный 50%)

2. **Если персональные настройки есть:**
   - `cfg_strength` → из `UserVoiceSettings.cfg_strength` (если не NULL) или из `Voice.cfg_strength`
   - `speed_preset` → из `UserVoiceSettings.speed_preset` (если не NULL) или из `Voice.speed_preset`
   - `volume` → из `UserVoiceSettings.volume` (если не NULL) или из `AudioSettings`



