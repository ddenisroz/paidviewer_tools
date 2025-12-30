# Быстрый старт: OAuth авторизация бота с автообновлением

## Зачем это нужно?

**Проблема:** TMI токен (https://twitchapps.com/tmi/) не имеет `refresh_token` и требует ручного обновления.

**Решение:** OAuth2 авторизация с автоматическим обновлением токена.

## Быстрая настройка (5 минут)

### 1. Применить миграцию

```bash
cd bot_service
alembic upgrade head
```

### 2. Настроить Twitch App (если ещё не настроено)

Уже настроено? Пропустите этот шаг.

1. https://dev.twitch.tv/console/apps
2. Добавьте redirect URL:
   ```
   http://localhost:8000/auth/twitch/bot/callback
   ```
3. Скопируйте Client ID и Secret в `.env`

### 3. Авторизовать бота

**Вариант A: Через браузер (проще)**

1. Запустите bot_service:
   ```bash
   cd bot_service
   python main.py
   ```

2. Войдите как администратор на http://localhost:5173

3. Перейдите на:
   ```
   http://localhost:8000/auth/twitch/bot/login
   ```

4. Авторизуйтесь на Twitch **под аккаунтом бота**

5. Готово! Токен сохранён и бот перезапущен

**Вариант B: Через API**

```bash
# Получить URL для авторизации
curl http://localhost:8000/auth/twitch/bot/login \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"

# Откройте URL в браузере и авторизуйтесь
```

### 4. Проверить статус

```bash
curl http://localhost:8000/api/admin/bot/token-status \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

Ответ:
```json
{
  "success": true,
  "configured": true,
  "bot_login": "your_bot_name",
  "days_left": 58,
  "needs_refresh": false,
  "has_refresh_token": true
}
```

## Что дальше?

**Токен обновляется автоматически:**
- При старте приложения (если истекает < 7 дней)
- Каждый час через мониторинг
- При получении 401 ошибки

**Ничего делать не нужно!** Система сама обновит токен.

## Проверка работы

**Логи при старте:**
```
[TWITCH] Found OAuth bot token in database
[TWITCH] Using OAuth token for bot: your_bot_name
[BOT] ⚡ TWITCH BOT READY! ⚡
[OK] ✅ MONITORING CHAT: yourchy
```

**Логи при автообновлении:**
```
[REFRESH] Bot token expires in 5 days, refreshing...
[OK] Twitch bot token refreshed for your_bot_name
```

## Fallback на TMI токен

Если OAuth не настроен, система использует `TWITCH_BOT_TOKEN` из `.env`:

```bash
# bot_service/.env
TWITCH_BOT_TOKEN=oauth:abc123...
```

Это работает, но требует ручного обновления.

## Команды для управления

```bash
# Проверить статус
GET /api/admin/bot/token-status

# Принудительно обновить
POST /api/admin/bot/refresh-token

# Авторизоваться заново
GET /auth/twitch/bot/login
```

## Troubleshooting

**Бот не запускается:**
- Проверьте логи: `grep "BOT TOKEN" logs/app/*.log`
- Проверьте статус: `GET /api/admin/bot/token-status`
- Авторизуйтесь заново: `GET /auth/twitch/bot/login`

**Токен не обновляется:**
- Проверьте мониторинг: `grep "monitoring" logs/app/*.log`
- Обновите вручную: `POST /api/admin/bot/refresh-token`

## Полная документация

- `docs/BOT_OAUTH_AUTO_REFRESH.md` - Подробное руководство
- `docs/BOT_TOKEN_MANAGEMENT.md` - Управление токенами
- `docs/TOKEN_REFRESH_SUMMARY.md` - Сводка по обновлению

## Итог

✅ OAuth2 с автообновлением настроен
✅ Токен обновляется автоматически
✅ Не требует ручного обслуживания
✅ Fallback на TMI токен работает

**Рекомендация:** Используйте OAuth2 для production, TMI токен оставьте для dev/testing.
