# Скрипты обслуживания backend

В корне `bot_service/scripts/` должны лежать только рабочие операционные скрипты: диагностика, администрирование, безопасная очистка БД и инфраструктурные команды. Исторические, одноразовые и опасные сценарии не держим здесь без необходимости.

## Основные категории

### Администрирование и права
- `check_admin.py`
- `make_admin.py`
- `update_session_role.py`
- `add_user_to_whitelist.py`
- `check_user_whitelist.py`
- `normalize_admin_tables.py`

### Токены и авторизация
- `check_tokens.py`
- `check_bot_token.py`
- `check_twitch_token.py`
- `get_vk_token_manual.py`

### TTS и runtime-проверки
- `check_tts_enabled.py`
- `check_tts_status.py`
- `init_blocked_bots.py`

### База данных и сессии
- `db_console.py`
- `show_db_structure.py`
- `check_postgresql_data.py`
- `check_sessions.py`
- `delete_users.py`
- `database_hygiene.py`

### Осознанно destructive-скрипты
- `clear_database.py`
- `reset_db.py`
- `setup_postgresql.ps1`
- `reset_postgres_password.ps1`
- `check_postgres_connection.ps1`
- `fix_postgres_setup.ps1`

## Безопасное удаление пользователей

Для точечного удаления пользователя используй `delete_users.py`. Этот скрипт делает preview по умолчанию и не требует ручного SQL.

Просмотр списка:

```powershell
python scripts/delete_users.py --list
```

Preview без удаления:

```powershell
python scripts/delete_users.py --user-id 42
python scripts/delete_users.py --twitch some_channel
python scripts/delete_users.py --vk some_vk_channel
```

Фактическое удаление:

```powershell
python scripts/delete_users.py --user-id 42 --yes
```

## Гигиена БД: orphan-записи и старые неактивные сессии

`database_hygiene.py` нужен для двух задач:
- удалить записи с `user_id`, которого уже нет в `users`;
- очистить старые неактивные сессии по retention-политике.

Preview:

```powershell
python scripts/database_hygiene.py
python scripts/database_hygiene.py --orphan-users
python scripts/database_hygiene.py --inactive-sessions --inactive-session-days 7
```

Очистка:

```powershell
python scripts/database_hygiene.py --yes
python scripts/database_hygiene.py --orphan-users --yes
python scripts/database_hygiene.py --inactive-sessions --inactive-session-days 7 --yes
```

## Опасные DB-скрипты

Перед запуском destructive-сценариев сначала используй preview/dry-run, если он есть:

```powershell
python scripts/clear_database.py clear --dry-run
python scripts/reset_db.py --dry-run
```

Фактический destructive запуск делай только осознанно:

```powershell
python scripts/clear_database.py clear --yes
python scripts/reset_db.py --yes
```

## Единый launcher для проверок

Для типовых безопасных проверок используй `run_check.py`:

```powershell
cd bot_service
python scripts/run_check.py --list
python scripts/run_check.py tts-status 1
python scripts/run_check.py admin
```

Этот launcher не делает destructive-операций и только проксирует безопасные диагностические `check_*` сценарии.