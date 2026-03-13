# Деплой

Последнее обновление: 2026-03-13

Документ фиксирует актуальный deployment-контракт репозитория.

## Что важно помнить

- `frontend` общается только с `bot_service`;
- advanced synthesis для `f5` и `qwen` идёт через `tts-gateway`;
- voice/admin API остаются за upstream-сервисами;
- qwen voice CRUD выключен, пока не задан `QWEN_VOICE_SERVICE_URL`.

## Активные compose entrypoints

| Файл | Когда использовать |
|---|---|
| `deploy/docker/docker-compose.dev.yml` | полный локальный стек |
| `deploy/docker/docker-compose.prod.yml` | production-like single-host сценарий |
| `deploy/docker/docker-compose.bot.yml` | только `bot_service/frontend`, когда TTS вынесен отдельно |
| `deploy/docker/docker-compose.tts-advanced.yml` | overlay для выделенного `f5-tts-service` host |
| `deploy/docker/docker-compose.tts-simple.yml` | overlay для локального single-node `f5-tts-service` |

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

## Внешние зависимости

- `tts-gateway` требует Redis;
- `f5-tts-service` требует PostgreSQL и model/vendor assets;
- `nano-qwen3tts-vllm` практически требует Linux или WSL2.

## Базовая проверка после деплоя

```powershell
curl http://localhost:8000/health
curl "http://localhost:8000/api/tts/health?provider=f5"
curl "http://localhost:8000/api/tts/health?provider=qwen"
curl "http://localhost:8000/api/voices/providers/capabilities"
```

Исторические заметки по деплою не должны жить в active docs. Их место в `docs/backlog/`.
