# 🎤 TTS_TTV - AI-Powered Twitch TTS System

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Современная система озвучки чата для Twitch стримеров с использованием искусственного интеллекта. Поддерживает загрузку кастомных голосов, управление через веб-интерфейс и интеграцию с OBS.

## ✨ Основные возможности

### 🎯 **TTS (Text-to-Speech)**
- **AI-озвучка** с использованием F5-TTS
- **Кастомные голоса** - загружайте свои аудиофайлы
- **Глобальные голоса** - предустановленные варианты
- **Настройка параметров** - CFG strength, скорость, температура
- **Автоматическая транскрипция** - Whisper для анализа аудио

### 🤖 **Bot Management**
- **Автоматическое подключение** к каналам
- **Гостевой режим** - тестирование без авторизации
- **Whitelist система** - контроль доступа
- **WebSocket соединения** - реальное время
- **Команды чата** - управление через !команды

### 🌐 **Web Interface**
- **Современный UI** на React + Tailwind CSS
- **Адаптивный дизайн** - работает на всех устройствах
- **Темная тема** - комфорт для глаз
- **Real-time обновления** - мгновенная синхронизация

### 📊 **Analytics & Management**
- **Статистика стрима** - зрители, категории, история
- **Управление каналом** - смена названия и категории
- **Админ панель** - управление пользователями
- **Логирование** - детальная диагностика

## 🏗️ Архитектура

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Bot Service   │    │   TTS Service   │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (FastAPI)     │
│   Port: 5173    │    │   Port: 8000    │    │   Port: 8001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   SQLite DB     │    │   AI Models     │
│   Real-time     │    │   Data Storage  │    │   F5-TTS Cache  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔧 **Микросервисы**

#### **Bot Service** (`bot_service/`)
- **WebSocket сервер** - реальное время
- **Twitch API интеграция** - стримы, категории, пользователи
- **Аутентификация** - OAuth2 + JWT
- **Управление ботами** - подключение/отключение
- **YouTube интеграция** - очередь видео

#### **TTS Service** (`tts_service/`)
- **AI синтез речи** - F5-TTS + русская модель
- **Управление голосами** - загрузка, настройка, удаление
- **Аудио конвертация** - поддержка всех форматов
- **Транскрипция** - Whisper для анализа
- **Кэширование** - оптимизация производительности

#### **Frontend** (`frontend/`)
- **React SPA** - современный интерфейс
- **Context API** - управление состоянием
- **Tailwind CSS** - стилизация
- **Vite** - быстрая сборка
- **Responsive** - адаптивный дизайн

## 🚀 Быстрый старт

### **1. Клонирование репозитория**
```bash
git clone https://github.com/yourusername/tts_ttv.git
cd tts_ttv
```

### **2. Установка зависимостей**

#### **Python (Backend)**
```bash
# Создание виртуального окружения
python -m venv .venv

# Активация (Windows)
.venv\Scripts\activate

# Активация (Linux/Mac)
source .venv/bin/activate

# Установка зависимостей
pip install -r bot_service/requirements.txt
pip install -r tts_service/requirements.txt
```

#### **Node.js (Frontend)**
```bash
cd frontend
npm install
cd ..
```

### **3. Конфигурация**

#### **Создание .env файла**
```bash
# Копируем пример конфигурации
cp test.env.example .env

# Редактируем конфигурацию
notepad .env  # Windows
nano .env     # Linux/Mac
```

#### **Настройка Twitch API**
1. **Twitch App**: [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
   - Получите `TWITCH_CLIENT_ID` и `TWITCH_CLIENT_SECRET`
2. **Bot Token**: [twitchapps.com/tmi/](https://twitchapps.com/tmi/)
   - Получите `TWITCH_BOT_TOKEN`
3. **Сгенерируйте JWT секрет**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
4. **Заполните основные настройки в .env**:
```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_BOT_TOKEN=oauth:your_bot_token
SECRET_KEY=your_generated_jwt_secret
ADMIN_USERS=your_twitch_username
```

### **4. Запуск системы**

#### **Автоматический запуск (рекомендуется)**
```bash
# Windows
start_microservices.bat

# PowerShell
.\start_microservices.ps1
```

#### **Ручной запуск**
```bash
# Терминал 1 - TTS Service
cd tts_service
python main.py

# Терминал 2 - Bot Service  
cd bot_service
python main.py

# Терминал 3 - Frontend
cd frontend
npm run dev
```

### **5. Проверка работы**
- **Frontend**: http://localhost:5173
- **Bot API**: http://localhost:8000/docs
- **TTS API**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/health

## 📖 Использование

### **🎤 Настройка TTS**

1. **Загрузка голоса**:
   - Перейдите в "Управление голосами"
   - Нажмите "Загрузить голос"
   - Выберите аудиофайл (WAV, MP3, M4A, AAC)
   - Дождитесь конвертации и транскрипции

2. **Настройка параметров**:
   - **CFG Strength**: качество синтеза (2.0 - рекомендуемое)
   - **Скорость**: slow/normal/fast
   - **Температура**: креативность (0.1-2.0)
   - **Top-p/Top-k**: разнообразие

3. **Тестирование**:
   - Введите текст для озвучки
   - Нажмите "Тестировать"
   - Слушайте результат

### **🤖 Управление ботом**

1. **Авторизация**:
   - Нажмите "Войти через Twitch"
   - Разрешите доступ к каналу
   - Бот автоматически подключится

2. **Гостевой режим**:
   - Введите название канала
   - Нажмите "Войти как гость"
   - Проверьте whitelist статус

3. **Команды чата**:
   - `!tts` - включить/выключить TTS
   - `!queue` - показать очередь видео
   - `!next` - следующее видео
   - `!add <url>` - добавить видео
   - `!clear` - очистить очередь
   - `!help` - список команд

### **📊 Аналитика**

1. **Статистика стрима**:
   - График зрителей в реальном времени
   - История просмотров
   - Текущий статус

2. **Управление каналом**:
   - Смена названия стрима
   - Смена категории
   - Поиск категорий

## 🔧 Конфигурация

### **Переменные окружения**

#### **Основные (обязательно)**
| Переменная | Описание | Где получить |
|------------|----------|--------------|
| `TWITCH_CLIENT_ID` | ID приложения Twitch | [dev.twitch.tv](https://dev.twitch.tv/console/apps) |
| `TWITCH_CLIENT_SECRET` | Секрет приложения | [dev.twitch.tv](https://dev.twitch.tv/console/apps) |
| `TWITCH_BOT_TOKEN` | Токен бота | [twitchapps.com/tmi](https://twitchapps.com/tmi/) |
| `SECRET_KEY` | JWT секрет (32+ символов) | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `ADMIN_USERS` | Админы (логины через запятую) | Ваш Twitch логин |
| `TTS_SERVICE_URL` | URL TTS сервиса | `http://localhost:8001` |

#### **Опциональные**
| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `BOT_PREFIX` | Префикс команд бота | `!` |
| `MAX_MESSAGE_LENGTH` | Максимальная длина сообщения | `350` |
| `MESSAGE_COOLDOWN` | Задержка между сообщениями (сек) | `1` |
| `TTS_TIMEOUT` | Таймаут TTS запросов (сек) | `30` |
| `LOG_LEVEL` | Уровень логирования | `INFO` |
| `TEST_MODE` | Режим тестирования | `false` |

### **Настройки TTS**

```python
# tts_service/config.py
cfg_strength = 2.0          # Качество синтеза
speed_preset = 'normal'     # Скорость речи
cross_fade_duration = 0.15  # Плавность переходов
silence_duration = 0.0      # Паузы между словами
temperature = 1.0           # Креативность
top_p = 0.9                 # Разнообразие
top_k = 50                  # Ограничение выбора
```

## 🛠️ Разработка

### **Структура проекта**

```
TTS_TTV_0.02/
├── bot_service/           # Bot микросервис
│   ├── main.py           # FastAPI приложение
│   ├── models.py         # Pydantic модели
│   ├── auth.py           # Аутентификация
│   ├── twitch_api.py     # Twitch API
│   ├── tts_api.py        # TTS API
│   ├── youtube_api.py    # YouTube API
│   ├── admin_api.py      # Админ функции
│   ├── bot.py            # Bot логика
│   ├── connection_manager.py # WebSocket
│   └── database.py       # База данных
├── tts_service/          # TTS микросервис
│   ├── main.py           # FastAPI приложение
│   ├── models.py         # Pydantic модели
│   ├── tts_engine.py     # TTS движок
│   ├── file_manager.py   # Управление файлами
│   ├── api_endpoints.py  # API эндпоинты
│   ├── background_tasks.py # Фоновые задачи
│   ├── audio_converter.py # Конвертация аудио
│   └── TTS_rus_engine/   # Русская TTS модель
├── frontend/             # React приложение
│   ├── src/
│   │   ├── components/   # React компоненты
│   │   ├── context/      # Context API
│   │   ├── pages/        # Страницы
│   │   ├── services/     # API сервисы
│   │   └── hooks/        # Custom hooks
│   └── package.json
└── README.md
```

### **API Документация**

#### **Bot Service** (http://localhost:8000/docs)
- `POST /api/chat/connect` - подключить бота
- `POST /api/chat/disconnect` - отключить бота
- `GET /api/chat/status` - статус бота
- `GET /api/twitch/stream` - информация о стриме
- `POST /api/twitch/title` - изменить название
- `POST /api/twitch/category` - изменить категорию
- `GET /api/active-channels` - активные каналы

#### **TTS Service** (http://localhost:8001/docs)
- `POST /api/tts/synthesize` - синтез речи
- `POST /api/voices/upload` - загрузка голоса
- `GET /api/voices` - список голосов
- `PUT /api/voices/{id}/settings` - настройки голоса
- `POST /api/voices/{id}/test` - тестирование
- `POST /api/voices/{id}/transcribe` - транскрипция

### **Логирование**

#### **Файлы логов**
Логи сохраняются в папке `logs/`:
- `bot_service.log` - логи бота и API
- `tts_service.log` - логи TTS и AI моделей

#### **Утилита просмотра логов**
```bash
# Показать список файлов логов
python view_logs.py --list

# Просмотр логов бота (последние 50 строк)
python view_logs.py -f bot_service.log

# Следить за логами в реальном времени
python view_logs.py -f bot_service.log --follow

# Поиск в логах
python view_logs.py --search "ERROR"

# Статистика логов
python view_logs.py --stats

# Windows батник
view_logs.bat
```

#### **Уровни логирования**
- `INFO` - общая информация
- `WARNING` - предупреждения  
- `ERROR` - ошибки
- `DEBUG` - отладочная информация

#### **Типы событий**
- 🌐 **API** - HTTP запросы и ответы
- 🔌 **WebSocket** - соединения и события
- 🤖 **BOT** - действия бота и команды
- 🎤 **TTS** - синтез речи и голоса
- ❌ **ERROR** - ошибки с контекстом

## 🐛 Устранение неполадок

### **Частые проблемы**

1. **"TTS engine not ready"**
   - Проверьте, что TTS сервис запущен
   - Убедитесь, что модели загружены
   - Проверьте логи в `tts_service/logs/`

2. **"Bot not connected"**
   - Проверьте токен бота в `.env`
   - Убедитесь, что канал в whitelist
   - Проверьте логи в `bot_service/logs/`

3. **"Voice upload failed"**
   - Проверьте формат аудио (WAV, MP3, M4A, AAC)
   - Убедитесь, что файл не поврежден
   - Проверьте размер файла (< 50MB)

4. **"WebSocket connection failed"**
   - Проверьте, что порты свободны
   - Убедитесь, что CORS настроен правильно
   - Проверьте firewall настройки

### **Диагностика**

```bash
# Проверка статуса сервисов
curl http://localhost:8001/health
curl http://localhost:8000/health

# Проверка логов
tail -f bot_service/logs/bot_service.log
tail -f tts_service/logs/tts_service.log

# Проверка портов
netstat -an | findstr :8000
netstat -an | findstr :8001
netstat -an | findstr :5173
```

## 📝 Changelog

### **v2.0.0** - Major Refactoring
- ✅ Полный рефакторинг архитектуры
- ✅ Разделение на микросервисы
- ✅ Модульная структура кода
- ✅ Улучшенная документация
- ✅ Оптимизация производительности

### **v1.0.0** - Initial Release
- 🎤 Базовая TTS функциональность
- 🤖 Twitch бот интеграция
- 🌐 Веб интерфейс
- 📊 Аналитика стрима

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 👥 Авторы

- **Your Name** - *Initial work* - [YourGitHub](https://github.com/yourusername)

## 🙏 Благодарности

- [F5-TTS](https://github.com/SWivid/F5-TTS) - за отличную TTS модель
- [TwitchIO](https://github.com/TwitchIO/TwitchIO) - за Python библиотеку для Twitch
- [FastAPI](https://fastapi.tiangolo.com/) - за быстрый веб фреймворк
- [React](https://reactjs.org/) - за отличную UI библиотеку

## 📞 Поддержка

Если у вас есть вопросы или проблемы:

1. Проверьте [Issues](https://github.com/yourusername/tts_ttv/issues)
2. Создайте новый Issue с подробным описанием
3. Приложите логи и скриншоты

---

**⭐ Если проект вам понравился, поставьте звезду!**