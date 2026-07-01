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

Для локального smoke-профиля `cloud-tts-fake` теперь поднимается лёгкий fake F5 runtime на `8011`, поэтому gateway-путь можно проверять end-to-end без загрузки реальной модели.

Для mixed RU/EN озвучки self-host runtime должен уметь маршрутизировать английский текст на EN-capable или bilingual F5 checkpoint. Один только RU checkpoint уровня `Misha` не даёт качественного произношения английских слов. Если bilingual runtime вынесен отдельно, агент поддерживает отдельный `mixed_language_endpoint_url` для таких заданий.

## С чего начать

- [Быстрый старт и запуск всего проекта](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/QUICKSTART.md)
- [Production deployment: VPS + Vercel + Self Hosted TTS](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/DEPLOYMENT_GUIDE.md)
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

Скрипт чистит только allowlist runtime-мусора: `__pycache__`, pytest/cache-директории, `frontend/dist`, временные backend-логи и temp/cache. Он не удаляет `.env`, `.venv`, `node_modules`, локальные конфиги, `uploads` и локальные данные. Для удаления `bot_service/core/data` нужен явный флаг `-IncludeLocalData`.

## Документация

В `docs/` оставлен только активный операционный слой. Исторические планы, внутренние заметки и промежуточные материалы не должны быть источником правды для запуска или релиза.
