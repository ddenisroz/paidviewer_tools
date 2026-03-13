# Docker deployment

Last updated: 2026-03-13

Этот документ описывает только актуальные compose entrypoints и текущую topology.

## Текущая topology

- frontend общается только с `bot_service`
- `tts-gateway` занимается advanced synthesis для `f5` и `qwen`
- `f5-tts-service` держит F5 runtime и voice/admin API
- qwen voice CRUD в этом репозитории не включён, пока не задан `QWEN_VOICE_SERVICE_URL`

## Compose entrypoints

### Полный локальный стек

```powershell
docker compose -f deploy/docker/docker-compose.dev.yml up -d
```

Поднимает:
- `postgres`
- `redis`
- `bot_service`
- `frontend`
- `tts_gateway`
- `tts_service`
- `qwen_tts`

### Production-like single host

```powershell
docker compose -f deploy/docker/docker-compose.prod.yml up -d
```

Минимальный env для config/startup:

```env
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
REDIS_PASSWORD=...
SECRET_KEY=...
```

### Host только для bot/frontend

Используй, когда TTS upstream-сервисы живут вне этого host:

```powershell
docker compose -f deploy/docker/docker-compose.bot.yml up -d
```

Нужные env:

```env
DB_PASSWORD=...
TTS_GATEWAY_URL=...
TTS_GATEWAY_API_KEY=...
F5_TTS_SERVICE_URL=...
F5_TTS_SERVICE_API_KEY=...
QWEN_TTS_SERVICE_URL=...
QWEN_TTS_SERVICE_API_KEY=...
QWEN_VOICE_SERVICE_URL=
```

### Выделенный F5 host

```powershell
docker compose -f deploy/docker/docker-compose.tts-advanced.yml up -d
```

### Локальный single-node F5 host

```powershell
docker compose -f deploy/docker/docker-compose.tts-simple.yml up -d
```

## Базовые проверки

```powershell
docker compose -f deploy/docker/docker-compose.dev.yml config -q
docker compose -f deploy/docker/docker-compose.bot.yml config -q
docker compose -f deploy/docker/docker-compose.dev.yml ps
curl http://localhost:8000/health
curl "http://localhost:8000/api/tts/health?provider=f5"
curl "http://localhost:8000/api/tts/health?provider=qwen"
curl http://localhost:8011/health/ready
```

## Важные замечания

- `tts-gateway` требует Redis.
- `f5-tts-service` требует PostgreSQL и model/vendor assets.
- `nano-qwen3tts-vllm` практически требует Linux/WSL2.
- Прямой runtime `VITE_TTS_SERVICE_URL` во frontend запрещён.