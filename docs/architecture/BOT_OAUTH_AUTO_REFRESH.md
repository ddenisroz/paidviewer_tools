# Автоматическое обновление токена бота через OAuth2

## Обзор

Реализована **полноценная OAuth2 авторизация для Twitch бота** с поддержкой `refresh_token` и автоматическим обновлением.

## Два способа авторизации бота

### 1. OAuth2 с автообновлением ✅ (Рекомендуется)

**Преимущества:**
- ✅ Автоматическое обновление токена
- ✅ Токен хранится в БД (зашифрован)
- ✅ Refresh token для продления
- ✅ Не требует ручного обновления
- ✅ Централизованное управление

**Недостатки:**
- Требует первичной OAuth авторизации через веб-интерфейс
- Нужны права администратора

### 2. TMI токен из .env ⚠️ (Fallback)

**Преимущества:**
- Простая настройка
- Быстрый старт

**Недостатки:**
- ❌ Нет автообновления
- ❌ Требует ручного обновления при истечении
- ❌ Токен в .env файле

## Настройка OAuth2 авторизации

### Шаг 1: Настройка Twitch Application

1. Перейдите на https://dev.twitch.tv/console/apps
2. Создайте новое приложение или используйте существующее
3. Добавьте OAuth Redirect URL:
   ```
   http://localhost:8000/auth/twitch/bot/callback
   ```
   Для production:
   ```
   https://yourdomain.com/auth/twitch/bot/callback
   ```

4. Скопируйте `Client ID` и `Client Secret`
5. Добавьте в `bot_service/.env`:
   ```bash
   TWITCH_CLIENT_ID=your_client_id
   TWITCH_CLIENT_SECRET=your_client_secret
   ```

### Шаг 2: Авторизация бота

**Через веб-интерфейс (рекомендуется):**

1. Войдите как администратор
2. Перейдите в админ-панель: `/admin/settings`
3. Нажмите "Authorize Bot" или перейдите на:
   ```
   http://localhost:8000/auth/twitch/bot/login
   ```

4. Авторизуйтесь на Twitch (используйте аккаунт бота!)
5. Разрешите доступ к следующим правам:
   - `chat:read` - Чтение сообщений
   - `chat:edit` - Отправка сообщений
   - `channel:moderate` - Модерация (опционально)
   - `whispers:read` - Чтение whispers (опционально)
   - `whispers:edit` - Отправка whispers (опционально)

6. После успешной авторизации вы будете перенаправлены обратно
7. Токены сохранятся в БД и бот автоматически перезапустится

**Через API (для автоматизации):**

```bash
# Получить URL для авторизации
curl -X GET http://localhost:8000/auth/twitch/bot/login \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"

# Проверить статус токена
curl -X GET http://localhost:8000/api/admin/bot/token-status \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"

# Принудительно обновить токен
curl -X POST http://localhost:8000/api/admin/bot/refresh-token \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

### Шаг 3: Применение миграции

```bash
cd bot_service
alembic upgrade head
```

Это создаст таблицу `bot_tokens` для хранения токенов.

## Как это работает

### Приоритет токенов

При запуске бота система проверяет токены в следующем порядке:

1. **OAuth токен из БД** (таблица `bot_tokens`)
   - Если найден - используется он
   - Автоматически обновляется при истечении

2. **TMI токен из .env** (`TWITCH_BOT_TOKEN`)
   - Используется если OAuth токен не настроен
   - Fallback для обратной совместимости

### Автоматическое обновление

**Когда обновляется:**
- При старте приложения (если истекает в течение 7 дней)
- Периодически через мониторинг (каждый час)
- При получении 401 ошибки от Twitch API

**Процесс обновления:**
1. Система проверяет `expires_at` токена
2. Если токен истекает скоро - запускается refresh
3. Используется `refresh_token` для получения нового `access_token`
4. Новые токены сохраняются в БД
5. Бот автоматически перезапускается с новым токеном

### Хранение токенов

**База данных:**
```sql
CREATE TABLE bot_tokens (
    id INTEGER PRIMARY KEY,
    platform VARCHAR NOT NULL UNIQUE,  -- 'twitch' или 'vk'
    access_token VARCHAR NOT NULL,     -- Зашифрован
    refresh_token VARCHAR,             -- Зашифрован
    expires_at DATETIME,
    scopes JSON,
    bot_user_id VARCHAR,
    bot_login VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
);
```

**Шифрование:**
- Токены шифруются с помощью Fernet (симметричное шифрование)
- Ключ шифрования: `TOKEN_ENCRYPTION_KEY` из .env
- Никогда не хранятся в открытом виде

## API Endpoints

### Для администраторов

**1. Инициировать OAuth авторизацию:**
```
GET /auth/twitch/bot/login
```
Требует: Admin права
Возвращает: Redirect на Twitch OAuth

**2. OAuth callback (автоматический):**
```
GET /auth/twitch/bot/callback?code=...&state=...
```
Обрабатывается автоматически после авторизации на Twitch

**3. Получить статус токена:**
```
GET /api/admin/bot/token-status
```
Требует: Admin права

Ответ:
```json
{
  "success": true,
  "configured": true,
  "bot_login": "your_bot_name",
  "bot_user_id": "123456789",
  "expires_at": "2025-02-15T10:30:00",
  "days_left": 45,
  "needs_refresh": false,
  "has_refresh_token": true
}
```

**4. Принудительно обновить токен:**
```
POST /api/admin/bot/refresh-token
```
Требует: Admin права

Ответ:
```json
{
  "success": true,
  "message": "Bot token refreshed and bot restarted"
}
```

## Сервисы

### TwitchBotOAuthService

**Основной сервис для управления OAuth токенами бота.**

**Файл:** `services/twitch_bot_oauth_service.py`

**Методы:**

```python
# Получить URL для авторизации
url = TwitchBotOAuthService.get_authorization_url(state)

# Обменять code на токены
tokens = await TwitchBotOAuthService.exchange_code_for_token(code)

# Получить информацию о боте
bot_info = await TwitchBotOAuthService.get_bot_user_info(access_token)

# Сохранить токены в БД
await TwitchBotOAuthService.save_bot_token(
    access_token, refresh_token, expires_in, scopes, 
    bot_user_id, bot_login, db
)

# Получить токен из БД
token_data = await TwitchBotOAuthService.get_bot_token(db)

# Обновить токен
success = await TwitchBotOAuthService.refresh_bot_token(db)

# Проверить и обновить если нужно
success = await TwitchBotOAuthService.refresh_if_needed(db)
```

## Интеграция с существующей системой

### Обратная совместимость

Система полностью обратно совместима:

1. **Если OAuth токен настроен** - используется он
2. **Если OAuth токен не настроен** - используется TMI токен из .env
3. **Если ничего не настроено** - бот не запускается с понятным сообщением

### Миграция с TMI на OAuth

**Текущая настройка (TMI):**
```bash
# bot_service/.env
TWITCH_BOT_TOKEN=oauth:abc123def456...
```

**Миграция на OAuth:**

1. Оставьте TMI токен в .env (для fallback)
2. Настройте OAuth через веб-интерфейс
3. После успешной OAuth авторизации TMI токен игнорируется
4. Можете удалить `TWITCH_BOT_TOKEN` из .env (опционально)

### Логи

**При использовании OAuth:**
```
[TWITCH] Found OAuth bot token in database
[TWITCH] Using OAuth token for bot: your_bot_name
[OK] [BOT TOKEN] Twitch bot token is VALID
[INFO] Bot user: your_bot_name (ID: 123456789)
```

**При использовании TMI:**
```
[TWITCH] No OAuth token in database, checking .env...
[TWITCH] Using TMI token from .env
[OK] [BOT TOKEN] Twitch bot token is VALID
```

**При автообновлении:**
```
[REFRESH] Bot token expires in 5 days, refreshing...
[OK] Twitch bot token refreshed for your_bot_name
[INFO] New token expires in: 5184000 seconds
```

## Мониторинг и обслуживание

### Проверка статуса

**Через API:**
```bash
curl http://localhost:8000/api/admin/bot/token-status \
  -H "Authorization: Bearer YOUR_JWT"
```

**Через логи:**
```bash
# Поиск информации о токене
grep "BOT TOKEN" bot_service/logs/app/*.log

# Поиск обновлений токена
grep "REFRESH" bot_service/logs/app/*.log
```

### Ручное обновление

**Если автообновление не сработало:**

1. Через API:
   ```bash
   curl -X POST http://localhost:8000/api/admin/bot/refresh-token \
     -H "Authorization: Bearer YOUR_JWT"
   ```

2. Через повторную авторизацию:
   - Перейдите на `/auth/twitch/bot/login`
   - Авторизуйтесь заново
   - Старые токены будут заменены

### Отзыв токенов

**Если токен скомпрометирован:**

1. Отзовите токен на Twitch:
   - https://www.twitch.tv/settings/connections
   - Найдите ваше приложение
   - Нажмите "Disconnect"

2. Удалите токен из БД:
   ```sql
   DELETE FROM bot_tokens WHERE platform = 'twitch';
   ```

3. Авторизуйтесь заново через `/auth/twitch/bot/login`

## Troubleshooting

### Бот не запускается после OAuth

**Проблема:** Бот не может подключиться после OAuth авторизации

**Решение:**
1. Проверьте логи: `grep "BOT TOKEN" logs/app/*.log`
2. Проверьте статус токена: `GET /api/admin/bot/token-status`
3. Попробуйте обновить токен: `POST /api/admin/bot/refresh-token`
4. Если не помогает - авторизуйтесь заново

### Refresh token invalid

**Проблема:** `[ERROR] Refresh token is invalid - need to re-authorize bot`

**Причины:**
- Токен был отозван на Twitch
- Прошло слишком много времени
- Изменились credentials приложения

**Решение:**
- Авторизуйтесь заново через `/auth/twitch/bot/login`

### OAuth callback не работает

**Проблема:** После авторизации на Twitch возвращается ошибка

**Проверьте:**
1. Redirect URL в Twitch App совпадает с `BACKEND_URL/auth/twitch/bot/callback`
2. `TWITCH_CLIENT_ID` и `TWITCH_CLIENT_SECRET` корректны
3. Порт 8000 доступен
4. Нет ошибок в логах

### Токен не обновляется автоматически

**Проблема:** Токен истёк, но не обновился

**Проверьте:**
1. Мониторинг запущен: `grep "Bot token monitoring" logs/app/*.log`
2. Refresh token присутствует в БД
3. Нет ошибок при обновлении в логах
4. Попробуйте обновить вручную

## Сравнение методов

| Характеристика | OAuth2 (рекомендуется) | TMI токен |
|----------------|------------------------|-----------|
| **Автообновление** | ✅ Да | ❌ Нет |
| **Refresh token** | ✅ Есть | ❌ Нет |
| **Хранение** | БД (зашифровано) | .env файл |
| **Настройка** | Веб-интерфейс | Ручная |
| **Обслуживание** | Автоматическое | Ручное |
| **Безопасность** | Высокая | Средняя |
| **Сложность** | Средняя | Низкая |
| **Срок действия** | ~60 дней (обновляется) | Не истекает* |

*TMI токены технически не истекают, но могут быть отозваны

## Рекомендации

1. **Используйте OAuth2** для production окружения
2. **TMI токен** оставьте как fallback для dev/testing
3. **Мониторьте логи** на предмет ошибок обновления
4. **Настройте алерты** при проблемах с токеном
5. **Документируйте процесс** для вашей команды
6. **Регулярно проверяйте** статус токена через API

## Связанные файлы

**Сервисы:**
- `services/twitch_bot_oauth_service.py` - OAuth сервис
- `services/bot_token_validator.py` - Валидатор токенов
- `services/token_refresh_service.py` - Обновление пользовательских токенов

**API:**
- `auth/twitch_bot_oauth.py` - OAuth endpoints
- `api/admin/bot_token_api.py` - Admin API для токенов

**Модели:**
- `models/bot_token.py` - Модель BotToken
- `models/__init__.py` - Экспорт моделей

**Миграции:**
- `alembic/versions/122026a49dfb_add_bot_tokens_table.py` - Создание таблицы

**Startup:**
- `startup/bot_initializer.py` - Инициализация с OAuth
- `startup/lifespan.py` - Мониторинг

**Документация:**
- `docs/BOT_TOKEN_MANAGEMENT.md` - Управление токенами
- `docs/TOKEN_REFRESH_SUMMARY.md` - Сводка по обновлению
- `docs/BOT_OAUTH_AUTO_REFRESH.md` - Этот документ

## Итог

Теперь у вас есть **два варианта** авторизации бота:

1. **OAuth2 с автообновлением** ✅ - рекомендуется для production
2. **TMI токен** ⚠️ - fallback для быстрого старта

OAuth2 решение полностью автоматизирует управление токенами и не требует ручного вмешательства после первичной настройки!
