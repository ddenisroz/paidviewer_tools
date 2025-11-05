# 🚨 ПРИОРИТЕТ: КРИТИЧНЫЕ ИСПРАВЛЕНИЯ

**ДЛЯ PRODUCTION-READY СОСТОЯНИЯ**

---

## ИСПРАВЛЕНИЯ УРОВНЯ 1 (СРОЧНО)

### 1. Добавить NULL checks в tts_api.py

**Файл:** `bot_service/api/tts_api.py`

**Проблема:**
```python
# ТЕКУЩИЙ КОД - ОПАСНЫЙ
tts_settings = db.query(TtsSettings).filter(...).first()
# ❌ Если None - будет AttributeError при setattr

tts_settings.use_local_tts = True  # AttributeError если None
db.commit()
```

**Решение:**
```python
# ИСПРАВЛЕННЫЙ КОД
tts_settings = db.query(TtsSettings).filter(...).first()
if not tts_settings:
    # Создаем если не существует
    tts_settings = TtsSettings(user_id=user_id, ...)
    db.add(tts_settings)
    db.flush()

tts_settings.use_local_tts = True
db.commit()
db.refresh(tts_settings)
```

**Места в коде для исправления:**
- Lines 150-170: `POST /api/tts/settings`
- Lines 200-230: `POST /api/tts/enable`
- Lines 240-260: `POST /api/tts/disable`
- Lines 290-310: `POST /api/tts/engine`

---

### 2. Добавить race condition защиту

**Проблема:**
```
User clicks button fast twice:
1️⃣ First POST /api/tts/enable (pending)
2️⃣ Second POST /api/tts/enable (pending)
3️⃣ Both write to DB - undefined behavior
```

**Решение: Добавить version field**

```python
# В database.py:
class TtsSettings(Base):
    version = Column(Integer, default=1)  # Добавить эту строку

# В tts_api.py:
@router.post("/api/tts/settings")
async def update_tts_settings(
    settings_data: TtsSettingsRequest,
    client_version: int,  # Клиент отправляет версию
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tts_settings = db.query(TtsSettings).filter(...).first()
    
    # CHECK VERSION
    if tts_settings.version != client_version:
        raise HTTPException(status_code=409, detail="Data was updated")
    
    # UPDATE
    for key, value in settings_data.dict().items():
        setattr(tts_settings, key, value)
    tts_settings.version += 1  # Инкрементируем версию
    
    db.commit()
    db.refresh(tts_settings)
    
    return response
```

---

### 3. Добавить error handling в frontend

**Файл:** `frontend/src/pages/tts/TtsMainPage.jsx`

**Проблема:**
```javascript
// Нет проверки если сохранение не удалось
const handleSave = async () => {
    try {
        await botService.post('/api/tts/settings', settings);
        // ❌ Если ошибка - состояние уже изменено, но не сохранено
    } catch (error) {
        // ❌ Просто откатываем, но пользователь не знает почему
        setSettings(oldSettings);
    }
};
```

**Решение:**
```javascript
const handleSave = async () => {
    const previousSettings = settings;  // Сохраняем текущее состояние
    
    setSaving(true);
    try {
        // Отправляем
        const response = await botService.post('/api/tts/settings', {
            ...settings,
            version: settings.version  // Отправляем версию
        });
        
        // Проверяем ответ
        if (!response.data) {
            throw new Error('No response data');
        }
        
        // Обновляем ТОЛЬКО если успех
        setSettings(response.data);
        toast.success('Сохранено успешно');
        
    } catch (error) {
        logger.error('Save error:', error);
        
        // Откатываем
        setSettings(previousSettings);
        
        // ПОКАЗЫВАЕМ ОШИБКУ ПОЛЬЗОВАТЕЛЮ
        if (error.response?.status === 409) {
            toast.error('Данные были обновлены. Перезагрузка...');
            // Перезагружаем с сервера
            await loadSettings();
        } else {
            toast.error('Ошибка сохранения: ' + error.message);
        }
    } finally {
        setSaving(false);
    }
};
```

---

## ИСПРАВЛЕНИЯ УРОВНЯ 2 (ВАЖНО)

### 4. Добавить пагинацию в admin_api.py

**Файл:** `bot_service/api/admin_api.py`

**Проблема:**
```python
# Загружает ВСЕ пользователей сразу - может быть 10000+
users = db.query(User).all()  # ❌ МЕДЛЕННО
```

**Решение:**
```python
from sqlalchemy import desc

@router.get("/api/admin/users")
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    
    # ФИЛЬТР
    if search:
        query = query.filter(User.username.ilike(f"%{search}%"))
    
    # ПАГИНАЦИЯ
    total = query.count()
    users = query.order_by(desc(User.id)).offset(skip).limit(limit).all()
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit
    }
```

---

### 5. Добавить транзакции для связанных данных

**Файл:** `bot_service/api/drops_api.py`

**Проблема:**
```python
# Если создается reward но лицензия не добавляется - БД грязная
reward = DropsReward(...)
db.add(reward)
db.flush()

license = DropLicense(reward_id=reward.id, ...)
db.add(license)
db.commit()  # ❌ Если error здесь - reward уже в БД
```

**Решение:**
```python
from contextlib import contextmanager

try:
    reward = DropsReward(...)
    db.add(reward)
    db.flush()  # Получаем reward.id

    license = DropLicense(reward_id=reward.id, ...)
    db.add(license)
    
    db.commit()  # ВСЕ вместе
    db.refresh(reward)
    
except Exception as e:
    db.rollback()  # Откатываем ВСЕ изменения
    logger.error(f"Failed to create reward: {e}")
    raise HTTPException(status_code=400, detail="Failed to create")
```

---

## ИСПРАВЛЕНИЯ УРОВНЯ 3 (МОЖНО ПОЗЖЕ)

### 6. Добавить debounce на фронтенде
```javascript
import { debounce } from 'lodash';

const debouncedSave = debounce(handleSave, 1000);  // 1 секунда

const handleChange = (field, value) => {
    setSettings(prev => ({...prev, [field]: value}));
    debouncedSave();  // Сохраняет с задержкой
};
```

### 7. Реализовать soft deletes
```python
class User(Base):
    deleted_at = Column(DateTime, nullable=True)  # Добавить поле

# При удалении:
user.deleted_at = datetime.utcnow()
db.commit()

# При запросе:
users = db.query(User).filter(User.deleted_at == None).all()
```

### 8. Добавить audit logging
```python
class AuditLog(Base):
    user_id = Column(Integer)
    action = Column(String)  # "update", "delete", "create"
    entity_type = Column(String)  # "User", "TtsSettings", etc
    entity_id = Column(Integer)
    old_value = Column(JSON)
    new_value = Column(JSON)
    timestamp = Column(DateTime, default=utcnow_naive)

# При каждом обновлении:
audit_log = AuditLog(
    user_id=user_id,
    action="update",
    entity_type="TtsSettings",
    entity_id=settings.id,
    old_value=old_values,
    new_value=new_values
)
db.add(audit_log)
```

---

## 📋 ЧЕКЛИСТ ДЛЯ ИМПЛЕМЕНТАЦИИ

### УРОВЕНЬ 1 (ОБЯЗАТЕЛЬНО):
- [ ] Добавить NULL checks в tts_api.py (10 мин)
- [ ] Добавить NULL checks в admin_api.py (10 мин)
- [ ] Добавить NULL checks в drops_api.py (10 мин)
- [ ] Добавить версионирование в models (15 мин)
- [ ] Обновить endpoints для проверки версии (30 мин)
- [ ] Добавить error handling в frontend (20 мин)

**ИТОГО УРОВЕНЬ 1: 1.5 часа**

### УРОВЕНЬ 2 (РЕКОМЕНДУЕТСЯ):
- [ ] Добавить пагинацию в admin endpoints (30 мин)
- [ ] Реализовать транзакции для drops (30 мин)
- [ ] Добавить debounce на фронтенде (15 мин)

**ИТОГО УРОВЕНЬ 2: 1.25 часа**

### УРОВЕНЬ 3 (NICE TO HAVE):
- [ ] Soft deletes (45 мин)
- [ ] Audit logging (1 час)

**ИТОГО УРОВЕНЬ 3: 1.75 часа**

---

## 🎯 ВЫВОДЫ

**Текущее состояние:** 🟡 WORKING BUT UNSAFE
- Функционирует для нормальных сценариев
- Сломается при race conditions, быстрых кликах, потере соединения

**После УРОВНЯ 1:** 🟢 SAFE
- Защита от основных ошибок
- Готово для production под нагрузкой

**После УРОВНЯ 2:** 🟢 OPTIMIZED
- Хороший performance даже при 100k+ записей
- Удобно масштабировать

**После УРОВНЯ 3:** 🟢 ENTERPRISE
- Полная аудитируемость
- Возможность восстановления данных

