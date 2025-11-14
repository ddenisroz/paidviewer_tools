# Чеклист финального тестирования

**Дата:** 15 ноября 2025  
**Версия:** 0.03  
**Статус:** Готов к тестированию

---

## Подготовка к тестированию

### 1. Environment Setup

#### Backend (.env)
```bash
cd bot_service
cp .env.example .env
```

**Обязательные переменные:**
- [ ] `SECRET_KEY` - сгенерировать: `openssl rand -hex 32`
- [ ] `TOKEN_ENCRYPTION_KEY` - сгенерировать: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- [ ] `DATABASE_URL` - путь к БД
- [ ] `TWITCH_CLIENT_ID` - из Twitch Dev Console
- [ ] `TWITCH_CLIENT_SECRET` - из Twitch Dev Console
- [ ] `VK_CLIENT_ID` - из VK Apps
- [ ] `VK_CLIENT_SECRET` - из VK Apps

**Опциональные переменные:**
- [ ] `YOUTUBE_API_KEY` - для YouTube функций
- [ ] `DONATIONALERTS_CLIENT_ID` - для DonationAlerts
- [ ] `DONATIONALERTS_CLIENT_SECRET` - для DonationAlerts
- [ ] `GOOGLE_TTS_API_KEY` - для Google TTS

#### Frontend (.env)
```bash
cd frontend
cp .env.example .env
```

**Обязательные переменные:**
- [ ] `VITE_BOT_SERVICE_URL=http://localhost:8000`
- [ ] `VITE_TTS_SERVICE_URL=http://localhost:8001`
- [ ] `VITE_BOT_SERVICE_WS_URL=ws://localhost:8000`
- [ ] `VITE_FRONTEND_URL=http://localhost:5173`

### 2. Dependencies

#### Backend
```bash
cd bot_service
pip install -r requirements.txt
```

#### Frontend
```bash
cd frontend
npm install
```

### 3. Database

```bash
cd bot_service
alembic upgrade head
```

---

## Тестирование конфигурации

### ✅ Config Tests

```bash
cd bot_service
pytest tests/test_config.py -v
pytest tests/test_config_modern.py -v
pytest tests/test_configuration_system.py -v
```

**Ожидаемый результат:**
- [ ] Все тесты проходят
- [ ] Валидация работает
- [ ] Production checks активны

---

## Функциональное тестирование

### 1. Запуск сервисов

#### Backend
```bash
cd bot_service
python main.py
```

**Проверить:**
- [ ] Сервис запустился на порту 8000
- [ ] Нет ошибок в логах
- [ ] Конфигурация загрузилась
- [ ] База данных подключена

#### Frontend
```bash
cd frontend
npm run dev
```

**Проверить:**
- [ ] Сервис запустился на порту 5173
- [ ] Нет ошибок в консоли
- [ ] Страница загружается

### 2. Авторизация

#### Twitch OAuth
- [ ] Открыть http://localhost:5173
- [ ] Нажать "Войти через Twitch"
- [ ] Авторизоваться на Twitch
- [ ] Редирект обратно на сайт
- [ ] Пользователь авторизован
- [ ] Токен сохранен в БД (encrypted)

#### VK OAuth
- [ ] Нажать "Войти через VK"
- [ ] Авторизоваться на VK Live
- [ ] Редирект обратно на сайт
- [ ] Пользователь авторизован
- [ ] Токен сохранен в БД (encrypted)

### 3. TTS Система

#### Базовая функциональность
- [ ] Открыть страницу TTS
- [ ] Включить TTS toggle
- [ ] Выбрать платформу (Twitch/VK)
- [ ] Написать сообщение в чат
- [ ] TTS озвучивает сообщение
- [ ] Аудио воспроизводится

#### Настройки TTS
- [ ] Изменить громкость
- [ ] Изменить скорость
- [ ] Выбрать голос
- [ ] Добавить фильтр слов
- [ ] Добавить заблокированного пользователя
- [ ] Настройки сохраняются

#### Platform Toggles
- [ ] Включить Twitch TTS
- [ ] Включить VK TTS
- [ ] Отключить Twitch TTS
- [ ] Отключить VK TTS
- [ ] Синхронизация работает

### 4. Chat Система

#### Отображение сообщений
- [ ] Сообщения из Twitch отображаются
- [ ] Сообщения из VK отображаются
- [ ] Бейджи отображаются корректно
- [ ] Цвета пользователей работают
- [ ] Автоскролл работает

#### Фильтрация
- [ ] Фильтр по платформе (Twitch)
- [ ] Фильтр по платформе (VK)
- [ ] Фильтр "Все платформы"
- [ ] Поиск по сообщениям

### 5. WebSocket

#### Соединение
- [ ] WebSocket подключается автоматически
- [ ] Leader Election работает (только 1 соединение на браузер)
- [ ] Heartbeat работает (ping/pong)
- [ ] Reconnection работает при разрыве
- [ ] Exponential backoff работает

#### Синхронизация
- [ ] Открыть 2 вкладки
- [ ] Только 1 WebSocket соединение
- [ ] Сообщения приходят в обе вкладки
- [ ] Настройки синхронизируются

### 6. Drops Система

#### Lootbox
- [ ] Открыть страницу Drops
- [ ] Настроить вероятности
- [ ] Крутить лутбокс
- [ ] Результат рассчитывается на backend
- [ ] Анимация показывает результат
- [ ] Результат сохраняется в БД

#### Streaks
- [ ] Включить стрики для Twitch
- [ ] Включить стрики для VK
- [ ] Настроить награды
- [ ] Стрики начисляются
- [ ] История стриков сохраняется

#### Donation Drops
- [ ] Подключить DonationAlerts
- [ ] Включить donation drops
- [ ] Настроить награды
- [ ] Донаты триггерят drops
- [ ] История сохраняется

### 7. YouTube Заказы

#### Добавление видео
- [ ] Открыть страницу YouTube
- [ ] Вставить ссылку на видео
- [ ] Видео добавляется в очередь
- [ ] Превью отображается
- [ ] Информация корректна

#### Управление очередью
- [ ] Удалить видео
- [ ] Изменить порядок
- [ ] Воспроизвести видео
- [ ] Пауза/продолжить
- [ ] Следующее видео

### 8. Админ Панель

#### Управление пользователями
- [ ] Открыть админ панель
- [ ] Список пользователей загружается
- [ ] Pagination работает
- [ ] Поиск работает
- [ ] Блокировка пользователя
- [ ] Разблокировка пользователя

#### Управление голосами
- [ ] Список голосов загружается
- [ ] Загрузить новый голос
- [ ] Установить голос по умолчанию
- [ ] Удалить голос
- [ ] Голоса доступны пользователям

### 9. OBS Виджеты

#### Chat Widget
- [ ] Скопировать URL виджета
- [ ] Добавить в OBS как Browser Source
- [ ] Сообщения отображаются
- [ ] Стили применяются
- [ ] Анимации работают

#### TTS Widget
- [ ] Скопировать URL виджета
- [ ] Добавить в OBS
- [ ] TTS сообщения отображаются
- [ ] Аудио воспроизводится

#### Drops Widget
- [ ] Скопировать URL виджета
- [ ] Добавить в OBS
- [ ] Drops анимация работает
- [ ] Результаты отображаются

---

## Performance Testing

### Load Time
- [ ] Initial load < 3 seconds
- [ ] API response < 100ms
- [ ] WebSocket connection < 1 second

### Resource Usage
- [ ] Memory usage < 500MB (backend)
- [ ] Memory usage < 200MB (frontend)
- [ ] CPU usage < 50% (idle)

### Optimization
- [ ] Code splitting работает
- [ ] Lazy loading работает
- [ ] Virtualization работает (ChatCard)
- [ ] Database queries оптимизированы

---

## Security Testing

### Authentication
- [ ] JWT токены работают
- [ ] OAuth tokens encrypted в БД
- [ ] Session management работает
- [ ] Logout работает корректно

### Authorization
- [ ] Admin endpoints защищены
- [ ] User endpoints защищены
- [ ] Guest mode работает
- [ ] Permission checks работают

### Rate Limiting
- [ ] Rate limiting активен
- [ ] Login rate limit работает (5/15min)
- [ ] API rate limit работает (60/min)
- [ ] TTS rate limit работает (30/min)

### Input Validation
- [ ] XSS protection работает
- [ ] SQL injection protection работает
- [ ] Input sanitization работает
- [ ] Validation errors отображаются

---

## Error Handling

### Frontend
- [ ] Error boundaries ловят ошибки
- [ ] API errors отображаются пользователю
- [ ] Retry logic работает
- [ ] Fallback UI отображается

### Backend
- [ ] Unhandled exceptions логируются
- [ ] HTTP exceptions обрабатываются
- [ ] Validation errors возвращаются
- [ ] 500 errors не крашат сервис

### WebSocket
- [ ] Reconnection при разрыве
- [ ] Exponential backoff работает
- [ ] Max attempts работает
- [ ] Error messages отображаются

---

## Integration Testing

### Twitch Integration
- [ ] OAuth flow работает
- [ ] Chat messages приходят
- [ ] Commands работают
- [ ] Badges отображаются
- [ ] Channel points работают

### VK Integration
- [ ] OAuth flow работает
- [ ] Chat messages приходят
- [ ] Commands работают
- [ ] Channel points работают
- [ ] Stream info обновляется

### DonationAlerts
- [ ] OAuth flow работает
- [ ] Donations приходят
- [ ] Drops триггерятся
- [ ] История сохраняется

### YouTube
- [ ] API key работает
- [ ] Видео загружаются
- [ ] Proxy работает
- [ ] Плеер работает

---

## Regression Testing

### Protected Systems
- [ ] TTS система работает (DO_NOT_TOUCH.md)
- [ ] Category система работает
- [ ] WebSocket Leader Election работает
- [ ] Performance optimizations работают
- [ ] Error handling работает
- [ ] Drops calculation работает
- [ ] Configuration система работает

---

## Production Readiness

### Configuration
- [ ] Все environment variables заполнены
- [ ] Секреты сгенерированы
- [ ] Production checks проходят
- [ ] CORS настроен
- [ ] Database URL корректен

### Deployment
- [ ] Docker Compose файлы готовы
- [ ] Nginx конфигурация готова
- [ ] SSL certificates настроены
- [ ] Backup strategy определена
- [ ] Monitoring настроен

### Documentation
- [ ] README актуален
- [ ] DEPLOYMENT.md актуален
- [ ] API documentation актуальна
- [ ] Environment variables документированы

---

## Результаты тестирования

### Критические проблемы (блокеры)
- [ ] Нет критических проблем

### Важные проблемы
- [ ] Нет важных проблем

### Средние проблемы
- [ ] Нет средних проблем

### Низкие проблемы
- [ ] Нет низких проблем

---

## Финальное решение

- [ ] ✅ Все тесты пройдены
- [ ] ✅ Нет критических проблем
- [ ] ✅ Документация актуальна
- [ ] ✅ Готов к production deployment

**Подпись тестировщика:** _________________  
**Дата:** _________________

---

**Статус:** Готов к тестированию  
**Версия:** 0.03  
**Дата создания:** 15 ноября 2025

