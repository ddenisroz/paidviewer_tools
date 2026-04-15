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
- [nano-qwen3tts-vllm](/H:/Programming/raw_code/AI/Python/nano-qwen3tts-vllm)

## Официальные TTS-режимы

- `cloud` — `frontend -> bot_service -> tts-gateway -> provider runtime`
- `self_host` — `frontend -> bot_service -> provisioning/pairing -> tts_worker_agent -> local runtime`

`raw endpoint` остаётся только compatibility-путём для поддержки. Основной пользовательский self-host сценарий — только через `tts_worker_agent`.

## С чего начать

- [Быстрый старт и запуск всего проекта](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/QUICKSTART.md)
- [Контекст проекта](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/PROJECT_CONTEXT.md)
- [Release checklist](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/release/RELEASE_CHECKLIST.md)
- [Live smoke runbook](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/setup/LIVE_SMOKE_RUNBOOK.md)
- [Индекс активной документации](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/README.md)

## Самый короткий локальный старт

```powershell
cd H:\Programming\raw_code\AI\Python\paidviewer_tools
docker compose --env-file bot_service/.env --env-file deploy/docker/compose.local.env `
  -f deploy/docker/docker-compose.prod.yml -f deploy/docker/docker-compose.local.yml `
  --profile core --profile cloud-tts up --build
```

Дальше смотри [docs/QUICKSTART.md](/H:/Programming/raw_code/AI/Python/paidviewer_tools/docs/QUICKSTART.md): там описан актуальный запуск всего контура.
Локальный OAuth теперь должен жить только на `http://localhost`: не смешивай `localhost` и `127.0.0.1`, иначе провайдерские callback/cookies будут ломать `state`.

## Документация

В `docs/` оставлен только активный слой. Исторические планы, аудиты и промежуточные материалы не должны быть источником правды для запуска или релиза.
