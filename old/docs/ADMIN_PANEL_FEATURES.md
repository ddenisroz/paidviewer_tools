# 🛠️ Admin Panel Features

## Обзор

Админ-панель содержит набор инструментов для управления системой, мониторинга и обслуживания проекта.

## 📦 Управление хранилищем (Storage Management)

### Местоположение
```
/dashboard/admin → Таб "Хранилище"
```

### Возможности

#### 1. **Общая статистика**
- Размер базы данных в MB/GB
- Общее количество записей
- Индикатор здоровья системы (✅ Здорово / ⚠️ Требует внимания / 🚨 Критично)

#### 2. **Управление компонентами**

##### 📝 Логи
- Просмотр размера логов
- Быстрая очистка логов старше 30 дней
- Счетчик записей логов

##### 🎙️ Голоса
- Отображение размера директории пользовательских голосов
- Очистка неиспользуемых голосов (> 30 дней)
- Счетчик файлов голосов

##### 💾 Кеш
- Видимость текущего размера кеша
- Быстрая очистка всех кеш-файлов
- Счетчик кеш-файлов

##### 🔐 Резервные копии
- Просмотр времени последней резервной копии
- Создание новой резервной копии
- Восстановление из последней резервной копии

### API Endpoints

#### GET `/api/database/stats`
Получить статистику хранилища.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "database_size_bytes": 52428800,
    "total_records": 15000,
    "logs_size_bytes": 15728640,
    "log_entries": 10000,
    "voices_size_bytes": 10485760,
    "voices_count": 25,
    "cache_size_bytes": 5242880,
    "cache_files": 150,
    "backup_size_bytes": 52428800,
    "last_backup_time": 1700000000
  },
  "timestamp": "2025-11-01T12:34:56"
}
```

#### POST `/api/database/cleanup`
Выполнить очистку определенного компонента.

**Параметры:**
- `cleanup_type`: `logs` | `voices` | `cache` | `backup` | `restore` | `all`

**Пример:**
```bash
POST /api/database/cleanup
Content-Type: application/json

{
  "cleanup_type": "logs"
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "logs": {
      "deleted_files": 0,
      "freed_space_bytes": 1048576
    }
  },
  "message": "Cleanup completed",
  "timestamp": "2025-11-01T12:34:56"
}
```

### Backend Implementation

#### DatabaseCleanupService методы

```python
# Очистка неиспользуемых голосов
cleanup_service.cleanup_unused_voices()
# Returns: {"deleted_files": 5, "freed_space_bytes": 52428800}

# Очистка кеша
cleanup_service.cleanup_cache()
# Returns: {"deleted_files": 150, "freed_space_bytes": 10485760}

# Создание резервной копии
cleanup_service.create_backup()
# Returns: {"success": True, "backup_file": "/path/to/backup.db", ...}

# Восстановление из резервной копии
cleanup_service.restore_from_backup()
# Returns: {"success": True, "restored_from": "/path/to/backup.db", ...}
```

### Рекомендации по использованию

1. ✅ **Еженедельно** проверяйте размер БД
2. ✅ **Ежедневно** создавайте резервные копии
3. ✅ Очищайте логи старше 30 дней когда размер > 500 MB
4. ✅ Если БД более 1 GB, рассмотрите архивирование старых данных

---

## 🔄 История действий (In Progress)

_Coming soon..._

---

## 🔧 Управление ботами (In Progress)

_Coming soon..._
