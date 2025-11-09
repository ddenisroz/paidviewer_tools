# 👥 Реализация гостевого режима

**Версия:** 1.0  
**Дата:** 7 ноября 2025  
**Статус:** ✅ Полностью реализовано

---

## 📋 Обзор

Гостевой режим позволяет пользователям **тестировать бота БЕЗ регистрации** через Twitch/VK OAuth. Гости получают временную сессию и могут использовать базовые функции TTS.

---

## 🔄 Как работает гостевой режим

### 1. Создание гостевой сессии

#### Frontend (`frontend/src/pages/GuestPage.jsx`)

1. Пользователь открывает `/guest`
2. Выбирает платформу (Twitch или VK Live)
3. Вводит имя канала
4. Нажимает "Получить код доступа"
5. Получает 6-значный код верификации

#### Backend (`bot_service/api/guest_api.py`)

**Эндпоинт:** `POST /api/chat/guest/connect`

```python
# Создает временный код верификации
guest_verification_codes[channel_name] = {
    "code": verification_code,
    "platform": platform,
    "created_at": datetime.utcnow(),
    "expires_at": datetime.utcnow() + timedelta(seconds=60),
    "confirmed": False
}
```

**Процесс:**
- Генерируется 6-значный код
- Код сохраняется в памяти (срок действия 60 секунд)
- Бот подключается к каналу для мониторинга кода
- Владелец канала должен написать код в чат

#### Подтверждение кода

**Frontend:** Polling каждые 2 секунды (`/api/chat/guest/check`)

**Backend:** Бот мониторит чат и ищет код верификации

Когда владелец канала пишет код в чат:
- Бот обнаруживает код
- Устанавливает `confirmed = True`
- Frontend получает подтверждение через polling

#### Финализация сессии

**Эндпоинт:** `POST /api/chat/guest/finalize`

**Процесс:**
1. Проверяется, что код подтвержден
2. Создается гостовая сессия через `SessionManager.create_guest_session()`
3. Создаются настройки для гостя (`UserSettings`, `TTSUserSettings`)
4. Бот подключается к каналу для TTS
5. Возвращается `session_id` (UUID)

---

## 💾 Как работает сессия гостя

### Backend: Хранение сессии

#### Таблица `GuestSession` (`bot_service/core/database.py`)

```python
class GuestSession(Base):
    __tablename__ = 'guest_sessions'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String, unique=True, index=True)  # UUID
    channel_name = Column(String, index=True)  # Канал, который мониторит гость
    platform = Column(String)  # 'twitch' или 'vk'
    device_info = Column(JSON)  # Дополнительная информация
    created_at = Column(DateTime)
    last_activity = Column(DateTime, index=True)
    is_active = Column(Boolean, index=True)
```

**Индексы:**
- `(channel_name, platform)` - для быстрого поиска
- `last_activity` - для cleanup старых сессий
- `is_active` - для фильтрации активных сессий

#### Настройки гостя

Все настройки привязаны к `session_id` (не к `user_id`):

- **`UserSettings`** - базовые настройки чата
- **`TTSUserSettings`** - настройки TTS
- **`LocalTTSEndpoint`** - настройки локального TTS
- **`FilteredWord`** - отфильтрованные слова
- **`TTSBlockedUser`** - заблокированные пользователи
- **`YouTubeQueue`** - очередь YouTube заказов
- **`UserToken`** - токены (DonationAlerts и др.)
- **`DropsConfig`**, **`DropsReward`**, **`UserStreak`**, **`DropsHistory`** - настройки Drops

**Constraint:** `(user_id XOR session_id)` - либо `user_id`, либо `session_id`, но не оба

### Frontend: Хранение сессии

#### AuthContext (`frontend/src/context/AuthContext.jsx`)

```javascript
const setGuestMode = useCallback(async (guestData) => {
    setIsAuthenticated(true);
    setIsGuest(true);
    setUser({
        id: -1,  // Специальный ID для гостевого пользователя
        username: guestData.username,
        is_admin: false,
        is_guest: true,
        platform: guestData.platform,
        integrations: {}
    });
}, []);
```

**Важно:** На фронтенде используется `user.id = -1` для гостей, но `session_id` НЕ хранится в `user` объекте напрямую.

#### Получение session_id

**Эндпоинт:** `GET /api/auth/status`

**Backend (`bot_service/main.py`):**
```python
if user_id == -1:
    # Гостевая сессия
    guest_user = {
        "id": -1,
        "session_id": session_id,  # ✅ Добавляется здесь
        "username": device_info.get("monitored_channel", "guest"),
        "is_guest": True,
        "is_admin": False,
        "platform": device_info.get("platform", "unknown")
    }
    return {"authenticated": True, "user": guest_user, "integrations": {}}
```

**Frontend:** После вызова `/api/auth/status` `user.session_id` доступен в `AuthContext`.

#### Использование session_id

**WebSocket (`frontend/src/context/ChatContext.jsx`):**
```javascript
// Для гостей используем session_id как уникальный идентификатор
const userId = isGuest ? user?.session_id : user?.id;
```

**API запросы:** Бэкенд определяет гостя по `session_id` из cookies:
- Cookie `session_id` устанавливается при финализации гостевой сессии
- Бэкенд проверяет `session_id` в таблице `GuestSession`
- Если найдено - это гость (`user_id = -1`)
- Если не найдено - проверяется таблица `UserSession` для авторизованных пользователей

---

## 🔄 Миграция гостя на авторизованного пользователя

### Процесс миграции

#### 1. Гость авторизуется через OAuth

**Frontend:** Пользователь нажимает "Войти через Twitch/VK" на странице `/login`

**Backend (`bot_service/auth/oauth_handler.py`):**

```python
# Проверяем, есть ли активная гостевая сессия для этого канала
guest_session_for_channel = db.query(GuestSession).filter(
    GuestSession.channel_name == channel_name,
    GuestSession.platform == platform,
    GuestSession.is_active == True
).first()

if guest_session_for_channel:
    # Конвертируем гостевую сессию в авторизованную
    unified_user = session_manager.convert_guest_to_authenticated(
        guest_session_id=guest_session_for_channel.session_id,
        platform=platform,
        platform_user_id=user_data.platform_user_id,
        avatar_url=user_data.avatar_url,
        access_token=user_data.access_token,
        refresh_token=user_data.refresh_token,
        expires_at=user_data.expires_at,
        scopes=user_data.scopes,
        username=user_data.username
    )
```

#### 2. Конвертация сессии (`bot_service/core/session_manager.py`)

**Метод:** `convert_guest_to_authenticated()`

**Процесс:**

1. **Создание нового пользователя:**
   ```python
   new_user = User(is_admin=False, is_active=True)
   db.add(new_user)
   db.commit()
   ```

2. **Сохранение токенов платформы:**
   ```python
   self.save_user_tokens(
       user_id=new_user.id,
       platform=platform,
       platform_user_id=platform_user_id,
       access_token=access_token,
       refresh_token=refresh_token,
       expires_at=expires_at,
       scopes=scopes
   )
   ```

3. **Перенос настроек:**
   - **`UserSettings`** - создается новая запись с `user_id = new_user.id`, `session_id = None`
   - **`TTSUserSettings`** - создается новая запись с `user_id = new_user.id`, `session_id = None`
   - **`LocalTTSEndpoint`** - обновляется: `user_id = new_user.id`, `session_id = None`
   - **`FilteredWord`** - обновляется: `user_id = new_user.id`, `session_id = None`
   - **`TTSBlockedUser`** - обновляется: `user_id = new_user.id`, `session_id = None`
   - **`YouTubeQueue`** - обновляется: `user_id = new_user.id`, `session_id = None`
   - **`UserToken`** - обновляется: `user_id = new_user.id`, `session_id = None`
   - **`DropsConfig`**, **`DropsReward`**, **`UserStreak`**, **`DropsHistory`**, **`MythicalDropsSession`** - обновляются: `user_id = new_user.id`, `session_id = None`

4. **Завершение гостевых сессий:**
   ```python
   # Завершаем ВСЕ гостевые сессии для этого канала
   channel_name = platform_user_id.lower()
   self.terminate_guest_sessions_for_channel(channel_name, "converted_to_authenticated")
   ```

5. **Обновление device_info гостевой сессии:**
   ```python
   # Обновляем device_info гостевой сессии перед завершением (для истории)
   # ⚠️ GuestSession не имеет поля user_id - это отдельная таблица
   guest_session.device_info = {
       **guest_session.device_info,
       "converted_from_guest": True,
       "conversion_platform": platform,
       "conversion_timestamp": datetime.utcnow().isoformat(),
       "converted_to_user_id": new_user.id
   }
   ```

6. **Создание новой UserSession:**
   ```python
   # Создаем новую UserSession для авторизованного пользователя
   # (GuestSession завершается через terminate_guest_sessions_for_channel)
   new_user_session = UserSession(
       user_id=new_user.id,
       session_id=guest_session_id,  # Используем тот же session_id для плавного перехода
       device_info=guest_session.device_info,
       is_active=True
   )
   db.add(new_user_session)
   ```
   
   **Важно:** Используется тот же `session_id` для плавного перехода - cookie остается тем же, но теперь указывает на `UserSession` вместо `GuestSession`.

#### 3. Frontend обновление

**AuthContext (`frontend/src/context/AuthContext.jsx`):**

После успешной OAuth авторизации:
1. Вызывается `checkAuthStatus()`
2. Получается новый `user` объект с реальным `user.id` (не -1)
3. `isGuest` устанавливается в `false`
4. `isAuthenticated` остается `true`

---

## 🔍 Идентификация гостя на бэкенде

### Определение типа пользователя

**Метод:** `get_current_user()` (`bot_service/auth/auth.py`)

```python
def get_session_data(request: Request) -> Optional[Dict[str, Any]]:
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    return session_manager.validate_session(session_id)
```

**Метод:** `validate_session()` (`bot_service/core/session_manager.py`)

```python
def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
    # 1. Проверяем GuestSession ПЕРВЫМ
    guest_session = db.query(GuestSession).filter_by(
        session_id=session_id, 
        is_active=True
    ).first()
    
    if guest_session:
        return {
            "user_id": -1,
            "id": -1,
            "session_id": session_id,
            "is_admin": False,
            "is_guest": True,
            "device_info": guest_session.device_info,
            "login_platform": guest_session.platform
        }
    
    # 2. Проверяем UserSession для авторизованных
    session = db.query(UserSession).filter_by(
        session_id=session_id, 
        is_active=True
    ).first()
    
    if session:
        return {
            "user_id": session.user_id,
            "id": session.user_id,
            "is_admin": False,
            "is_guest": False,
            # ...
        }
```

### Использование UserIdentityService

**Сервис:** `bot_service/services/user_identity_service.py`

```python
class UserIdentityService:
    @staticmethod
    def get_user_type(user: Dict[str, Any]) -> UserType:
        if user.get('is_guest', False):
            return UserType.GUEST
        return UserType.AUTHENTICATED
    
    @staticmethod
    def get_user_identifier(user: Dict[str, Any]) -> str:
        if user.get('is_guest', False):
            return user.get('session_id')
        return str(user.get('id'))
    
    @staticmethod
    def get_database_filters(user: Dict[str, Any]) -> Dict[str, Any]:
        if user.get('is_guest', False):
            return {"session_id": user.get('session_id')}
        return {"user_id": user.get('id')}
```

---

## ⚠️ Известные проблемы

### 1. GuestSession не имеет user_id ✅ ИСПРАВЛЕНО

**Проблема:** В методе `convert_guest_to_authenticated()` была попытка установить `guest_session.user_id = new_user.id`, но `GuestSession` не имеет поля `user_id`.

**Решение:** Исправлено - теперь:
- Обновляется только `device_info` гостевой сессии (для истории)
- Создается новая `UserSession` с тем же `session_id` для плавного перехода
- `GuestSession` завершается через `terminate_guest_sessions_for_channel()`

### 2. Frontend не хранит session_id

**Проблема:** На фронтенде `session_id` не хранится в `user` объекте после `setGuestMode()`. Он доступен только после вызова `/api/auth/status`.

**Решение:** Можно добавить `session_id` в `user` объект при `setGuestMode()`, если он возвращается из `/api/chat/guest/finalize`.

### 3. Cleanup старых сессий

**Проблема:** Старые гостевые сессии могут накапливаться в базе данных.

**Решение:** Используется утилита `bot_service/utils/cleanup_guest_sessions.py` для удаления старых сессий по `last_activity`.

---

## 📊 Схема работы

```
┌─────────────────────────────────────────────────────────────┐
│                    СОЗДАНИЕ ГОСТЕВОЙ СЕССИИ                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Пользователь вводит канал на /guest                      │
│ 2. POST /api/chat/guest/connect                             │
│    → Генерируется код верификации                           │
│    → Бот подключается к каналу                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Владелец канала пишет код в чат                          │
│ 4. Бот обнаруживает код → confirmed = True                 │
│ 5. Frontend polling обнаруживает подтверждение              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. POST /api/chat/guest/finalize                            │
│    → SessionManager.create_guest_session()                   │
│    → Создается запись в GuestSession                        │
│    → Создаются UserSettings, TTSUserSettings                │
│    → Устанавливается cookie session_id                       │
│    → Возвращается session_id                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Frontend: setGuestMode()                                 │
│    → user.id = -1                                           │
│    → isGuest = true                                         │
│    → isAuthenticated = true                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ИСПОЛЬЗОВАНИЕ ГОСТЕВОГО РЕЖИМА           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. API запросы:                                             │
│    → Cookie session_id отправляется автоматически           │
│    → Backend: validate_session()                            │
│    → Проверяется GuestSession                               │
│    → Возвращается user с id=-1, session_id, is_guest=true  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    МИГРАЦИЯ НА АВТОРИЗОВАННОГО               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Гость авторизуется через OAuth                           │
│ 10. OAuthHandler обнаруживает GuestSession для канала       │
│ 11. SessionManager.convert_guest_to_authenticated()         │
│     → Создается новый User                                  │
│     → Сохраняются токены платформы                          │
│     → Переносятся все настройки (session_id → user_id)      │
│     → Завершаются все гостевые сессии для канала             │
│     → Создается новая UserSession                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. Frontend: checkAuthStatus()                             │
│     → user.id = реальный ID (не -1)                         │
│     → isGuest = false                                       │
│     → isAuthenticated = true                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Безопасность

1. **Верификация кода:** Код верификации действителен только 60 секунд
2. **Подтверждение владельцем:** Только владелец канала может подтвердить код
3. **Изоляция данных:** Данные гостей изолированы через `session_id`
4. **Cleanup:** Старые гостевые сессии удаляются автоматически

---

## 📝 Заключение

Гостевой режим полностью реализован и работает следующим образом:

1. **Создание:** Гость получает `session_id` через верификацию кода
2. **Хранение:** Сессия хранится в таблице `GuestSession`, настройки привязаны к `session_id`
3. **Использование:** Бэкенд определяет гостя по `session_id` из cookies
4. **Миграция:** При OAuth авторизации все настройки переносятся с `session_id` на `user_id`

**Важно:** На фронтенде используется `user.id = -1` для гостей, но `session_id` доступен через `/api/auth/status`.

