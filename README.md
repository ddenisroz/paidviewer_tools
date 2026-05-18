# Paidviewer Tools

Основной продуктовый репозиторий Paidviewer.

Содержит:

- `bot_service` — центральный backend, авторизация, orchestration, бизнес-логика
- `frontend` — пользовательский кабинет и админ-центр
- `tts_worker_agent` — официальный self-host runtime для локального TTS
- интеграции Twitch, VK Live, YouTube, drops/streaks и OBS overlays

## Базовый стек

- Python `3.12`
- Node.js `20+`
- PostgreSQL
- Redis

Внешний cloud TTS-контур живёт в отдельных репозиториях:

- [tts-gateway](/H:/Programming/raw_code/AI/Python/tts-gateway)
- [f5-tts-service](/H:/Programming/raw_code/AI/Python/f5-tts-service)

## Официальные TTS-режимы

- `cloud` — `frontend -> bot_service -> tts-gateway -> provider runtime`
- `self_host` — `frontend -> bot_service -> provisioning/pairing -> tts_worker_agent -> local runtime`

`raw endpoint` остаётся только compatibility-путём для поддержки. Основной пользовательский self-host сценарий — только через `tts_worker_agent`.

## С чего начать

- [Быстрый старт и запуск всего проекта](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/QUICKSTART.md)
- [Release checklist](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/release/RELEASE_CHECKLIST.md)
- [Live smoke runbook](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/setup/LIVE_SMOKE_RUNBOOK.md)
- [Индекс активной документации](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/README.md)

## Самый короткий локальный старт

```powershell
cd H:\Programming\raw_code\AI\Python\paidviewer_tools
.\start-dev.ps1
```

По умолчанию поднимается только лёгкий `core`: Postgres, Redis, backend и frontend.
По умолчанию запуск теперь быстрый: без принудительного `down` и без лишнего rebuild.
Тяжёлые TTS runtimes запускаются явно: `.\start-dev.ps1 -WithCloudTtsReal`.

Самые полезные быстрые режимы:

```powershell
.\start-dev.ps1 -WithCloudTtsReal
.\start-dev.ps1 -WithCloudTtsReal -Services bot_service tts_service
.\start-dev.ps1 -WithCloudTtsReal -Build -Services bot_service
.\start-dev.ps1 -WithCloudTtsReal -Reset
```

Дальше смотри [docs/QUICKSTART.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/QUICKSTART.md): там описан актуальный запуск всего контура, путь к зеркальным Docker-логам и безопасная очистка Docker.
Локальный OAuth теперь должен жить только на `http://localhost`: не смешивай `localhost` и `127.0.0.1`, иначе провайдерские callback/cookies будут ломать `state`.

## Уборка рабочей копии

Для безопасной локальной уборки есть dry-run скрипт:

```powershell
.\scripts\dev\cleanup_worktree.ps1
.\scripts\dev\cleanup_worktree.ps1 -Apply
```

Скрипт чистит только allowlist runtime-мусора: `__pycache__`, pytest/cache-директории, `frontend/dist`, временные backend-логи и runtime data. Он не удаляет `.env`, `.venv`, `node_modules`, локальные конфиги и пользовательские данные.

## Документация

В `docs/` оставлен только активный операционный слой. Исторические планы, внутренние заметки и промежуточные материалы не должны быть источником правды для запуска или релиза.
