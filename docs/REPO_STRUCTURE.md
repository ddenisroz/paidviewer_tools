# Структура репозитория и hygiene

Этот документ отвечает на два вопроса:
1. где лежит продуктовый код;
2. что считается локальным мусором и не должно попадать в git.

## Основные продуктовые папки

| Путь | Назначение | Когда трогать |
|---|---|---|
| `bot_service/` | Основной backend: API, auth, services, repositories, models, bots | backend feature/fix/security work |
| `frontend/` | Основное dashboard-приложение на React + Vite | UI и frontend integration |
| `deploy/` | Docker compose, nginx, deployment topology | infra/deploy changes |
| `bot_service/alembic/` | Миграции БД | schema/model changes |

## Важные, но не runtime-папки

| Путь | Назначение | Комментарий |
|---|---|---|
| `docs/` | Актуальная документация | source of truth вне backlog |
| `docs/backlog/` | История, аудиты, временные планы | не источник правды для релиза |
| `scripts/` | Tooling и release-cleanup | не runtime |
| `scripts/dev/` | Диагностика и одноразовые проверки | можно игнорировать вне отладки |
| `.github/workflows/` | CI | влияет на PR, а не runtime |
| `.husky/` | Git hooks | локальный workflow |
| `.venv/` | Локальное Python-окружение | machine-local |

## Что считается мусором

| Путь / паттерн | Источник | Коммитить? |
|---|---|---|
| `**/__pycache__/` | Python runtime/import cache | нет |
| `.ruff_cache/`, `.mypy_cache/`, `.pytest_cache/` | lint/test cache | нет |
| `pytest-cache-files-*` | временные pytest директории | нет |
| `.benchmarks/`, `bot_service/.benchmarks/` | benchmark output | нет |
| `.pytest_tmp/`, `tmp/`, `bot_service/tmp/` | scratch и временные каталоги | нет |
| `frontend/dist/`, `frontend/.vite/`, `frontend/.vitest/` | frontend build/test output | нет |
| `logs/`, `*.log`, runtime json output | локальные логи | нет |
| `.playwright*/`, `playwright-report/`, `*.har` | browser/e2e diagnostics | нет |
| `artifacts/`, `*.tmp`, `*.fixed` | локальные результаты и хвосты | нет |

## Простое правило

Если файл или каталог создаётся тестом, сборкой, runtime, линтером, браузерным smoke или локальной отладкой — это не бизнес-логика и не должно жить в git.

## Очистка перед отгрузкой

```powershell
.\scripts\prepare-release.ps1
.\scripts\prepare-release.ps1 -ApplyCleanup
.\scripts\prepare-release.ps1 -ApplyCleanup -IncludeVenvCaches
```

## Что читать, если репозиторий кажется перегруженным

1. `README.md`
2. `docs/QUICKSTART.md`
3. `docs/PROJECT_CONTEXT.md`
4. `docs/setup/DEPLOYMENT.md`
5. `docs/architecture/ARCHITECTURE_GUIDE.md`