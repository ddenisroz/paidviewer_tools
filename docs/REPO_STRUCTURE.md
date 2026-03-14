# Структура репозитория

Документ отвечает на два вопроса:

1. где лежит рабочий код;
2. что считается мусором и не должно попадать в git.

## Рабочие папки

| Путь | Назначение |
|---|---|
| `bot_service/` | основной backend: API, авторизация, сервисы, репозитории, модели, тесты |
| `frontend/` | пользовательский интерфейс на React + Vite |
| `deploy/` | compose, nginx и материалы для развёртывания |
| `docs/` | короткая актуальная документация |
| `docs/backlog/` | архив, старые планы, аудиты, legacy-справка |

## Скрипты

| Путь | Что там лежит |
|---|---|
| `scripts/` | общие проектные утилиты и очистка перед отгрузкой |
| `scripts/dev/` | локальная диагностика и одноразовые вспомогательные утилиты |
| `bot_service/scripts/` | только рабочие maintenance-скрипты для backend |
| `bot_service/scripts/dev/` | вспомогательная backend-диагностика |
| `bot_service/scripts/archive/legacy/` | старые и опасные скрипты, не часть обычного рабочего процесса |

## Что должно оставаться в `bot_service/scripts/`

- `database_hygiene.py`
- `delete_users.py`
- `db_console.py`
- `show_db_structure.py`
- `check_postgresql_data.py`
- `run_check.py`
- `README_MAINTENANCE.md`

Всё остальное уходит в `bot_service/scripts/dev/` или `bot_service/scripts/archive/legacy/`.

## Что считается мусором

- `__pycache__/`
- `.ruff_cache/`, `.mypy_cache/`, `.pytest_cache/`
- `pytest-cache-files-*`
- `tmp/`, `.pytest_tmp/`, `bot_service/tmp/`
- `frontend/dist/`, `frontend/.vite/`, `frontend/.vitest/`
- `logs/`, `*.log`
- `.playwright*/`, `playwright-report/`, `*.har`
- `artifacts/`, `*.tmp`, `*.fixed`

Если файл создаётся runtime, тестом, сборкой, браузерной проверкой или локальной отладкой, это не продуктовый артефакт и ему не место в git.

## Очистка перед отгрузкой

```powershell
.\scripts\prepare-release.ps1
.\scripts\prepare-release.ps1 -ApplyCleanup
.\scripts\prepare-release.ps1 -ApplyCleanup -RunChecks
```
