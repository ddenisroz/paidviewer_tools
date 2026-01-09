# Bot Token Management System

## Обзор

Система управления токенами ботов обеспечивает автоматическую валидацию и мониторинг токенов, которые не имеют механизма refresh.

## Типы токенов в системе

### 1. Пользовательские OAuth токены (с refresh) ✅

**Платформы:**
- Twitch user OAuth
- VK Live user OAuth
- DonationAlerts OAuth

**Механизм обновления:**
- Автоматический через `TokenRefreshService`
- Использует `refresh_token` для получения нового `access_token`
- Обновление при истечении (за 7 дней) или при получении 401 ошибки

**Файлы:**
- `services/token_refresh_service.py` - Сервис обновления
- `auth/twitch_auth.py` - Twitch OAuth flow
- `auth/vk_auth.py` - VK OAuth flow

### 2. Токены ботов (БЕЗ refresh) ⚠️

**Токены:**
- `TWITCH_BOT_TOKEN` - Токен Twitch бота (из .env)
- `VK_LIVE_USER_TOKEN` - Токен VK бота (ClientCredentials)

**Проблема:**
- Эти токены получаются через упрощенные flow
- Не имеют `refresh_token`
- Требуют ручного обновления при истечении

**Решение:**
- Автоматическая валидация при старте
- Периодический мониторинг (каждый час)
- Детальные инструкции при обнаружении проблем

## Система валидации токенов ботов

### Компоненты

#### 1. BotTokenValidator (`services/bot_token_validator.py`)

**Основной класс для валидации токенов ботов.**

**Методы:**

```python
# Валидация Twitch токена
await bot_token_validator.validate_twitch_bot_token()
# Returns: {'valid': bool, 'user_id': str, 'login': str, 'error': str}

# Валидация VK токена
await bot_token_validator.validate_vk_bot_token()
# Returns: {'valid': bool, 'username': str, 'error': str}

# Валидация всех токенов
await bot_token_validator.validate_all_tokens()
# Returns: {'twitch': {...}, 'vk': {...}}

# Получить текущий статус
bot_token_validator.get_status()
# Returns: {'twitch': {'valid': bool, 'last_check': datetime}, ...}
```

**Функции:**
- Валидация токенов через API платформ
- Кэширование результатов валидации
- Детальное логирование с инструкциями по исправлению
- Периодический мониторинг

#### 2. Интеграция в startup (`startup/bot_initializer.py`)

**Валидация перед запуском бота:**

```python
# Перед инициализацией Twitch бота
validation_result = await bot_token_validator.validate_twitch_bot_token()

if not validation_result['valid']:
    logger.error("Cannot start bot with invalid token!")
    return False
```

**Преимущества:**
- Ранее обнаружение проблем (до попытки подключения)
- Понятные сообщения об ошибках
- Инструкции по исправлению в логах

#### 3. Мониторинг (`startup/lifespan.py`)

**Автоматический мониторинг токенов:**

```python
# Запуск при старте приложения
await bot_token_validator.start_monitoring(check_interval=3600)  # 1 час

# Остановка при shutdown
await bot_token_validator.stop_monitoring()
```

**Что делает:**
- Проверяет токены каждый час
- Логирует предупреждения при обнаружении проблем
- Не останавливает работающий бот (только уведомляет)

#### 4. Admin API (`api/admin/bot_token_api.py`)

**Endpoints для администраторов:**

```bash
# Получить статус токенов
GET /admin/bot-tokens/status

# Принудительно валидировать все токены
POST /admin/bot-tokens/validate

# Валидировать только Twitch
POST /admin/bot-tokens/validate/twitch

# Валидировать только VK
POST /admin/bot-tokens/validate/vk
```

**Требования:**
- Только для администраторов (`require_admin`)
- Возвращает детальную информацию о токенах

## Процесс валидации

### Twitch Bot Token

**Endpoint:** `https://id.twitch.tv/oauth2/validate`

**Проверка:**
1. Отправляет токен на Twitch API
2. Получает информацию о боте (user_id, login, scopes)
3. Проверяет срок действия (expires_in)

**Результаты:**
- ✅ **200 OK** - Токен валиден
- ❌ **401 Unauthorized** - Токен истёк или невалиден

**При ошибке:**
```
[ERROR] [BOT TOKEN] Twitch bot token is INVALID or EXPIRED!
[FIX] To fix this issue:
[FIX] 1. Go to: https://twitchapps.com/tmi/
[FIX] 2. Click 'Connect' and authorize
[FIX] 3. Copy the OAuth token
[FIX] 4. Update bot_service/.env:
[FIX]    TWITCH_BOT_TOKEN=oauth:your-new-token-here
[FIX] 5. Restart the bot service
```

### VK Live Bot Token

**Endpoint:** `https://apidev.live.vkvideo.ru/v1/current_user`

**Проверка:**
1. Отправляет токен на VK API
2. Получает информацию о боте (username, id)

**Результаты:**
- ✅ **200 OK** - Токен валиден
- ❌ **401 Unauthorized** - Токен истёк

**Особенность:**
VK токен генерируется автоматически через ClientCredentials при старте (см. `startup/bot_initializer.py::generate_vk_client_credentials_token`)

## Использование

### Проверка токена вручную

```bash
# Через скрипт
cd bot_service
python scripts/check_twitch_token.py

# Через API (требует admin права)
curl -X POST http://localhost:8000/admin/bot-tokens/validate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Мониторинг в логах

```bash
# При старте
[BOT TOKEN] Validating bot tokens...
[OK] [BOT TOKEN] Twitch bot token is VALID
[INFO] Bot user: your_bot_name (ID: 123456789)

# Периодическая проверка (каждый час)
[BOT TOKEN] Periodic token validation...
[OK] [BOT TOKEN] Twitch bot token is VALID
```

### Обработка ошибок

**Если токен невалиден при старте:**
- Бот НЕ запустится
- В логах будут инструкции по исправлению
- Приложение продолжит работу (без бота)

**Если токен стал невалидным во время работы:**
- Мониторинг обнаружит проблему
- В логах появится предупреждение
- Бот продолжит работу до перезапуска
- Администратор получит уведомление в логах

## Обновление токенов

### Twitch Bot Token

**Когда обновлять:**
- При получении ошибки "Invalid or unauthorized Access Token"
- При логах "[ERROR] [BOT TOKEN] Twitch bot token is INVALID"
- Если бот не подключается к IRC

**Как обновить:**

1. **Получить новый токен:**
   - Перейти на https://twitchapps.com/tmi/
   - Нажать "Connect"
   - Авторизоваться
   - Скопировать токен (начинается с `oauth:`)

2. **Обновить .env:**
   ```bash
   # bot_service/.env
   TWITCH_BOT_TOKEN=oauth:your-new-token-here
   ```

3. **Перезапустить сервис:**
   ```bash
   cd bot_service
   python main.py
   ```

4. **Проверить подключение:**
   ```
   [BOT] ⚡ TWITCH BOT READY! ⚡
   [OK] ✅ MONITORING CHAT: yourchy
   ```

### VK Live Bot Token

**Автоматическое обновление:**
- Токен генерируется автоматически при старте
- Использует `VK_CLIENT_ID` и `VK_CLIENT_SECRET` из .env
- Срок действия: 3600 секунд (1 час)

**Если токен невалиден:**
- Проверить `VK_CLIENT_ID` и `VK_CLIENT_SECRET` в .env
- Убедиться что credentials корректны
- Перезапустить сервис

## Диагностические инструменты

### 1. check_twitch_token.py

**Назначение:** Проверка формата и конфигурации Twitch токена

**Использование:**
```bash
cd bot_service
python scripts/check_twitch_token.py
```

**Проверяет:**
- Наличие токена в .env
- Правильность префикса `oauth:`
- Длину токена
- Формат токена

### 2. Admin API

**Назначение:** Проверка токенов через веб-интерфейс

**Endpoints:**
```bash
# Статус всех токенов
GET /admin/bot-tokens/status

# Валидация всех токенов
POST /admin/bot-tokens/validate
```

### 3. Логи

**Файлы:**
- `bot_service/logs/app/*.log` - Основные логи
- Поиск по `[BOT TOKEN]` для информации о токенах

## Сравнение с пользовательскими токенами

| Характеристика | Пользовательские OAuth | Токены ботов |
|----------------|------------------------|--------------|
| **Refresh token** | ✅ Есть | ❌ Нет |
| **Автообновление** | ✅ Да (TokenRefreshService) | ❌ Нет |
| **Валидация** | При использовании | При старте + мониторинг |
| **Срок действия** | ~60 дней | Не истекает (Twitch) / 1 час (VK) |
| **Обновление** | Автоматическое | Ручное |
| **Хранение** | База данных (encrypted) | .env файл |

## Best Practices

1. **Регулярно проверяйте логи** на наличие предупреждений о токенах
2. **Не коммитьте .env** файлы в git
3. **Обновляйте токены заранее** при получении предупреждений
4. **Используйте мониторинг** для раннего обнаружения проблем
5. **Храните backup токенов** в безопасном месте
6. **Документируйте процесс** обновления для вашей команды

## Troubleshooting

### Бот не подключается к Twitch

**Симптомы:**
- Нет логов `[BOT] ⚡ TWITCH BOT READY! ⚡`
- Ошибка "Invalid or unauthorized Access Token"

**Решение:**
1. Проверить токен: `python scripts/check_twitch_token.py`
2. Обновить токен на https://twitchapps.com/tmi/
3. Перезапустить сервис

### VK бот не работает

**Симптомы:**
- Ошибки при подключении к VK каналам
- 401 ошибки от VK API

**Решение:**
1. Проверить `VK_CLIENT_ID` и `VK_CLIENT_SECRET`
2. Убедиться что credentials активны
3. Перезапустить сервис для регенерации токена

### Мониторинг не работает

**Симптомы:**
- Нет периодических проверок в логах
- Статус мониторинга: `monitoring_active: false`

**Решение:**
1. Проверить что `start_monitoring()` вызывается в lifespan
2. Проверить логи на ошибки в `_monitoring_loop`
3. Перезапустить сервис

## Связанные файлы

**Сервисы:**
- `services/bot_token_validator.py` - Валидатор токенов
- `services/token_refresh_service.py` - Обновление пользовательских токенов

**Startup:**
- `startup/bot_initializer.py` - Инициализация ботов с валидацией
- `startup/lifespan.py` - Запуск мониторинга

**API:**
- `api/admin/bot_token_api.py` - Admin endpoints

**Скрипты:**
- `scripts/check_twitch_token.py` - Проверка токена

**Документация:**
- `docs/TWITCH_BOT_TOKEN_FIX.md` - Руководство по исправлению
- `docs/TTS_ISSUE_RESOLVED.md` - История проблемы с TTS
- `docs/QUICK_FIX_TTS.md` - Быстрое исправление

## Будущие улучшения

1. **Email уведомления** при обнаружении невалидных токенов
2. **Webhook интеграция** для оповещений в Discord/Slack
3. **UI в админ-панели** для управления токенами
4. **Автоматическая регенерация** VK токена при истечении
5. **История валидаций** в базе данных
6. **Метрики** для мониторинга здоровья токенов
