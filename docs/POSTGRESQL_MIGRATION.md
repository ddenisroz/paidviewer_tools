# Миграция на PostgreSQL

Проект успешно мигрирован с SQLite на PostgreSQL для улучшения производительности и масштабируемости.

## Дата миграции
2 ноября 2025

## Преимущества PostgreSQL

- ✅ **Производительность**: Лучшая производительность при высокой нагрузке
- ✅ **Масштабируемость**: Поддержка множественных соединений и транзакций
- ✅ **Connection Pooling**: Автоматическое управление пулом соединений (20 базовых + 40 дополнительных)
- ✅ **Надежность**: ACID транзакции, репликация
- ✅ **Расширяемость**: Множество расширений и функций

## Текущая конфигурация

### База данных
- **Имя БД**: `payedviewerbot`
- **Пользователь**: `payedviewer_user`
- **Хост**: `127.0.0.1`
- **Порт**: `5432`

### Connection Pooling
```python
pool_size=20          # Базовый размер пула соединений
max_overflow=40       # Дополнительные соединения при нагрузке
pool_pre_ping=True    # Проверка соединений перед использованием
pool_recycle=3600     # Переиспользование соединений каждый час
```

## Настройка

### 1. Установка PostgreSQL

Скачать с официального сайта: https://www.postgresql.org/download/windows/

Или использовать скрипт автоматической установки:
```powershell
.\bot_service\scripts\setup_postgresql.ps1
```

### 2. Настройка DATABASE_URL

В файле `bot_service/.env` установите:
```env
DATABASE_URL=postgresql://payedviewer_user:password@127.0.0.1:5432/payedviewerbot
```

### 3. Применение миграций

```bash
cd bot_service
alembic upgrade head
```

## Полезные скрипты

Все скрипты находятся в `bot_service/scripts/`:

- `setup_postgresql.ps1` - Создание базы данных и пользователя
- `check_postgres_connection.ps1` - Проверка подключения
- `check_postgresql_data.py` - Просмотр данных в БД
- `fix_postgres_setup.ps1` - Исправление проблем с настройкой
- `reset_postgres_password.ps1` - Сброс пароля пользователя

## GUI инструменты

Для удобной работы с базой данных рекомендуется использовать:

1. **DBeaver** - https://dbeaver.io/download/ (рекомендуется)
2. **pgAdmin** - https://www.pgadmin.org/download/ (официальный)

Настройки подключения:
- Host: `127.0.0.1`
- Port: `5432`
- Database: `payedviewerbot`
- Username: `payedviewer_user`

## Проверка работы

```bash
# Через Python скрипт
python bot_service/scripts/check_postgresql_data.py

# Через psql
psql -U payedviewer_user -d payedviewerbot -h 127.0.0.1
```

## Откат на SQLite (не рекомендуется)

Если по какой-то причине нужно вернуться на SQLite:

1. В `.env` закомментируйте или удалите `DATABASE_URL`
2. Перезапустите приложение
3. Запустите `alembic upgrade head` для применения миграций к SQLite

⚠️ **Внимание**: Данные из PostgreSQL не будут автоматически перенесены обратно в SQLite.

## Поддержка

При возникновении проблем:

1. Проверьте, что PostgreSQL запущен: `Get-Service postgresql-x64-18`
2. Проверьте подключение: `.\bot_service\scripts\check_postgres_connection.ps1`
3. Проверьте логи приложения в `bot_service/logs/`
