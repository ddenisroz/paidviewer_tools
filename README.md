# TTS Bot Service

Многофункциональный сервис для интеграции Text-to-Speech (TTS) с платформами Twitch и VK Live.

## 🚀 Возможности

### Основные функции
- **Text-to-Speech**: Преобразование текста в речь с поддержкой множества голосов
- **Мультиплатформенность**: Интеграция с Twitch и VK Live
- **Управление голосами**: Загрузка и управление пользовательскими голосами
- **Админ панель**: Полнофункциональная панель управления
- **Система ролей**: Контроль доступа и прав пользователей
- **Очередь сообщений**: Управление очередью TTS запросов
- **Интеграция с YouTube**: Автоматическое добавление видео в очередь

### Технические особенности
- **Микросервисная архитектура**: Разделение на Bot Service и TTS Service
- **WebSocket соединения**: Реальное время для чата и уведомлений
- **База данных**: SQLite с миграциями Alembic
- **REST API**: Полнофункциональное API для всех операций
- **Логирование**: Детальное логирование всех операций
- **Docker поддержка**: Готовые конфигурации для развертывания

## 🏗️ Архитектура

```
├── bot_service/          # Основной сервис ботов
│   ├── bots/            # Боты для Twitch и VK Live
│   ├── api/             # REST API endpoints
│   ├── auth/            # Система аутентификации
│   ├── core/            # Основная логика
│   ├── services/        # Бизнес-логика
│   └── models/          # Модели данных
├── tts_service/         # TTS сервис
│   ├── TTS_rus_engine/  # Русский TTS движок
│   ├── voices/          # Голосовые модели
│   └── audio/           # Аудио файлы
├── frontend/            # React фронтенд
│   ├── src/
│   │   ├── components/  # UI компоненты
│   │   ├── pages/       # Страницы
│   │   ├── context/     # React контекст
│   │   └── services/    # API сервисы
└── VK_live_docs/        # Документация VK Live API
```

## 🛠️ Установка и запуск

### Предварительные требования
- Python 3.8+
- Node.js 16+
- Git

### 1. Клонирование репозитория
```bash
git clone https://github.com/ddenisroz/twitch-tts-bot.git
cd twitch-tts-bot
```

### 2. Настройка окружения

#### Bot Service
```bash
cd bot_service
cp env.example .env
# Отредактируйте .env файл с вашими настройками
pip install -r requirements.txt
```

#### TTS Service
```bash
cd tts_service
pip install -r requirements.txt
```

#### Frontend
```bash
cd frontend
npm install
```

### 3. Настройка переменных окружения

#### bot_service/.env
```env
# Основные настройки
LOG_LEVEL=INFO
ADMIN_USERS=your_username,admin_username

# Twitch настройки
TWITCH_BOT_TOKEN=your_twitch_bot_token
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# VK Live настройки
VK_ACCESS_TOKEN=your_vk_access_token
VK_GROUP_ID=your_vk_group_id

# База данных
DATABASE_URL=sqlite:///./data/app_data.db

# TTS Service
TTS_SERVICE_URL=http://localhost:8001
```

#### frontend/.env
```env
VITE_API_URL=http://localhost:8000
VITE_TTS_URL=http://localhost:8001
```

### 4. Запуск сервисов

#### Автоматический запуск (Windows)
```bash
start_microservices.bat
```

#### Ручной запуск
```bash
# Terminal 1 - Bot Service
cd bot_service
python main.py

# Terminal 2 - TTS Service
cd tts_service
python main.py

# Terminal 3 - Frontend
cd frontend
npm run dev
```

## 📖 Использование

### Админ панель
Доступна по адресу: `http://localhost:5173/dashboard/dolbaebadmintts`

**Возможности:**
- **TTS whitelist**: Управление разрешенными каналами
- **Управление голосами**: Загрузка и настройка голосов
- **Управление пользователями**: Контроль доступа
- **Управление ботами**: Перезапуск сервисов
- **Сессии**: Мониторинг активных пользователей
- **Логи**: Просмотр системных логов

### API Endpoints

#### Bot Service (порт 8000)
- `GET /api/auth/status` - Статус аутентификации
- `POST /api/auth/login` - Вход в систему
- `GET /api/admin/sessions` - Список активных сессий
- `POST /api/admin/bot-service/restart` - Перезапуск Bot Service
- `POST /api/admin/tts/restart` - Перезапуск TTS движка

#### TTS Service (порт 8001)
- `POST /api/tts/synthesize` - Синтез речи
- `GET /api/tts/voices` - Список доступных голосов
- `POST /api/tts/restart` - Перезапуск TTS движка

### Команды ботов

#### Twitch
- `!tts <текст>` - Синтез речи
- `!skip` - Пропустить текущее сообщение
- `!queue` - Показать очередь
- `!volume <1-100>` - Установить громкость

#### VK Live
- `!ттс <текст>` - Синтез речи
- `!пропустить` - Пропустить текущее сообщение
- `!очередь` - Показать очередь
- `!громкость <1-100>` - Установить громкость

## 🔧 Разработка

### Структура проекта
- **Backend**: FastAPI + SQLAlchemy + Alembic
- **Frontend**: React + Vite + Tailwind CSS
- **TTS**: F5-TTS + Vocos
- **Боты**: TwitchIO + VK Live API

### Миграции базы данных
```bash
cd bot_service
alembic upgrade head
```

### Логирование
Логи сохраняются в:
- `bot_service/logs/bot_service.log`
- `tts_service/logs/tts_service.log`

## 📚 Документация

- [VK Live API](VK_live_docs/) - Полная документация VK Live API
- [Настройка VK Live](VK_LIVE_BOT_SETUP.md)
- [Команды VK Live](VK_LIVE_COMMANDS_GUIDE.md)
- [Исправления VK Live](VK_LIVE_API_FIXES.md)
- [Руководство по токенам](VK_TOKEN_GUIDE.md)

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT.

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи сервисов
2. Убедитесь в правильности настроек .env
3. Проверьте доступность портов 8000 и 8001
4. Создайте Issue в репозитории

---

**Версия**: 0.02  
**Последнее обновление**: 2025-09-27