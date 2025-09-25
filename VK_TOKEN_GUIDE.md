# 🔑 Получение VK Live токена для "бота"

## Быстрый способ

### 1. Запустите утилиту
```bash
cd bot_service
python get_vk_token.py
```

### 2. Следуйте инструкциям
- Утилита покажет URL для авторизации
- Откройте URL в браузере
- Войдите в VK аккаунт, который будет "ботом"
- Скопируйте код из URL
- Вставьте код в утилиту

### 3. Добавьте токен в .env
```env
VK_LIVE_USER_TOKEN=полученный_токен_здесь
```

## Альтернативный способ (вручную)

### 1. Создайте приложение VK Live
- Перейдите на [VK Live Developer Console](https://dev.live.vkvideo.ru/)
- Создайте веб-приложение
- Запомните Client ID и Client Secret

### 2. Получите код авторизации
Откройте в браузере:
```
https://auth.live.vkvideo.ru/app/oauth2/authorize?
client_id=ВАШ_CLIENT_ID&
redirect_uri=http://localhost:8000/auth/vk/callback&
response_type=code&
scope=channel:stream:settings
```

### 3. Обменяйте код на токен
Используйте Postman или curl:
```bash
curl -X POST https://api.live.vkvideo.ru/oauth/server/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic BASE64(CLIENT_ID:CLIENT_SECRET)" \
  -d "grant_type=authorization_code&redirect_uri=http://localhost:8000/auth/vk/callback&code=ВАШ_КОД"
```

## Важные моменты

- ✅ Используйте отдельный VK аккаунт для "бота"
- ✅ Токен должен иметь права: `channel:stream:settings`
- ✅ Токен действует ограниченное время (обычно 24 часа)
- ✅ Для продления используйте refresh_token

## Проверка токена

После получения токена проверьте его работу:
```bash
curl -H "Authorization: Bearer ВАШ_ТОКЕН" \
  https://apidev.live.vkvideo.ru/v1/current_user
```

Если получили данные пользователя - токен работает! 🎉
