# Система обслуживания bot_service

## Обзор

Полная система автоматического обслуживания bot_service, включающая:
- Ротацию логов
- Создание и очистку бэкапов
- Мониторинг места на диске
- Автоматизацию через cron/systemd/Windows Tasks

## Структура скриптов

```
bot_service/scripts/
├── maintenance.py           # Основной скрипт обслуживания
├── cleanup_backups.py       # Очистка старых файлов
├── backup_manager.py        # Управление бэкапами
├── disk_monitor.py          # Мониторинг диска
├── setup_automation.sh      # Настройка для Linux/macOS
├── setup_automation.ps1     # Настройка для Windows
└── README_MAINTENANCE.md    # Эта документация
```

## Быстрый старт

### 1. Настройка автоматизации

**Linux/macOS:**
```bash
cd bot_service/scripts
chmod +x *.py
./setup_automation.sh
```

**Windows:**
```powershell
cd bot_service\scripts
.\setup_automation.ps1
```

### 2. Ручной запуск

**Linux/macOS:**
```bash
# Проверка статуса
./run_maintenance.sh status

# Ежедневное обслуживание
./run_maintenance.sh daily

# Еженедельное обслуживание
./run_maintenance.sh weekly

# Экстренная очистка
./run_maintenance.sh emergency
```

**Windows:**
```powershell
# Проверка статуса
.\run_maintenance.ps1 status

# Ежедневное обслуживание
.\run_maintenance.ps1 daily

# Еженедельное обслуживание
.\run_maintenance.ps1 weekly

# Экстренная очистка
.\run_maintenance.ps1 emergency
```

## Детальное описание

### 1. maintenance.py - Основной скрипт

**Функции:**
- `daily` - Ежедневное обслуживание
- `weekly` - Еженедельное обслуживание  
- `emergency` - Экстренная очистка
- `status` - Проверка статуса

**Параметры:**
```bash
python maintenance.py daily [--no-backup] [--no-cleanup] [--backup-age 30] [--log-age 90]
python maintenance.py weekly
python maintenance.py emergency
python maintenance.py status
```

### 2. cleanup_backups.py - Очистка файлов

**Функции:**
- Очистка старых бэкапов
- Очистка старых логов
- Статистика освобожденного места

**Параметры:**
```bash
python cleanup_backups.py --backup-days 30 --log-days 90 [--dry-run]
```

### 3. backup_manager.py - Управление бэкапами

**Функции:**
- Создание бэкапов БД
- Создание бэкапов конфигурации
- Создание полных бэкапов
- Сжатие бэкапов

**Параметры:**
```bash
python backup_manager.py --types database config [--no-compress] [--list]
```

### 4. disk_monitor.py - Мониторинг диска

**Функции:**
- Проверка свободного места
- Анализ использования сервисом
- Поиск больших файлов
- Генерация отчетов

**Параметры:**
```bash
python disk_monitor.py [--warning 80] [--critical 90] [--service-limit 3.0]
```

## Конфигурация

### Файл maintenance.conf

```ini
# Пороги предупреждений (проценты)
DISK_WARNING_THRESHOLD=80
DISK_CRITICAL_THRESHOLD=90

# Максимальный размер сервиса (в GB)
SERVICE_MAX_SIZE_GB=3

# Возраст файлов для очистки (в днях)
MAX_BACKUP_AGE_DAYS=30
MAX_LOG_AGE_DAYS=90

# Настройки бэкапов
BACKUP_TYPES=database,config
BACKUP_COMPRESS=true

# Настройки логирования
LOG_LEVEL=INFO
```

## Автоматизация

### Linux/macOS (cron)

```bash
# Ежедневная очистка в 2:00
0 2 * * * cd /path/to/bot_service && python3 scripts/maintenance.py daily

# Еженедельное обслуживание в воскресенье в 3:00
0 3 * * 0 cd /path/to/bot_service && python3 scripts/maintenance.py weekly

# Проверка статуса каждый час
0 * * * * cd /path/to/bot_service && python3 scripts/maintenance.py status --alert-only
```

### Windows (Task Scheduler)

Задачи создаются автоматически:
- `BotServiceDailyMaintenance` - ежедневно в 2:00
- `BotServiceWeeklyMaintenance` - еженедельно в воскресенье в 3:00
- `BotServiceMonitor` - каждый час

### Systemd (Linux)

```bash
# Включить мониторинг
sudo systemctl enable bot-service-monitor.timer
sudo systemctl start bot-service-monitor.timer

# Проверить статус
sudo systemctl status bot-service-monitor.timer
```

## Мониторинг и алерты

### Пороги предупреждений

- **80%** - Предупреждение о нехватке места
- **90%** - Критическое предупреждение
- **3 GB** - Максимальный размер сервиса

### Логи

- `logs/maintenance.log` - Логи обслуживания
- `logs/app/` - Логи приложения (ротация 30 дней)
- `logs/errors/` - Логи ошибок (ротация 90 дней)
- `logs/access/` - Логи доступа (ротация 7 дней)
- `logs/audit/` - Логи аудита (ротация 365 дней)

### Отчеты

Автоматически генерируются отчеты:
- Статистика использования места
- Список больших файлов
- Статус системы

## Устранение проблем

### Нехватка места

1. **Экстренная очистка:**
   ```bash
   python scripts/maintenance.py emergency
   ```

2. **Ручная очистка:**
   ```bash
   python scripts/cleanup_backups.py --backup-days 7 --log-days 14
   ```

3. **Анализ больших файлов:**
   ```bash
   python scripts/disk_monitor.py --no-report
   ```

### Проблемы с бэкапами

1. **Проверить список бэкапов:**
   ```bash
   python scripts/backup_manager.py --list
   ```

2. **Создать бэкап вручную:**
   ```bash
   python scripts/backup_manager.py --types database config
   ```

3. **Проверить целостность БД:**
   ```bash
   sqlite3 data/app_data.db "PRAGMA integrity_check;"
   ```

### Проблемы с логами

1. **Проверить ротацию:**
   ```bash
   ls -la logs/app/
   ```

2. **Очистить старые логи:**
   ```bash
   python scripts/cleanup_backups.py --log-days 7
   ```

## Рекомендации

### Для продакшена

1. **Настройте мониторинг** - используйте внешние системы мониторинга
2. **Регулярные бэкапы** - создавайте полные бэкапы еженедельно
3. **Тестирование** - регулярно тестируйте восстановление из бэкапов
4. **Логирование** - настройте централизованное логирование

### Для разработки

1. **Более агрессивная очистка** - уменьшите сроки хранения
2. **Частые проверки** - запускайте status чаще
3. **Тестирование** - используйте --dry-run для тестирования

## Безопасность

- Скрипты работают с правами пользователя сервиса
- Бэкапы сжимаются для экономии места
- Логи ротируются автоматически
- Конфиденциальные данные не логируются

## Производительность

- Очистка выполняется в фоновом режиме
- Бэкапы создаются с минимальной нагрузкой
- Мониторинг не влияет на работу сервиса
- Логи пишутся асинхронно
