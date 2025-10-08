# 🧹 Руководство по очистке проекта

## Обзор

Проект содержит автоматизированную систему очистки для удаления временных файлов, старых логов и бэкапов.

---

## 🚀 Быстрый старт

### Просмотр без удаления (рекомендуется сначала)

```bash
python cleanup_project.py --dry-run
```

### Полная очистка

```bash
python cleanup_project.py
```

### Настройка параметров

```bash
python cleanup_project.py \
    --logs-days 30 \
    --backup-days 7 \
    --backup-keep 5
```

---

## 🗑️ Что удаляется

### 1. Python кэши
- `__pycache__/` директории
- `*.pyc`, `*.pyo`, `*.pyd` файлы

**Причина:** Автоматически генерируются при запуске Python

### 2. Node.js кэши
- `node_modules/.cache/`
- `frontend/.next/`
- `frontend/dist/`

**Причина:** Временные файлы сборки frontend

### 3. Временные аудио файлы
- `tts_service/audio/temp/*` (старше 1 дня)
- `tts_service/audio/cache/*` (старше 1 дня)
- `tts_service/audio/test/*`

**Причина:** Тестовые и кэшированные аудио файлы

### 4. Старые логи
- Логи старше **30 дней** (настраивается)
- **Сохраняются:** Error логи (для отладки)

**Причина:** Предотвращение переполнения диска

### 5. Старые бэкапы
- Бэкапы старше **7 дней** (настраивается)
- **Сохраняются:** Последние **5** бэкапов (настраивается)

**Причина:** Балансирование между безопасностью и местом на диске

### 6. Временные тестовые файлы
- `test_*.py`
- `*_test.py`
- `check_*.py`
- `temp_*.py`, `tmp_*.py`

**Причина:** Временные скрипты для отладки

**⚠️ Важно:** Настоящие тесты в `tests/` не удаляются

### 7. OS файлы
- `.DS_Store` (macOS)
- `Thumbs.db` (Windows)
- `desktop.ini` (Windows)

**Причина:** Системные файлы, не нужные для проекта

### 8. Старые файлы мониторинга
- Файлы мониторинга старше **7 дней** в `logs/monitoring/`

**Причина:** Экономия места, данные уже агрегированы

---

## 📊 Параметры командной строки

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `--dry-run` | Просмотр без удаления | False |
| `--logs-days` | Дни хранения логов | 30 |
| `--backup-days` | Дни хранения бэкапов | 7 |
| `--backup-keep` | Количество последних бэкапов | 5 |

---

## 🔄 Автоматическая очистка

### Настройка cron (Linux/macOS)

Запуск каждый день в 3:00 AM:

```bash
crontab -e
```

Добавьте строку:

```cron
0 3 * * * cd /path/to/project && python cleanup_project.py >> cleanup.log 2>&1
```

### Настройка Task Scheduler (Windows)

1. Откройте Task Scheduler
2. Создайте новую задачу:
   - **Trigger:** Daily at 3:00 AM
   - **Action:** Run `python cleanup_project.py`
   - **Start in:** Путь к проекту

### Docker Environment

Добавьте в `docker-compose.yml`:

```yaml
services:
  cleanup:
    image: python:3.11-slim
    volumes:
      - ./:/app
    working_dir: /app
    command: python cleanup_project.py
    deploy:
      restart_policy:
        condition: none
```

Запуск через cron на хосте:

```cron
0 3 * * * docker-compose -f /path/to/docker-compose.yml run --rm cleanup
```

---

## 🛡️ Безопасность

### Что НЕ удаляется

✅ **Сохраняется:**
- Исходный код (`.py`, `.js`, `.jsx`)
- Конфигурационные файлы
- Голосовые файлы пользователей (`audio/voices/`)
- Базы данных (`.db`)
- Error логи
- Последние N бэкапов
- Настоящие тесты в `tests/`
- Production файлы

### Рекомендации

1. **Всегда используйте `--dry-run` сначала**
   ```bash
   python cleanup_project.py --dry-run
   ```

2. **Создайте бэкап перед первым запуском**
   ```bash
   # Автоматический бэкап (если настроен)
   python -m bot_service.backup_manager
   ```

3. **Проверьте логи после очистки**
   ```bash
   tail -f cleanup.log
   ```

---

## 📁 Структура после очистки

```
project/
├── bot_service/
│   ├── backups/
│   │   ├── database/    (последние 5 файлов)
│   │   ├── config/      (последние 5 файлов)
│   │   └── logs/        (последние 5 файлов)
│   ├── logs/
│   │   ├── errors/      (все error логи)
│   │   └── ...          (логи за последние 30 дней)
│   └── ...
├── tts_service/
│   ├── audio/
│   │   ├── voices/      (все голоса сохранены)
│   │   ├── temp/        (файлы за последний день)
│   │   └── cache/       (файлы за последний день)
│   └── ...
└── cleanup_project.py
```

---

## 💡 Примеры использования

### 1. Проверка перед очисткой

```bash
# Смотрим, что будет удалено
python cleanup_project.py --dry-run

# Если всё ОК, запускаем
python cleanup_project.py
```

### 2. Агрессивная очистка для CI/CD

```bash
# Удаляем логи старше 7 дней, бэкапы старше 3 дней
python cleanup_project.py --logs-days 7 --backup-days 3 --backup-keep 3
```

### 3. Консервативная очистка для production

```bash
# Сохраняем больше данных
python cleanup_project.py --logs-days 90 --backup-days 30 --backup-keep 10
```

### 4. Очистка только Python кэшей

Используйте встроенный инструмент:

```bash
# Linux/macOS
find . -type d -name "__pycache__" -exec rm -rf {} +

# Windows (PowerShell)
Get-ChildItem -Path . -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
```

---

## 🔧 Интеграция с CI/CD

### GitHub Actions

`.github/workflows/cleanup.yml`:

```yaml
name: Daily Cleanup

on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Run cleanup
        run: python cleanup_project.py
      
      - name: Upload cleanup report
        uses: actions/upload-artifact@v3
        with:
          name: cleanup-log
          path: cleanup.log
```

### GitLab CI

`.gitlab-ci.yml`:

```yaml
cleanup:
  stage: maintenance
  script:
    - python cleanup_project.py
  only:
    - schedules
  artifacts:
    paths:
      - cleanup.log
    expire_in: 1 week
```

---

## 📊 Мониторинг очистки

### Проверка освобожденного места

```bash
# Размер директории до очистки
du -sh bot_service/logs bot_service/backups

# Запуск очистки
python cleanup_project.py

# Размер директории после очистки
du -sh bot_service/logs bot_service/backups
```

### Логирование

Скрипт автоматически логирует:
- ✅ Количество удаленных файлов
- ✅ Количество удаленных директорий
- ✅ Освобожденное место
- ❌ Ошибки удаления

Пример вывода:

```
2025-10-05 03:00:00 - INFO - 🐍 Очистка Python кэшей...
2025-10-05 03:00:05 - INFO - 📦 Очистка Node.js кэшей...
2025-10-05 03:00:10 - INFO - 🎵 Очистка временных аудио файлов...
...
============================================================
📊 Статистика очистки:
  Удалено файлов: 1,234
  Удалено директорий: 56
  Освобождено места: 1.23 GB
============================================================
✅ Очистка завершена!
```

---

## ⚠️ Troubleshooting

### Проблема: Файлы не удаляются

**Решение:**
1. Проверьте права доступа:
   ```bash
   chmod +x cleanup_project.py
   ```

2. Запустите с правами администратора (если нужно):
   ```bash
   # Linux/macOS
   sudo python cleanup_project.py
   
   # Windows (от администратора)
   python cleanup_project.py
   ```

### Проблема: Удалены нужные файлы

**Решение:**
1. Восстановите из бэкапа:
   ```bash
   # Список доступных бэкапов
   ls -lh bot_service/backups/database/
   
   # Восстановите из бэкапа
   cp bot_service/backups/database/backup_latest.db bot_service/bot_service.db
   ```

2. Обновите `.gitignore` чтобы исключить эти файлы

### Проблема: Скрипт работает слишком долго

**Решение:**
1. Запустите с меньшим scope:
   ```python
   # В cleanup_project.py закомментируйте ненужные методы
   # self.clean_old_logs()  # Пропускаем
   ```

2. Увеличьте `days_to_keep` параметры

---

## 🔗 Связанные документы

- [DATABASE_MANAGEMENT_README.md](./DATABASE_MANAGEMENT_README.md) - Управление БД
- [LOGGING_AND_BACKUP_SYSTEM.md](./LOGGING_AND_BACKUP_SYSTEM.md) - Система логирования
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Развертывание

---

## 📝 Changelog

### 2025-10-05 - v1.0
- ✅ Создан автоматизированный скрипт очистки
- ✅ Добавлена поддержка dry-run режима
- ✅ Реализована очистка Python/Node кэшей
- ✅ Добавлена очистка старых логов и бэкапов
- ✅ Создана полная документация

---

**Дата создания:** 2025-10-05  
**Версия:** 1.0  
**Статус:** ✅ Актуально

