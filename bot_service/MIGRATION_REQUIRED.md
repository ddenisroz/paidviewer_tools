# ⚠️ Требуется применение миграции

Для исправления ошибки с колонкой `streak_reset_on_skip` необходимо применить миграцию:

```bash
cd bot_service
alembic upgrade head
```

Миграция: `2dfdfeae5c56_add_streak_reset_on_skip_to_drops_config.py`

Это добавит колонку `streak_reset_on_skip` в таблицу `drops_configs`.

