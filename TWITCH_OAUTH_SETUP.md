# 🔧 Настройка Twitch OAuth - Инструкция

## 📋 Необходимые переменные окружения

Добавьте в ваш `.env` файл следующие переменные:

```env
# Twitch OAuth настройки
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here
TWITCH_REDIRECT_URI=http://localhost:8000/api/auth/twitch/callback

# Bot Service настройки
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173

# TTS Service настройки
TTS_SERVICE_URL=http://localhost:8001
```

## 🎯 Создание Twitch приложения

1. **Перейдите на** [Twitch Developer Console](https://dev.twitch.tv/console)
2. **Войдите** в свой аккаунт Twitch
3. **Нажмите "Create"** для создания нового приложения
4. **Заполните форму:**
   - **Name:** TTS_TTV_App (или любое другое имя)
   - **OAuth Redirect URLs:** `http://localhost:8000/api/auth/twitch/callback`
   - **Category:** Application Integration
   - **Client Type:** Confidential

5. **Скопируйте:**
   - **Client ID** → `TWITCH_CLIENT_ID`
   - **Client Secret** → `TWITCH_CLIENT_SECRET`

## 🔧 Настройка OAuth Scopes

Приложение запрашивает следующие разрешения:
- `user:read:email` - для получения email пользователя

## 🚀 Запуск системы

1. **Убедитесь, что все сервисы запущены:**
   ```bash
   # Bot Service (порт 8000)
   cd bot-service
   python main.py
   
   # TTS Service (порт 8001)
   cd tts-service
   python main.py
   
   # Frontend (порт 5173)
   cd frontend
   npm run dev
   ```

2. **Откройте браузер** и перейдите на `http://localhost:5173`

3. **Нажмите "Войти через Twitch"**

4. **Разрешите доступ** в окне Twitch OAuth

5. **Вы будете перенаправлены** обратно в приложение

## 🧪 Тестирование

### Тест 1: Полная авторизация
1. Откройте `http://localhost:5173`
2. Нажмите "Войти через Twitch"
3. Войдите в свой аккаунт Twitch
4. Разрешите доступ приложению
5. Проверьте, что вы попали в дашборд
6. Проверьте, что в консоли браузера видны данные пользователя

### Тест 2: Гостевой режим
1. Очистите localStorage: `localStorage.clear()`
2. Обновите страницу
3. Нажмите "Без авторизации"
4. Проверьте, что вы попали в дашборд

### Тест 3: Logout
1. Нажмите "Выйти" в интерфейсе
2. Проверьте, что вы вернулись на страницу входа
3. Проверьте, что нет автоматических редиректов

## 🔍 Отладка

### Проверка переменных окружения
```bash
# В bot-service
echo $TWITCH_CLIENT_ID
echo $TWITCH_CLIENT_SECRET
```

### Проверка логов
```bash
# Bot Service логи
tail -f bot-service.log

# TTS Service логи  
tail -f tts-service.log
```

### Проверка в браузере
1. Откройте DevTools (F12)
2. Перейдите на вкладку Network
3. Попробуйте авторизацию
4. Проверьте запросы к `/api/auth/twitch/login` и `/api/auth/twitch/callback`

## ❌ Возможные проблемы

### 1. "TWITCH_CLIENT_ID не настроен"
- Проверьте, что переменная `TWITCH_CLIENT_ID` установлена в `.env` файле
- Перезапустите bot-service

### 2. "Неверный redirect_uri"
- Убедитесь, что в Twitch приложении указан правильный redirect URI
- Проверьте, что `TWITCH_REDIRECT_URI` в `.env` совпадает с настройками в Twitch

### 3. "Не авторизован" после входа
- Проверьте, что cookies устанавливаются правильно
- Убедитесь, что CORS настроен корректно

### 4. Бесконечный цикл авторизации
- Очистите localStorage: `localStorage.clear()`
- Очистите cookies в браузере
- Перезапустите все сервисы

## 📊 Структура авторизации

```
1. Пользователь нажимает "Войти через Twitch"
2. Frontend перенаправляет на /api/auth/twitch/login
3. Bot Service перенаправляет на Twitch OAuth
4. Пользователь авторизуется в Twitch
5. Twitch перенаправляет на /api/auth/twitch/callback
6. Bot Service обменивает код на токен
7. Bot Service получает данные пользователя
8. Bot Service устанавливает cookies и перенаправляет на frontend
9. Frontend получает данные и сохраняет в localStorage
10. Пользователь попадает в дашборд
```

## 🎉 Готово!

После настройки у вас будет полноценная авторизация через Twitch с возможностью работы в гостевом режиме.
