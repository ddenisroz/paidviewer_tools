# Структура репозитория

Документ отвечает на два вопроса:

1. где лежит продуктовый код;
2. что считается мусором и не должно попадать в git.

## Продуктовые папки

| Путь | Назначение |
|---|---|
| `bot_service/` | основной backend: API, auth, services, repositories, models, tests |
| `frontend/` | dashboard на React + Vite |
| `deploy/` | compose, nginx, deployment assets |
| `docs/` | активная короткая документация |
| `docs/backlog/` | архив, аудиты, старые планы и legacy-справка |

## Скрипты

| Путь | Что там лежит |
|---|---|
| `scripts/` | общие проектные утилиты и cleanup перед release |
| `scripts/dev/` | локальная диагностика и одноразовые dev-утилиты |
| `bot_service/scripts/` | только рабочие maintenance-скрипты для backend |
| `bot_service/scripts/dev/` | вспомогательная диагностика, не ежедневный рабочий слой |
| `bot_service/scripts/archive/legacy/` | старые и destructive-скрипты, не часть нормального workflow |

## Что должно оставаться в `bot_service/scripts/`

- `database_hygiene.py`
- `delete_users.py`
- `db_console.py`
- `show_db_structure.py`
- `check_postgresql_data.py`
- `run_check.py`
- `README_MAINTENANCE.md`

Всё остальное переносится в `bot_service/scripts/dev/` или в `bot_service/scripts/archive/legacy/`.

## Что считается мусором

- `__pycache__/`
- `.ruff_cache/`, `.mypy_cache/`, `.pytest_cache/`
- `pytest-cache-files-*`
- `tmp/`, `.pytest_tmp/`, `bot_service/tmp/`
- `frontend/dist/`, `frontend/.vite/`, `frontend/.vitest/`
- `logs/`, `*.log`
- `.playwright*/`, `playwright-report/`, `*.har`
- `artifacts/`, `*.tmp`, `*.fixed`

Если файл создаётся runtime, тестом, сборкой, браузерным smoke или локальной отладкой, это не продуктовый артефакт и ему не место в git.

## Очистка перед отгрузкой

```powershell
.\scripts\prepare-release.ps1
.\scripts\prepare-release.ps1 -ApplyCleanup
.\scripts\prepare-release.ps1 -ApplyCleanup -RunChecks
```
