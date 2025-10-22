# 📁 Структура проекта TTS_TTV_0.02

Визуальное представление организации проекта после реорганизации.

---

## 🎯 Текущая структура (v2.0)

```
TTS_TTV_0.02/
│
├── 📂 bot_service/              # Backend сервис (FastAPI)
│   ├── main.py                  # Точка входа
│   ├── core/                    # Ядро системы
│   │   ├── database.py          # Модели БД
│   │   ├── security.py          # Безопасность
│   │   └── connection_manager.py # Менеджер соединений
│   ├── api/                     # API эндпоинты
│   │   ├── tts_api_endpoints.py
│   │   ├── points_api_endpoints.py
│   │   ├── twitch_api.py
│   │   └── vk_api.py
│   ├── bots/                    # Чат-боты
│   │   ├── base_bot.py          # Базовый класс
│   │   ├── twitch_bot.py        # Twitch бот
│   │   └── vk_live_bot.py       # VK Live бот
│   ├── services/                # Бизнес-логика
│   │   ├── tts_service.py
│   │   ├── queue_service.py
│   │   └── psychology_service.py
│   ├── utils/                   # Утилиты
│   │   ├── validators.py        # Валидация
│   │   ├── db_optimizer.py      # Оптимизация БД
│   │   └── role_checker.py      # Проверка ролей
│   └── middleware/              # Middleware
│       ├── rate_limiter.py
│       └── error_handler.py
│
├── 📂 tts_service/              # TTS микросервис (Python)
│   ├── main.py                  # Точка входа
│   ├── tts_engine.py            # Движок TTS
│   ├── TTS_rus_engine/          # Русский TTS
│   │   ├── model.py
│   │   └── processor.py
│   ├── audio/                   # Аудио файлы
│   │   ├── voices/              # Голоса пользователей
│   │   ├── temp/                # Временные файлы
│   │   └── cache/               # Кэш аудио
│   └── f5_tts_cache/            # Кэш моделей F5-TTS
│
├── 📂 frontend/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/               # Страницы
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TTS.jsx
│   │   │   ├── Commands.jsx
│   │   │   └── Admin.jsx
│   │   ├── components/          # Компоненты
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Button.jsx
│   │   ├── context/             # React Context
│   │   │   ├── AuthContext.jsx
│   │   │   └── WebSocketContext.jsx
│   │   └── services/            # API клиенты
│   │       ├── api.js
│   │       └── microservices.js
│   ├── dist/                    # Build файлы
│   └── package.json
│
├── 📂 docs/                     # 📚 ВСЯ ДОКУМЕНТАЦИЯ ✅
│   │
│   ├── 📄 README.md             # Навигация по документации
│   │
│   ├── 📊 reports/              # Отчеты и чеклисты
│   │   ├── PROJECT_REPORT.md
│   │   ├── PROJECT_SUMMARY.md
│   │   ├── TECHNICAL_REPORT.md
│   │   ├── OPTIMIZATION_REPORT.md
│   │   ├── CLEANUP_REPORT.md
│   │   ├── PROJECT_REORGANIZATION_REPORT.md
│   │   ├── TESTING_CHECKLIST.md
│   │   └── PRODUCTION_CHECKLIST.md
│   │
│   ├── 📖 guides/               # Руководства
│   │   ├── DEVELOPER_GUIDE.md
│   │   ├── CLEANUP_GUIDE.md
│   │   ├── DATABASE_MANAGEMENT_README.md
│   │   ├── LOGGING_AND_BACKUP_SYSTEM.md
│   │   ├── WORD_FILTER_SYSTEM.md
│   │   ├── PSYCHOLOGY_ANALYSIS_README.md
│   │   ├── VK_LIVE_COMMANDS_GUIDE.md
│   │   └── EMOTE_SETTINGS.md
│   │
│   ├── 🚀 deployment/           # Развертывание
│   │   ├── DEPLOYMENT.md
│   │   └── DEVELOPMENT.md
│   │
│   ├── ⚙️ setup/                # Настройка
│   │   ├── QUICK_SETUP_GUIDE.md
│   │   ├── AI_SETUP_GUIDE.md
│   │   ├── HUGGINGFACE_TOKEN_GUIDE.md
│   │   └── QUICK_COMMANDS.md
│   │
│   └── 🔧 scripts/              # Утилитные скрипты
│       ├── cleanup_project.py
│       ├── monitoring_viewer.py
│       ├── deploy.sh
│       ├── dev-setup.sh
│       ├── update.sh
│       └── setup-cloudflare-tunnel.sh
│
├── 📂 alembic/                  # Миграции базы данных
│   ├── env.py
│   └── versions/
│
├── 📂 VK_live_docs/             # Документация VK Live API
│   ├── API.md
│   └── Методы_*.md
│
├── 📄 README.md                 # Главный README проекта ✅
├── 🐳 docker-compose.prod.yml   # Docker конфигурация
├── 🌐 nginx.conf                # Nginx конфигурация
├── 📦 package.json              # Node.js зависимости
└── ⚙️ env.production.example    # Пример конфигурации

```

---

## 📊 Статистика проекта

### Основные компоненты:

| Компонент | Язык | Файлов | Строк кода |
|-----------|------|--------|------------|
| 🔧 Bot Service | Python | ~50 | ~8,500 |
| 🎤 TTS Service | Python | ~20 | ~3,200 |
| 🎨 Frontend | React/JS | ~103 | ~12,000 |
| 📚 Документация | Markdown | ~30 | ~8,000 |

**Всего:** ~200 файлов, ~32,000 строк кода

### Документация:

| Категория | Файлов | Размер |
|-----------|--------|--------|
| 📊 Отчеты | 8 | ~410 KB |
| 📖 Руководства | 8 | ~323 KB |
| 🚀 Deployment | 2 | ~80 KB |
| ⚙️ Setup | 4 | ~87 KB |
| 🔧 Скрипты | 6 | ~45 KB |

**Всего:** 28 файлов, ~945 KB

---

## 🎯 Принципы организации

### 1. Разделение по назначению

```
✅ Код → bot_service/, tts_service/, frontend/
✅ Документация → docs/
✅ Конфигурация → корень проекта
✅ Миграции → alembic/
```

### 2. Логическая структура документации

```
docs/
├── reports/     → Что сделано, анализ
├── guides/      → Как делать, инструкции
├── deployment/  → Как развернуть
├── setup/       → Как настроить
└── scripts/     → Утилиты
```

### 3. Минимализм в корне

Только **необходимые** файлы конфигурации:
- `README.md` - главный документ
- `docker-compose.prod.yml` - Docker
- `nginx.conf` - веб-сервер
- `package.json` - зависимости
- `env.production.example` - пример настроек

---

## 📈 Эволюция проекта

### v1.0 (До реорганизации)
```
TTS_TTV_0.02/
├── [27 файлов в корне] ❌
├── bot_service/
├── tts_service/
├── frontend/
└── ...хаос...
```

**Проблемы:**
- ❌ Хаотичная структура
- ❌ Сложно найти документы
- ❌ Запутанная навигация

### v2.0 (После реорганизации)
```
TTS_TTV_0.02/
├── docs/ ✅
│   ├── reports/
│   ├── guides/
│   ├── deployment/
│   ├── setup/
│   └── scripts/
├── bot_service/
├── tts_service/
├── frontend/
└── [только 5 конфиг файлов] ✅
```

**Улучшения:**
- ✅ Логическая структура
- ✅ Централизованная документация
- ✅ Легкая навигация
- ✅ Профессиональная организация

---

## 🔍 Навигация по проекту

### Для новичков:
1. **Начните с:** [`README.md`](../README.md)
2. **Быстрый старт:** [`docs/setup/QUICK_SETUP_GUIDE.md`](./setup/QUICK_SETUP_GUIDE.md)
3. **Команды:** [`docs/setup/QUICK_COMMANDS.md`](./setup/QUICK_COMMANDS.md)

### Для разработчиков:
1. **Developer Guide:** [`docs/guides/DEVELOPER_GUIDE.md`](./guides/DEVELOPER_GUIDE.md)
2. **База данных:** [`docs/guides/DATABASE_MANAGEMENT_README.md`](./guides/DATABASE_MANAGEMENT_README.md)
3. **Оптимизация:** [`docs/reports/OPTIMIZATION_REPORT.md`](./reports/OPTIMIZATION_REPORT.md)

### Для деплоя:
1. **Deployment:** [`docs/deployment/DEPLOYMENT.md`](./deployment/DEPLOYMENT.md)
2. **Production Checklist:** [`docs/reports/PRODUCTION_CHECKLIST.md`](./reports/PRODUCTION_CHECKLIST.md)

---

## 💡 Best Practices

### ✅ DO (Правильно):

```bash
# Документация
docs/reports/MY_REPORT.md
docs/guides/MY_GUIDE.md
docs/scripts/my_script.py

# Код
bot_service/services/my_service.py
tts_service/processors/my_processor.py
frontend/src/components/MyComponent.jsx
```

### ❌ DON'T (Неправильно):

```bash
# НЕ размещайте в корне
❌ MY_REPORT.md
❌ MY_GUIDE.md
❌ my_script.py
❌ temp_test.py
❌ check_something.py
```

---

## 🔄 Поддержка структуры

### Автоматическая очистка:

```bash
# Запускайте регулярно
python docs/scripts/cleanup_project.py
```

**Очищает:**
- Временные файлы
- Старые логи
- Python кэши
- Node.js кэши
- Старые бэкапы

### Мониторинг:

```bash
# Проверка состояния
python docs/scripts/monitoring_viewer.py
```

---

## 📚 Дополнительные ресурсы

- **Полная документация:** [`docs/README.md`](./README.md)
- **Отчет по реорганизации:** [`docs/reports/PROJECT_REORGANIZATION_REPORT.md`](./reports/PROJECT_REORGANIZATION_REPORT.md)
- **Гайд по очистке:** [`docs/guides/CLEANUP_GUIDE.md`](./guides/CLEANUP_GUIDE.md)

---

**Версия:** 2.0  
**Дата обновления:** 5 октября 2025  
**Статус:** ✅ Актуально

**Проект профессионально организован и готов к масштабированию!** 🚀


