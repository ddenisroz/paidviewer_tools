# LOGGING_AND_BACKUP_SYSTEM.md

## 📋 Система логирования и бэкапов

### 🔧 Обзор

Система обеспечивает:
- **Централизованное логирование** с ротацией файлов
- **Автоматические бэкапы** по расписанию
- **Ручное управление** бэкапами через API
- **Очистку старых** файлов и бэкапов

### 📁 Структура логов

```
logs/
├── app/                    # Основные логи приложения
│   ├── bot_service.log     # Текущий лог bot_service
│   ├── tts_service.log     # Текущий лог tts_service
│   └── *.log.YYYY-MM-DD    # Архивные логи (30 дней)
├── errors/                 # Логи ошибок
│   ├── bot_service_errors.log
│   └── tts_service_errors.log
├── access/                 # Логи HTTP запросов
│   ├── bot_service_access.log
│   └── tts_service_access.log
├── audit/                  # Логи аудита (критические действия)
│   ├── bot_service_audit.log
│   └── tts_service_audit.log
├── tts/                    # Логи TTS операций
│   └── tts_service_tts.log
└── audio/                  # Логи аудио операций
    └── tts_service_audio.log
```

### 💾 Структура бэкапов

```
backups/
├── database/               # Бэкапы БД
│   ├── bot_service_db_YYYYMMDD_HHMMSS.db
│   └── tts_service_db_YYYYMMDD_HHMMSS.db
├── config/                 # Бэкапы конфигурации
│   ├── bot_service_config_YYYYMMDD_HHMMSS.tar.gz
│   └── tts_service_config_YYYYMMDD_HHMMSS.tar.gz
├── logs/                   # Бэкапы логов
│   ├── bot_service_logs_YYYYMMDD_HHMMSS.tar.gz
│   └── tts_service_logs_YYYYMMDD_HHMMSS.tar.gz
├── audio/                  # Бэкапы аудио файлов
│   └── tts_service_audio_YYYYMMDD_HHMMSS.tar.gz
└── models/                 # Метаданные моделей
    └── tts_service_models_meta_YYYYMMDD_HHMMSS.tar.gz
```

### ⚙️ Настройка

#### Переменные окружения

```bash
# Уровень логирования
LOG_LEVEL=INFO              # DEBUG, INFO, WARNING, ERROR
TTS_LOG_LEVEL=INFO

# Настройки бэкапов (по умолчанию)
MAX_DB_BACKUPS=30           # Дней хранения бэкапов БД
MAX_CONFIG_BACKUPS=7        # Дней хранения бэкапов конфигурации
MAX_LOGS_BACKUPS=7          # Дней хранения бэкапов логов
MAX_AUDIO_BACKUPS=3         # Дней хранения бэкапов аудио
```

#### Установка зависимостей

```bash
python install_backup_dependencies.py
```

### 📅 Расписание бэкапов

#### Bot Service
- **02:00** - Ежедневный бэкап БД
- **03:00** (воскресенье) - Еженедельный полный бэкап
- **04:00** - Очистка старых бэкапов

#### TTS Service
- **02:30** - Ежедневный бэкап БД
- **03:30** (воскресенье) - Еженедельный полный бэкап
- **04:30** - Очистка старых бэкапов

### 🔌 API Endpoints

#### Bot Service

```http
# Получить информацию о бэкапах
GET /api/admin/backups/info

# Создать ручной бэкап
POST /api/admin/backups/create?backup_type={type}
# Типы: database, config, logs, full

# Очистить старые бэкапы
POST /api/admin/backups/cleanup
```

#### TTS Service

```http
# Получить информацию о бэкапах
GET /api/admin/backups/info

# Создать ручной бэкап
POST /api/admin/backups/create?backup_type={type}
# Типы: database, config, logs, audio, models, full

# Очистить старые бэкапы
POST /api/admin/backups/cleanup
```

### 📊 Мониторинг

#### Проверка статуса логов

```bash
# Размер логов
du -sh logs/

# Последние ошибки
tail -f logs/errors/bot_service_errors.log
tail -f logs/errors/tts_service_errors.log

# Статистика запросов
tail -f logs/access/bot_service_access.log
```

#### Проверка бэкапов

```bash
# Размер бэкапов
du -sh backups/

# Список бэкапов БД
ls -la backups/database/

# Информация через API
curl http://localhost:8000/api/admin/backups/info
curl http://localhost:8001/api/admin/backups/info
```

### 🚨 Устранение неполадок

#### Проблемы с логированием

1. **Логи не создаются**
   ```bash
   # Проверьте права доступа
   ls -la logs/
   chmod 755 logs/
   ```

2. **Большой размер логов**
   ```bash
   # Очистите старые логи
   find logs/ -name "*.log.*" -mtime +30 -delete
   ```

3. **Ошибки ротации**
   ```bash
   # Проверьте свободное место
   df -h
   ```

#### Проблемы с бэкапами

1. **Бэкапы не создаются**
   ```bash
   # Проверьте права доступа
   ls -la backups/
   chmod 755 backups/
   ```

2. **Ошибки создания бэкапов**
   ```bash
   # Проверьте логи
   tail -f logs/errors/bot_service_errors.log
   ```

3. **Недостаточно места**
   ```bash
   # Очистите старые бэкапы
   curl -X POST http://localhost:8000/api/admin/backups/cleanup
   ```

### 🔒 Безопасность

- **Права доступа**: Только администраторы могут управлять бэкапами
- **Шифрование**: Бэкапы хранятся в открытом виде (добавьте шифрование при необходимости)
- **Резервное копирование**: Настройте внешнее резервное копирование для критических данных

### 📈 Производительность

- **Асинхронность**: Бэкапы выполняются в фоновом режиме
- **Сжатие**: Логи и конфигурации сжимаются в tar.gz
- **Ротация**: Автоматическая очистка старых файлов
- **Мониторинг**: Отслеживание размера и количества файлов

### 🎯 Рекомендации

1. **Мониторинг**: Настройте алерты при превышении размера логов
2. **Тестирование**: Регулярно проверяйте восстановление из бэкапов
3. **Документация**: Ведите журнал критических изменений
4. **Обновления**: Регулярно обновляйте систему логирования
