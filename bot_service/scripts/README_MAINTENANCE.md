# Скрипты обслуживания

В этой папке лежат только актуальные операционные скрипты для backend: диагностика, администрирование, безопасные действия с БД и служебные проверки.

## Основные категории

### Доступ и администрирование
- `check_admin.py`
- `make_admin.py`
- `update_session_role.py`
- `add_user_to_whitelist.py`
- `check_user_whitelist.py`
- `normalize_admin_tables.py`

### Диагностика токенов и авторизации
- `check_tokens.py`
- `check_bot_token.py`
- `check_twitch_token.py`
- `get_vk_token_manual.py`

### Диагностика TTS
- `check_tts_enabled.py`
- `check_tts_status.py`
- `init_blocked_bots.py`

### БД и сессии
- `db_console.py`
- `delete_users.py`
- `database_hygiene.py`
- `show_db_structure.py`
- `check_postgresql_data.py`
- `check_sessions.py`
- `find_n_plus_one.py`
- `fix_admin_session.py`

### Разрушительные служебные операции
- `clear_database.py`
- `reset_db.py`
- `setup_postgresql.ps1`
- `reset_postgres_password.ps1`
- `check_postgres_connection.ps1`
- `fix_postgres_setup.ps1`

## Безопасное удаление пользователей

Используй `delete_users.py` вместо старых bulk-cleanup сценариев.

Просмотр списка:

```powershell
python scripts/delete_users.py --list
```

Dry-run preview:

```powershell
python scripts/delete_users.py --user-id 42
python scripts/delete_users.py --twitch some_channel
python scripts/delete_users.py --vk some_vk_channel
```

Фактическое удаление:

```powershell
python scripts/delete_users.py --user-id 42 --yes
```

## Гигиена БД: orphan user-записи и старые неактивные сессии

Используй `database_hygiene.py`, если нужно:
- убрать записи с `user_id`, которого уже нет в `users`;
- почистить старые неактивные сессии по retention-политике.

Preview:

```powershell
python scripts/database_hygiene.py
python scripts/database_hygiene.py --orphan-users
python scripts/database_hygiene.py --inactive-sessions --inactive-session-days 7
```

Фактическая очистка:

```powershell
python scripts/database_hygiene.py --yes
python scripts/database_hygiene.py --orphan-users --yes
python scripts/database_hygiene.py --inactive-sessions --inactive-session-days 7 --yes
```

## Dangerous DB-скрипты

Перед запуском destructive-скриптов сначала делай preview/dry-run, если он есть:

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

Если нужно быстро запускать типовые проверки, используй `run_check.py`:

```powershell
cd bot_service
python scripts/run_check.py --list
python scripts/run_check.py tts-status 1
python scripts/run_check.py admin
```

Этот launcher не делает destructive-операций и только проксирует диагностические `check_*` сценарии.
