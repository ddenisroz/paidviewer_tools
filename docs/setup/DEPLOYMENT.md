# Деплой

Последнее обновление: 2026-03-16

Документ фиксирует актуальный deployment-контракт репозитория.

## Что важно помнить

- `frontend` общается только с `bot_service`
- advanced synthesis для `f5` и `qwen` идёт через `tts-gateway`
- voice/admin API остаются за upstream-сервисами
- qwen voice/admin API по умолчанию используют `QWEN_TTS_SERVICE_URL`; `QWEN_VOICE_SERVICE_URL` нужен только если voice CRUD вынесен в отдельный upstream

## Активные compose entrypoints

| Файл | Когда использовать |
|---|---|
| `deploy/docker/docker-compose.dev.yml` | полный локальный стек |
| `deploy/docker/docker-compose.prod.yml` | production-like single-host сценарий |
| `deploy/docker/docker-compose.bot.yml` | только `bot_service/frontend`, когда TTS вынесен отдельно |
| `deploy/docker/docker-compose.tts-advanced.yml` | overlay для выделенного `f5-tts-service` host |
| `deploy/docker/docker-compose.tts-simple.yml` | overlay для локального single-node `f5-tts-service` |

## Core backend env

```env
DATABASE_URL=postgresql://user:password@localhost:5432/bot_service_db
TTS_GATEWAY_URL=http://localhost:8010
TTS_GATEWAY_API_KEY=...
F5_TTS_SERVICE_URL=http://localhost:8011
F5_TTS_SERVICE_API_KEY=...
QWEN_TTS_SERVICE_URL=http://localhost:8012
QWEN_TTS_SERVICE_API_KEY=...
QWEN_VOICE_SERVICE_URL=
QWEN_ALLOWED_MODELS=
```

`F5_TTS_SERVICE_API_KEY` и `QWEN_TTS_SERVICE_API_KEY` могут быть пустыми, если ты используешь один общий inter-service key через `TTS_INTERNAL_API_KEY` или уже заданный `TTS_GATEWAY_API_KEY`.

`bot_service/.env.example` теперь intentionally minimal: редкие overrides вроде `QWEN_CLOUD_ALLOWED_MODELS`, mTLS, internal JWT, rate-limit tweaks и прочие tuning-переменные не удалены из кода, они просто убраны из основного шаблона.

Рекомендуемый паттерн: задай общий `QWEN_ALLOWED_MODELS`, а специализированные env используй только как override.
Для managed Qwen держи `QWEN_CLOUD_ALLOWED_MODELS` или общий `QWEN_ALLOWED_MODELS` синхронно с runtime allowlist (`QWEN_TTS_ALLOWED_MODELS` / `QWEN3_TTS_MODEL_PATH` в upstream контейнере), иначе backend catalog и реально поднятые модели разъедутся.

## Внешние зависимости

- `tts-gateway` требует Redis
- `f5-tts-service` требует PostgreSQL и model/vendor assets
- `nano-qwen3tts-vllm` практически требует Linux или WSL2

## Базовая проверка после деплоя

```powershell
curl http://localhost:8000/health
curl "http://localhost:8000/api/tts/health?provider=f5"
curl "http://localhost:8000/api/tts/health?provider=qwen"
curl "http://localhost:8000/api/voices/providers/capabilities"
```

## Связанные документы

- [LOCAL_TTS_INTEGRATION.md](LOCAL_TTS_INTEGRATION.md)
- [LIVE_SMOKE_RUNBOOK.md](LIVE_SMOKE_RUNBOOK.md)
