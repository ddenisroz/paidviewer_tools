# Деплой: активный контракт

Last updated: 2026-03-13

Это краткий active deployment summary для текущего репозитория.

## Что читать рядом

1. `docs/STATUS_TRACKER.md`
2. `docs/setup/LOCAL_TTS_INTEGRATION.md`
3. `docs/setup/REPO_SPLIT_GUIDE.md`
4. `docs/setup/DOCKER_DEPLOYMENT.md`
5. `docs/architecture/TTS_ARCHITECTURE.md`

## Текущий runtime-контракт

- frontend общается только с `bot_service`
- advanced synthesis для `f5` и `qwen` идёт через `tts-gateway`
- provider-owned voice/admin API остаются за upstream-сервисами
- qwen voice CRUD выключен, пока не задан `QWEN_VOICE_SERVICE_URL`
- auth к TTS upstream идёт по strict API-key через `Authorization` и `X-API-Key`

## Активные пути деплоя

| Путь | Когда использовать |
|---|---|
| `deploy/docker/docker-compose.dev.yml` | полный локальный стек из этого репозитория |
| `deploy/docker/docker-compose.prod.yml` | production-like single-host сценарий |
| `deploy/docker/docker-compose.bot.yml` | host только для `bot_service/frontend`, когда TTS живут отдельно |
| `deploy/docker/docker-compose.tts-advanced.yml` | совместимый overlay для выделенного `f5-tts-service` host |
| `deploy/docker/docker-compose.tts-simple.yml` | совместимый overlay для локального single-node `f5-tts-service` |

## Обязательные backend env

```env
TTS_GATEWAY_URL=http://localhost:8010
TTS_GATEWAY_API_KEY=...
F5_TTS_SERVICE_URL=http://localhost:8011
F5_TTS_SERVICE_API_KEY=...
QWEN_TTS_SERVICE_URL=http://localhost:8000
QWEN_TTS_SERVICE_API_KEY=...
QWEN_VOICE_SERVICE_URL=
```

## Внешние upstream-сервисы

- `tts-gateway` разворачивается из отдельного репозитория и требует Redis.
- `f5-tts-service` разворачивается из отдельного репозитория и требует PostgreSQL плюс model/vendor assets.
- `nano-qwen3tts-vllm` разворачивается из отдельного репозитория и практически требует Linux или WSL2.

## Проверка после деплоя

```powershell
curl http://localhost:8000/health
curl "http://localhost:8000/api/tts/health?provider=f5"
curl "http://localhost:8000/api/tts/health?provider=qwen"
curl "http://localhost:8000/api/voices/providers/capabilities"
```

## Примечание

Исторические заметки по деплою должны жить только в `docs/backlog/`, а не в active docs.