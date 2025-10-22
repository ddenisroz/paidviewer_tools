# TTS_TTV_0.02 - Мультиплатформенная TTS система для стримеров

## 🎯 Описание проекта

Комплексная система текстового озвучивания (TTS) для стримеров, поддерживающая Twitch и VK Live. Включает в себя чат-ботов, управление голосами, систему команд, анализ чата и интеграцию с OBS.

## ✨ Основные возможности

### 🎤 TTS (Text-to-Speech)
- **F5-TTS Engine** - современный движок для генерации речи
- **Управление голосами** - создание, настройка и тестирование голосов
- **Глобальные голоса** - общие голоса для всех пользователей
- **Пользовательские голоса** - индивидуальные настройки
- **Автотранскрипция** - автоматическое преобразование текста
- **Упрощенная система пользователей** - только ID, без лишних полей

### 💬 Чат-боты
- **Twitch Bot** - интеграция с Twitch IRC API
- **VK Live Bot** - интеграция с VK Live API
- **Управление командами** - создание и настройка команд
- **Система ролей** - разграничение доступа к командам
- **Фильтрация контента** - блокировка нежелательных слов

### 🎮 Чат для OBS
- **Twitch Chat** - отображение чата Twitch в OBS
- **VK Live Chat** - отображение чата VK Live в OBS
- **Объединенный чат** - слияние двух чатов в один
- **Настройка внешнего вида** - CSS, шрифты, цвета
- **Экспорт** - URL для Browser Source или HTML файлы

### 🎁 Система Drops
- **Streak Drops** - награды за ежедневное посещение
- **Donation Drops** - награды за донаты
- **Mythical Drops** - редкие случайные награды
- **Управление наградами** - создание и настройка наград
- **История Drops** - отслеживание выданных наград

### 🧠 AI Анализ
- **Психологический анализ** - профили пользователей
- **Анализ поведения** - паттерны активности
- **Временные анализы** - не сохраняются в БД
- **Интеграция с чатом** - анализ сообщений в реальном времени

### 🔧 Администрирование
- **Управление пользователями** - создание, редактирование, удаление, блокировка
- **Управление сессиями** - просмотр активных подключений с каналами Twitch/VK
- **Управление голосами** - создание, настройка и тестирование TTS голосов
- **Whitelist каналов** - управление разрешенными каналами
- **Заблокированные каналы** - управление блокировками
- **Мониторинг системы** - состояние сервисов (заглушки)
- **Очистка базы данных** - удаление старых данных

## 🏗️ Архитектура

### Backend (FastAPI)
```
bot_service/
├── main.py                 # Точка входа
├── core/
│   ├── database.py        # Модели базы данных
│   └── security.py        # Безопасность
├── api/                   # API endpoints
├── services/              # Бизнес-логика
├── bots/                  # Чат-боты
└── auth/                  # Аутентификация
```

### Frontend (React + Vite)
```
frontend/
├── src/
│   ├── pages/             # Страницы приложения
│   ├── components/        # React компоненты
│   ├── context/           # React Context
│   └── services/          # API клиенты
```

### TTS Service (Python)
```
tts_service/
├── main.py               # TTS сервис
├── tts_engine.py         # Движок TTS
├── TTS_rus_engine/       # Русский TTS
└── f5_tts_cache/         # Кэш моделей
```

## 🚀 Установка и запуск

### Требования
- Python 3.8+
- Node.js 16+
- SQLite
- Docker (опционально)

### Backend
```bash
cd bot_service
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### TTS Service
```bash
cd tts_service
pip install -r requirements.txt
python main.py
```

### Docker
```bash
docker-compose up -d
```

## 📊 База данных

### Основные таблицы
- **users** - пользователи системы
- **bot_commands** - команды ботов
- **filtered_words** - фильтр слов
- **user_voices** - пользовательские голоса
- **global_voices** - глобальные голоса
- **drops_rewards** - награды Drops
- **drops_history** - история Drops
- **psychology_analyses** - психологические анализы

### Миграции
```bash
cd bot_service
alembic upgrade head
```

## 🔐 Безопасность

- **JWT токены** - аутентификация
- **OAuth 2.0** - интеграция с платформами
- **Rate Limiting** - защита от спама
- **XSS защита** - санитизация входных данных
- **CORS** - настройка кросс-доменных запросов
- **Валидация данных** - Pydantic модели

## 🎨 UI/UX

### Дизайн
- **Темная тема** - современный интерфейс
- **Адаптивность** - поддержка всех устройств
- **Компоненты** - переиспользуемые UI элементы
- **Анимации** - плавные переходы
- **Иконки** - Lucide React

### Навигация
- **Sidebar** - основное меню
- **Dashboard** - главная страница
- **TTS** - управление голосами
- **Команды** - настройка команд
- **Drops** - система наград
- **Админ** - административные функции
  - **TTS whitelist** - управление разрешенными каналами
  - **Голоса** - управление TTS голосами
  - **Пользователи** - управление пользователями и сессиями
  - **Боты** - управление ботами
  - **Тикеты** - система поддержки
  - **Мониторинг** - состояние системы

## 🔌 Интеграции

### Twitch
- **IRC API** - подключение к чату
- **REST API** - управление каналом
- **OAuth** - авторизация пользователей

### VK Live
- **REST API** - управление стримом
- **WebSocket** - реальное время
- **OAuth** - авторизация пользователей

### OBS
- **Browser Source** - встраивание TTS
- **WebSocket** - управление воспроизведением
- **URL параметры** - настройка отображения

## 📈 Мониторинг

### Логирование
- **Структурированные логи** - JSON формат
- **Уровни логирования** - DEBUG, INFO, WARNING, ERROR
- **Ротация логов** - автоматическая очистка
- **Контекстные логи** - дополнительная информация

### Метрики
- **Состояние сервисов** - здоровье системы
- **Производительность** - время отклика
- **Использование ресурсов** - память, CPU
- **Ошибки** - отслеживание проблем

## 🧪 Тестирование

### Backend
```bash
cd bot_service
python -m pytest tests/
```

### Frontend
```bash
cd frontend
npm run test
```

## 📦 Развертывание

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
    }
}
```

## 🤝 Участие в разработке

1. Fork проекта
2. Создайте feature branch
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT License - см. файл LICENSE

## 📚 Документация

Вся документация организована в папке [`docs/`](./docs/):

### 🚀 Быстрый старт
- [**Быстрая настройка**](./docs/setup/QUICK_SETUP_GUIDE.md) - Начните за 5 минут
- [**Быстрые команды**](./docs/setup/QUICK_COMMANDS.md) - Самые частые команды
- [**AI Setup**](./docs/setup/AI_SETUP_GUIDE.md) - Настройка TTS и AI

### 📖 Руководства
- [**Developer Guide**](./docs/guides/DEVELOPER_GUIDE.md) - Для разработчиков
- [**База данных**](./docs/guides/DATABASE_MANAGEMENT_README.md) - Управление БД
- [**Cleanup Guide**](./docs/guides/CLEANUP_GUIDE.md) - Очистка проекта
- [**VK Live Команды**](./docs/guides/VK_LIVE_COMMANDS_GUIDE.md) - Команды для VK

### 🚀 Deployment
- [**Production Deploy**](./docs/deployment/DEPLOYMENT.md) - Развертывание
- [**Development Setup**](./docs/deployment/DEVELOPMENT.md) - Настройка dev окружения

### 📊 Отчеты
- [**Project Summary**](./docs/reports/PROJECT_SUMMARY.md) - Краткое описание
- [**Optimization Report**](./docs/reports/OPTIMIZATION_REPORT.md) - Оптимизация
- [**Cleanup Report**](./docs/reports/CLEANUP_REPORT.md) - Отчет по очистке
- [**Testing Checklist**](./docs/reports/TESTING_CHECKLIST.md) - Чеклист тестирования

**📝 [Полный список документации →](./docs/README.md)**

---

## 🆘 Поддержка

- **Документация** - [`docs/`](./docs/)
- **Issues** - GitHub Issues
- **Discord** - [ссылка на сервер]

## 🎉 Благодарности

- **F5-TTS** - за отличный TTS движок
- **Twitch** - за API и документацию
- **VK** - за VK Live API
- **Сообщество** - за обратную связь и предложения

---

**Версия:** 0.02  
**Последнее обновление:** Октябрь 2025  
**Статус:** В активной разработке

---

## 🛠️ Утилитные скрипты

### Автоматическая очистка проекта
```bash
# Просмотр без удаления
python docs/scripts/cleanup_project.py --dry-run

# Полная очистка
python docs/scripts/cleanup_project.py
```

### Мониторинг
```bash
python docs/scripts/monitoring_viewer.py
```

### Deployment скрипты
```bash
# Развертывание
bash docs/scripts/deploy.sh

# Dev окружение
bash docs/scripts/dev-setup.sh

# Обновление
bash docs/scripts/update.sh
```

📚 **[Все скрипты →](./docs/scripts/)**