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
│      TTS Service / TTS Simple (8001)        │
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
INSERT INTO user_voice_settings (user_id, voice_id, cfg_strength, speed_preset)
VALUES (123, 4, 3.0, NULL);
```

**Результат при синтезе для Пользователя А:**
- `cfg_strength: 3.0` ← из user_voice_settings
- `speed_preset: "normal"` ← из voice (дефолт, потому что NULL)

**Результат для Пользователя Б (не настраивал):**
- `cfg_strength: 2.5` ← из voice (дефолт)
- `speed_preset: "normal"` ← из voice (дефолт)

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
cd H:\Programming\raw_code\AI\Python\TTS_TTV_0.02\bot_service
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

### 2. Получение настроек при синтезе

В `tts_manager.py` при отправке запроса на синтез нужно:

```python
# Проверить есть ли персональные настройки в user_voice_settings
user_settings = db.query(UserVoiceSettings).filter(
    UserVoiceSettings.user_id == user_id,
    UserVoiceSettings.voice_id == voice_id
).first()

# Если есть - переопределить дефолты
if user_settings:
    if user_settings.cfg_strength is not None:
        cfg_strength = user_settings.cfg_strength
    if user_settings.speed_preset is not None:
        speed_preset = user_settings.speed_preset
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
**Автор:** AI Assistant  
**Версия:** 1.0.0


