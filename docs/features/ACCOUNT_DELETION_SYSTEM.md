# 🗑️ Система удаления аккаунтов

**Версия:** 1.0  
**Дата создания:** 27 октября 2025  
**Статус:** ✅ Production Ready

---

## 📋 Обзор

Реализована **3-уровневая система удаления аккаунтов** с полным соответствием GDPR (право на забвение).

---

## 🎯 Архитектура

### **Level 1: SOFT DELETE (немедленно)**

Пользователь инициирует удаление через UI → данные очищаются, но User record сохраняется в анонимизированном виде.

```
User → Settings → Delete Account
              ↓
    POST /api/user/delete-account
              ↓
┌─────────────────────────────────────┐
│ 1. Отключение ботов от каналов     │
│    - Twitch bot disconnect          │
│    - VK bot disconnect              │
│    - TTS disable                    │
├─────────────────────────────────────┤
│ 2. Физическое удаление данных      │
│    ✅ UserToken (все токены)        │
│    ✅ UserSession (все сессии)      │
│    ✅ TTSUserSettings               │
│    ✅ UserSettings                  │
│    ✅ ChatMessage (вся история)     │
│    ✅ ChatBoxSettings               │
│    ✅ WhitelistedChannel            │
│    ✅ AdminUser (если админ)        │
├─────────────────────────────────────┤
│ 3. Soft delete User record          │
│    is_blocked = True                │
│    blocked_reason = "account_deleted"│
│    blocked_at = datetime.utcnow()   │
├─────────────────────────────────────┤
│ 4. Анонимизация (GDPR compliance)  │
│    twitch_username = "deleted_user_{id}"│
│    vk_username = "deleted_user_{id}"│
│    vk_channel_name = None           │
├─────────────────────────────────────┤
│ 5. Разлогинивание                   │
│    session_id cookie deleted        │
└─────────────────────────────────────┘
              ↓
    ✅ Account soft-deleted
```

**Файл:** `bot_service/api/additional_api.py`

**Endpoint:**
```python
POST /api/user/delete-account
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Account successfully deleted",
  "deleted_data": {
    "tokens": 3,
    "sessions": 1,
    "tts_settings": 1,
    "user_settings": 1,
    "chat_messages": 142,
    "chatbox_settings": 1,
    "whitelist": 0,
    "admin": 0
  }
}
```

---

### **Level 2: AUTO CLEANUP (через 30 дней)**

Background task автоматически удаляет аккаунты после 30-дневного retention period.

```
Background Task (каждые 24 часа)
              ↓
┌─────────────────────────────────────┐
│ Поиск удалённых аккаунтов          │
│                                     │
│ WHERE:                              │
│   is_blocked = True                 │
│   blocked_reason = "account_deleted"│
│   blocked_at < (NOW - 30 days)      │
└─────────────────────────────────────┘
              ↓
        Найдено 3 аккаунта
              ↓
┌─────────────────────────────────────┐
│ Для каждого аккаунта:              │
│   1. Логирование (user_id, username)│
│   2. db.delete(user)                │
│   3. db.commit()                    │
│   4. Логирование успеха             │
└─────────────────────────────────────┘
              ↓
    ✅ Аккаунты удалены навсегда
```

**Файл:** `bot_service/core/background_tasks.py`

**Метод:** `cleanup_deleted_accounts()`

**Интервал:** Каждые 24 часа (86400 секунд)

**Retention period:** 30 дней

**Логи:**
```
🗑️ [CLEANUP] Found 3 accounts to permanently delete (>30 days)
✅ [CLEANUP] Permanently deleted user 123 (deleted_user_123) - deleted on 2025-09-27
✅ [CLEANUP] Permanently deleted user 456 (deleted_user_456) - deleted on 2025-09-25
✅ [CLEANUP] Permanently deleted user 789 (deleted_user_789) - deleted on 2025-09-20
```

---

### **Level 3: ADMIN DELETE (ручное)**

Администратор может немедленно удалить пользователя (bypass retention period).

```
Admin Panel → Delete User
              ↓
POST /api/admin/permanently-delete-user/{user_id}
Authorization: Bearer <admin_token>
              ↓
┌─────────────────────────────────────┐
│ Проверка прав администратора       │
│ current_user.is_admin == True       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Получение User из БД               │
│ Сохранение данных для логов        │
│   - user_id                         │
│   - username                        │
│   - is_blocked                      │
│   - blocked_reason                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ ФИЗИЧЕСКОЕ УДАЛЕНИЕ                │
│ db.delete(user)                     │
│ db.commit()                         │
└─────────────────────────────────────┘
              ↓
    ✅ User удалён навсегда (НЕОБРАТИМО!)
```

**Файл:** `bot_service/api/additional_api.py`

**Endpoint:**
```python
POST /api/admin/permanently-delete-user/{user_id}
Authorization: Bearer <admin_token>
```

**Request:**
```http
POST /api/admin/permanently-delete-user/123
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "message": "User 123 permanently deleted",
  "user_data": {
    "id": 123,
    "username": "deleted_user_123",
    "was_blocked": true,
    "blocked_reason": "account_deleted"
  }
}
```

**Используется для:**
- 🔴 Срочные GDPR запросы ("право на забвение" немедленно)
- 🧪 Удаление тестовых аккаунтов
- ⚙️ Ручное вмешательство администратора
- 🚨 Компрометация данных

---

## 📊 Timeline удаления

```
Day 0:    User нажимает "Delete Account"
          ├─ Soft delete (is_blocked=True)
          ├─ Данные анонимизированы
          └─ User record существует в БД

          ✅ Можно восстановить (если реализовать)
          ⚠️ User помечен как удалённый
          🔒 Username = "deleted_user_{id}"

Day 1-29: Retention period (30 дней)
          ├─ User record в БД (blocked)
          ├─ Можно восстановить данные
          └─ Waiting for auto cleanup

Day 30:   Background task запускается
          ├─ Находит аккаунт (blocked_at < 30 days ago)
          └─ ФИЗИЧЕСКОЕ удаление из БД

          ✅ User полностью исчез из базы
          ✅ GDPR compliance выполнен
          ❌ Восстановление невозможно
```

---

## 🔒 GDPR Compliance

### **"Right to be forgotten" (Право на забвение)**

✅ **Анонимизация персональных данных:**
```python
# Soft delete
db_user.twitch_username = f"deleted_user_{user_id}"
db_user.vk_username = f"deleted_user_{user_id}"
db_user.vk_channel_name = None
db_user.is_blocked = True
db_user.blocked_reason = "account_deleted"
db_user.blocked_at = datetime.utcnow()
```

✅ **Retention period (30 дней):**
- Достаточно для технических операций
- Позволяет восстановить аккаунт (если реализовать)
- Соответствует индустриальным стандартам

✅ **Окончательное удаление:**
- Физическое удаление User record через 30 дней
- Нет возможности восстановления
- Полное соответствие GDPR

✅ **Audit trail (Логирование):**
```
🗑️ [DELETE ACCOUNT] User 123 requested account deletion
🔒 [DELETE ACCOUNT] User marked as blocked with reason: account_deleted
📊 [DELETE ACCOUNT] Deleted counts: {tokens: 3, sessions: 1, ...}
✅ [CLEANUP] Permanently deleted user 123 (deleted_user_123) - deleted on 2025-09-27
```

---

## 🛡️ Защита от ошибок

### **1. Защита от крашей WebSocket**

При попытке WebSocket соединения удалённого пользователя:

```python
# bot_service/main.py - websocket_chat endpoint
user = db.query(User).filter(User.id == user_id_int).first()

# ⚠️ Проверяем что пользователь существует (может быть удалён)
if user:
    username = user.twitch_username or user.vk_username or f"user_{user_id_int}"
    connection_manager.schedule_tts_disconnect(user_id_int, username)
else:
    logger.warning(f"⚠️ User {user_id_int} not found (possibly deleted), skipping TTS disconnect")
```

**Результат:**
- ✅ Нет краша при обращении к удалённому пользователю
- ✅ Graceful degradation
- ✅ Логирование предупреждения
- ✅ WebSocket соединение не устанавливается

### **2. Защита от дублирования удаления**

```python
# Проверка существования пользователя
db_user = db.query(User).filter(User.id == user_id).first()
if not db_user:
    raise HTTPException(status_code=404, detail="User not found")
```

### **3. Транзакционная безопасность**

```python
try:
    # Все операции удаления
    db.commit()
except Exception as e:
    db.rollback()
    logger.error(f"❌ Error deleting user: {e}")
    raise HTTPException(status_code=500, detail=str(e))
```

---

## 📝 Восстановление аккаунта (опционально)

### **Как реализовать (если нужно):**

1. **Создать endpoint для восстановления:**
```python
@router.post("/user/restore-account")
async def restore_user_account(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    # Проверка прав (только owner или admin)
    if current_user.get('id') != user_id and not current_user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    user = db.query(User).filter(
        User.id == user_id,
        User.is_blocked == True,
        User.blocked_reason == "account_deleted"
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Deleted user not found")
    
    # Проверка retention period (30 дней)
    from datetime import datetime, timedelta
    if datetime.utcnow() - user.blocked_at > timedelta(days=30):
        raise HTTPException(status_code=410, detail="Account deleted permanently")
    
    # Восстановление
    user.is_blocked = False
    user.blocked_reason = None
    user.blocked_at = None
    # НЕ восстанавливаем username (требуется OAuth заново)
    
    db.commit()
    
    return {"success": True, "message": "Account restored"}
```

2. **UI для восстановления:**
```jsx
// Страница восстановления аккаунта
function RestoreAccountPage() {
  const handleRestore = async () => {
    const response = await apiClient.post('/api/user/restore-account');
    if (response.data.success) {
      toast.success('Аккаунт восстановлен! Войдите заново.');
      navigate('/login');
    }
  };
  
  return (
    <div>
      <h1>Восстановление аккаунта</h1>
      <p>Ваш аккаунт был удалён. У вас есть 30 дней для восстановления.</p>
      <button onClick={handleRestore}>Восстановить</button>
    </div>
  );
}
```

**Примечание:** Восстановление НЕ реализовано, но можно добавить при необходимости.

---

## 🧪 Тестирование

### **Ручное тестирование:**

1. **Soft delete:**
```bash
# 1. Создать тестового пользователя
# 2. Зайти через OAuth
# 3. Settings → Delete Account
# 4. Проверить БД:
python bot_service/check_db.py
# Должно быть: is_blocked=True, username=deleted_user_{id}
```

2. **Background cleanup (симуляция):**
```python
# Временно изменить retention period на 1 минуту
# bot_service/core/background_tasks.py
thirty_days_ago = datetime.utcnow() - timedelta(minutes=1)  # Вместо days=30

# Подождать 2 минуты
# Проверить логи:
# 🗑️ [CLEANUP] Found 1 accounts to permanently delete
# ✅ [CLEANUP] Permanently deleted user 123
```

3. **Admin delete:**
```bash
# Запрос от админа:
curl -X POST http://localhost:8000/api/admin/permanently-delete-user/123 \
  -H "Authorization: Bearer <admin_token>"

# Проверить БД - user должен исчезнуть
```

---

## 📚 Связанные документы

- `CURRENT_STATUS.md` - Общий статус проекта
- `GDPR_COMPLIANCE.md` - GDPR соответствие (если создан)
- `API_DOCUMENTATION.md` - Документация API

---

## ⚠️ Важные замечания

1. **Soft delete НЕ восстанавливает токены**
   - OAuth токены удаляются физически
   - При восстановлении требуется заново пройти OAuth

2. **Background task запускается автоматически**
   - Не требует manual intervention
   - Логирование всех операций
   - Error handling встроен

3. **Admin delete - НЕОБРАТИМО**
   - Нет confirmation на backend
   - UI должен требовать подтверждения
   - Используйте только для крайних случаев

4. **Retention period (30 дней) - не конфигурируется**
   - Захардкожено в коде
   - Для изменения требуется редактировать `background_tasks.py`
   - Индустриальный стандарт: 30-90 дней

---

**Статус:** ✅ Production Ready  
**Тестирование:** ✅ Протестировано  
**GDPR Compliance:** ✅ Полное соответствие

