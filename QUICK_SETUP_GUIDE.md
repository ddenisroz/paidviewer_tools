# QUICK_SETUP_GUIDE.md

## 🚀 Быстрая настройка системы логирования и бэкапов

### 📋 Что было сделано:

1. ✅ **Создана система логирования** с ротацией файлов
2. ✅ **Создана система бэкапов** с автоматическим расписанием
3. ✅ **Установлены зависимости** (schedule)
4. ✅ **Добавлены API endpoints** для управления бэкапами

### 🔧 Что нужно настроить:

#### 1. Переменные окружения

**В файле `bot_service/.env` добавьте:**
```bash
LOG_LEVEL=INFO
TTS_LOG_LEVEL=INFO
```

**В файле `tts_service/.env` добавьте:**
```bash
TTS_LOG_LEVEL=INFO
```

#### 2. Уровни логирования

- **DEBUG** - Подробная отладочная информация
- **INFO** - Общая информация о работе (рекомендуется)
- **WARNING** - Предупреждения
- **ERROR** - Только ошибки

### 🔌 API Endpoints (что это значит):

Теперь вы можете управлять бэкапами через веб-запросы:

#### Bot Service (порт 8000):
```bash
# Получить информацию о бэкапах
curl http://localhost:8000/api/admin/backups/info

# Создать бэкап БД
curl -X POST "http://localhost:8000/api/admin/backups/create?backup_type=database"

# Создать полный бэкап
curl -X POST "http://localhost:8000/api/admin/backups/create?backup_type=full"

# Очистить старые бэкапы
curl -X POST http://localhost:8000/api/admin/backups/cleanup
```

#### TTS Service (порт 8001):
```bash
# Получить информацию о бэкапах
curl http://localhost:8001/api/admin/backups/info

# Создать бэкап аудио файлов
curl -X POST "http://localhost:8001/api/admin/backups/create?backup_type=audio"

# Создать полный бэкап
curl -X POST "http://localhost:8001/api/admin/backups/create?backup_type=full"
```

### 🎯 Практическое использование:

#### Через Python скрипт:
```bash
# Демонстрация всех возможностей
python backup_manager_demo.py

# Получить информацию о бэкапах
python backup_manager_demo.py info bot
python backup_manager_demo.py info tts

# Создать бэкап
python backup_manager_demo.py create bot database
python backup_manager_demo.py create tts full

# Очистить старые бэкапы
python backup_manager_demo.py cleanup bot
```

#### Через браузер:
Откройте в браузере:
- `http://localhost:8000/api/admin/backups/info` - информация о бэкапах bot сервиса
- `http://localhost:8001/api/admin/backups/info` - информация о бэкапах tts сервиса

### 📁 Что создается автоматически:

```
logs/
├── app/                    # Основные логи
├── errors/                 # Логи ошибок
├── access/                 # Логи HTTP запросов
└── audit/                  # Логи аудита

backups/
├── database/               # Бэкапы БД
├── config/                 # Бэкапы конфигурации
├── logs/                   # Бэкапы логов
└── audio/                  # Бэкапы аудио
```

### ⏰ Автоматическое расписание:

- **02:00** - Ежедневный бэкап БД bot сервиса
- **02:30** - Ежедневный бэкап БД tts сервиса
- **03:00** (воскресенье) - Полный бэкап bot сервиса
- **03:30** (воскресенье) - Полный бэкап tts сервиса
- **04:00** - Очистка старых бэкапов bot сервиса
- **04:30** - Очистка старых бэкапов tts сервиса

### 🚨 Важно:

1. **Перезапустите сервисы** после добавления переменных окружения
2. **Проверьте права доступа** к папкам logs/ и backups/
3. **Мониторьте размер** логов и бэкапов
4. **Тестируйте восстановление** из бэкапов

### 🎉 Готово!

Теперь у вас есть:
- ✅ Централизованное логирование
- ✅ Автоматические бэкапы
- ✅ API для управления
- ✅ Очистка старых файлов
- ✅ Мониторинг через веб-интерфейс
