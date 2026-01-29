# Руководство по настройке OAuth авторизации бота

## Что это дает

OAuth2 авторизация с refresh_token обеспечивает:
- ✅ **Автоматическое обновление токена** каждые ~60 дней
- ✅ **Бесконечная работа бота** без ручного вмешательства
- ✅ **Безопасное хранение** токенов в базе данных (зашифровано)
- ✅ **Мониторинг статуса** токена в админ панели

## Быстрый старт

### Шаг 1: Убедитесь что вы админ

```bash
cd bot_service
python scripts/check_admin.py
```

Если вы не админ:
```bash
python scripts/make_admin.py
```

### Шаг 2: Настройте Twitch приложение

1. Откройте https://dev.twitch.tv/console/apps
2. Создайте новое приложение или используйте существующее
3. Добавьте OAuth Redirect URL:
   ```
   http://localhost:8000/auth/twitch/bot/callback
   ```
   Для продакшена:
   ```
   https://ваш-домен.com/auth/twitch/bot/callback
   ```

4. Скопируйте Client ID и Client Secret

### Шаг 3: Настройте .env

```bash
# bot_service/.env

# Twitch OAuth (для пользователей)
TWITCH_CLIENT_ID=ваш_client_id
TWITCH_CLIENT_SECRET=ваш_client_secret

# Backend URL (для OAuth callback)
BACKEND_URL=http://localhost:8000

# Frontend URL (для редиректа после авторизации)
FRONTEND_URL=http://localhost:5173
```

### Шаг 4: Авторизуйте бота через админку

1. Запустите сервисы:
   ```bash
   cd bot_service
   python main.py       # Backend

   cd ../frontend
   npm run dev          # Frontend
   ```

2. Откройте админку: http://localhost:5173/settings

3. В разделе "Управление ботом" нажмите **"Авторизовать бота"**

4. Войдите на Twitch **под аккаунтом бота** (не вашим основным!)

5. Подтвердите разрешения

6. Готово! Токен сохранен и будет обновляться автоматически

## Как это работает

### Первая авторизация (1 раз)

```
┌─────────────────────────────────────────────────┐
│ 1. Админ нажимает "Авторизовать бота"          │
│ 2. Редирект на Twitch OAuth                    │
│ 3. Вход под аккаунтом бота                     │
│ 4. Подтверждение разрешений                    │
│ 5. Callback → получение токенов                │
│ 6. Сохранение в БД (зашифровано)               │
│ 7. Бот автоматически перезапускается           │
└─────────────────────────────────────────────────┘
```

### Автоматическое обновление (без участия человека)

```
┌─────────────────────────────────────────────────┐
│ Проверка токена происходит:                    │
│ • При старте сервера                           │
│ • Каждый час (фоновая задача)                  │
│ • При ошибке 401 от Twitch                     │
│                                                 │
│ Если токен истекает < 7 дней:                  │
│ → Автоматически обновляется через refresh      │
│ → Бот перезапускается с новым токеном          │
│ → Логируется в консоль                         │
└─────────────────────────────────────────────────┘
```

## Управление через админку

### Просмотр статуса токена

В админке отображается:
- **Логин бота** (например: yourchy_bot)
- **Срок действия токена** (например: 45 дней)
- **Статус автообновления** (активно/неактивно)
- **Предупреждения** (если токен скоро истечет)

### Ручное обновление токена

Если нужно обновить токен вручную:
1. Нажмите **"Обновить токен"**
2. Токен обновится через refresh_token
3. Бот автоматически перезапустится

### Переавторизация бота

Если нужно сменить аккаунт бота:
1. Нажмите **"Переавторизовать"**
2. Войдите под новым аккаунтом бота
3. Старый токен будет заменен

## API Endpoints (для разработчиков)

### GET /auth/twitch/bot/login
Инициирует OAuth авторизацию бота (требует права админа)

### GET /auth/twitch/bot/callback
Обрабатывает OAuth callback от Twitch

### GET /api/admin/bot/token-status
Получить статус токена бота

**Response:**
```json
{
  "success": true,
  "configured": true,
  "bot_login": "yourchy_bot",
  "bot_user_id": "123456789",
  "expires_at": "2025-02-18T12:00:00",
  "days_left": 45,
  "needs_refresh": false,
  "has_refresh_token": true
}
```

### POST /api/admin/bot/refresh-token
Принудительно обновить токен бота (требует права админа)

**Response:**
```json
{
  "success": true,
  "message": "Bot token refreshed and bot restarted"
}
```

## Troubleshooting

### Бот не подключается после авторизации

1. Проверьте логи:
   ```bash
   # В консоли bot_service должно быть:
   [OK] [BOT OAUTH] Bot tokens saved successfully
   [OK] [BOT OAUTH] Bot restarted with new token
   ```

2. Проверьте токен в БД:
   ```bash
   cd bot_service
   python scripts/check_bot_token.py
   ```

### "Not Found" при переходе на /auth/twitch/bot/login

1. Убедитесь что роутер зарегистрирован в `main.py`:
   ```python
   from auth.twitch_bot_oauth import router as twitch_bot_oauth_router
   app.include_router(twitch_bot_oauth_router)
   ```

2. Перезапустите backend:
   ```bash
   python main.py
   ```

### "Unauthorized" или "Admin rights required"

1. Проверьте что вы админ:
   ```bash
   python scripts/check_admin.py
   ```

2. Если нет - сделайте себя админом:
   ```bash
   python scripts/make_admin.py
   ```

3. **Важно:** После получения прав админа нужно **перелогиниться** в frontend:
   - Удалите cookie `session_id`
   - Или откройте в режиме инкогнито
   - Войдите заново

### Токен не обновляется автоматически

1. Проверьте что в БД есть refresh_token:
   ```bash
   python scripts/check_bot_token.py
   ```

2. Проверьте логи фоновой задачи:
   ```bash
   # Должно быть каждый час:
   [REFRESH] Bot token expires in X days, refreshing...
   [OK] Twitch bot token refreshed
   ```

3. Если refresh_token отсутствует - переавторизуйте бота через админку

## Альтернатива: TMI Token (быстрый старт)

Если нужно быстро запустить бота без OAuth:

1. Получите TMI токен: https://twitchapps.com/tmi/
2. Добавьте в `.env`:
   ```bash
   TWITCH_BOT_TOKEN=oauth:ваш_токен
   ```
3. Перезапустите бота

**Минусы:**
- ❌ Токен истекает через 60 дней
- ❌ Нужно обновлять вручную
- ❌ Нет автообновления

**Рекомендация:** Используйте TMI только для тестирования. Для продакшена используйте OAuth2.

## Безопасность

### Шифрование токенов

Все токены в БД хранятся в зашифрованном виде:
- Используется Fernet (симметричное шифрование)
- Ключ шифрования в `.env` (`ENCRYPTION_KEY`)
- Даже при утечке БД токены нельзя использовать без ключа

### Права доступа

- Только **админы** могут авторизовать бота
- Только **админы** могут видеть статус токена
- Только **админы** могут обновлять токен

### Логирование

Все действия с токеном логируются:
```
[BOT OAUTH] Admin 1 initiated bot OAuth
[OK] [BOT OAUTH] Bot tokens saved successfully
[REFRESH] Bot token expires in 5 days, refreshing...
[OK] Twitch bot token refreshed for yourchy_bot
```

## Миграция с TMI на OAuth2

Если вы используете TMI токен и хотите перейти на OAuth2:

1. Оставьте TMI токен в `.env` (как fallback)
2. Авторизуйте бота через админку
3. OAuth токен получит приоритет над TMI
4. После проверки работы - удалите TMI токен из `.env`

Приоритет токенов:
```
1. OAuth токен из БД (если есть)
2. TMI токен из .env (fallback)
```

## Мониторинг

### Логи

Все события OAuth логируются с префиксом `[BOT OAUTH]`:
```bash
# Успешные операции
[OK] [BOT OAUTH] Bot tokens saved successfully
[OK] Twitch bot token refreshed for yourchy_bot

# Предупреждения
[WARN] No Twitch bot token found in database
[REFRESH] Bot token expires in 5 days, refreshing...

# Ошибки
[ERROR] Failed to refresh bot token: Invalid refresh token
[ERROR] Refresh token is invalid - need to re-authorize bot
```

### Метрики

Система отслеживает:
- Время последнего обновления токена
- Количество дней до истечения
- Наличие refresh_token
- Статус бота (запущен/остановлен)

## Заключение

OAuth2 с refresh_token - это **рекомендуемый** способ авторизации бота:
- Настраивается один раз за 1 минуту
- Работает бесконечно без вмешательства
- Безопасно и надежно
- Соответствует best practices

Если возникли проблемы - проверьте раздел Troubleshooting или обратитесь к логам.
