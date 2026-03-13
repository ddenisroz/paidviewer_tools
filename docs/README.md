# Индекс документации

Здесь перечислены только актуальные документы. Исторические заметки, аудиты и разовые планы лежат в `docs/backlog/` и не считаются source of truth для релиза.

## Читать в первую очередь

1. `QUICKSTART.md` — быстрый локальный запуск.
2. `STATUS_TRACKER.md` — текущее состояние проекта и открытые задачи.
3. `PROJECT_CONTEXT.md` — краткий снимок архитектуры и active contract.
4. `REPO_STRUCTURE.md` — что в репозитории продуктовый код, а что локальный мусор.
5. `architecture/ARCHITECTURE_GUIDE.md` — верхнеуровневая архитектура.
6. `setup/LOCAL_TTS_INTEGRATION.md` — контракт внешних TTS-сервисов.
7. `setup/LIVE_SMOKE_RUNBOOK.md` — пошаговый live smoke.
8. `setup/LIVE_SMOKE_BEGINNER_GUIDE_RU.md` — упрощённая инструкция для первого smoke.
9. `setup/REPO_SPLIT_GUIDE.md` — границы репозиториев и split-план.
10. `setup/DOCKER_DEPLOYMENT.md` — compose entrypoints и Docker-сценарии.
11. `setup/DEPLOYMENT.md` — активный деплой-контракт.
12. `guides/DEVELOPER_ONBOARDING.md` — onboarding для нового разработчика.
13. `guides/DEVELOPER_GUIDE.md` — стабильные инженерные правила.

## Что должно оставаться в корне `docs/`

- `README.md`
- `QUICKSTART.md`
- `PROJECT_CONTEXT.md`
- `REPO_STRUCTURE.md`
- `STATUS_TRACKER.md`

Все старые сводки, временные планы, разовые аудиты и removed-feature notes должны лежать в `docs/backlog/`.

## Структура папок

- `setup/` — запуск, окружение, compose, деплой.
- `architecture/` — архитектурные контракты и runtime-ограничения.
- `guides/` — developer и operational guides.
- `features/` — поведение конкретных подсистем.
- `api/` — внешние справочные материалы по сторонним API.
- `backlog/` — архив, история и неактуальные документы.

## Правило гигиены документации

- Если документ ссылается на удалённые файлы, старые env или снятые с поддержки маршруты, он должен быть переписан или перенесён в `docs/backlog/`.
- Активный документ не должен содержать mojibake, устаревшие пути и противоречия с кодом.