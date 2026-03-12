# Docker Deployment Guide

Last updated: 2026-03-12

This file describes current compose entrypoints only.

## Topology

- frontend talks only to `bot_service`
- `tts-gateway` handles advanced synthesis for `f5` and `qwen`
- `f5-tts-service` keeps provider-owned voice/admin APIs
- qwen voice CRUD is not enabled in this repo until `QWEN_VOICE_SERVICE_URL` exists

## Compose Entry Points

### Full Local Stack

```bash
docker compose -f deploy/docker/docker-compose.dev.yml up -d
```

Starts:

- `postgres`
- `redis`
- `bot_service`
- `frontend`
- `tts_gateway`
- `tts_service`
- `qwen_tts`

### Production-Like Single Host

```bash
docker compose -f deploy/docker/docker-compose.prod.yml up -d
```

Minimum env required for config/startup:

```env
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
REDIS_PASSWORD=...
SECRET_KEY=...
```

### Bot/Frontend Host Only

Use when TTS upstreams live elsewhere:

```bash
docker compose -f deploy/docker/docker-compose.bot.yml up -d
```

Required env on this host:

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

### Remote Dedicated F5 Host

Compatibility overlay for a dedicated `f5-tts-service` machine:

```bash
docker compose -f deploy/docker/docker-compose.tts-advanced.yml up -d
```

Required env:

```env
F5_DB_PASSWORD=...
F5_TTS_SERVICE_API_KEY=...
HUGGINGFACE_TOKEN=
```

### Local Single-Node F5 Host

Compatibility overlay for direct F5 testing:

```bash
docker compose -f deploy/docker/docker-compose.tts-simple.yml up -d
```

Required env:

```env
F5_DB_PASSWORD=...
F5_TTS_SERVICE_API_KEY=...
HUGGINGFACE_TOKEN=
```

## Verification

```bash
docker compose -f deploy/docker/docker-compose.dev.yml config -q
docker compose -f deploy/docker/docker-compose.bot.yml config -q
docker compose -f deploy/docker/docker-compose.dev.yml ps
curl http://localhost:8000/health
curl "http://localhost:8000/api/tts/health?provider=f5"
curl "http://localhost:8000/api/tts/health?provider=qwen"
curl http://localhost:8011/health/ready
```

## Notes

- `tts-gateway` requires Redis.
- `f5-tts-service` requires PostgreSQL and model/vendor assets.
- `nano-qwen3tts-vllm` is practically a Linux or WSL2 target.
- Direct frontend runtime dependency on `VITE_TTS_SERVICE_URL` is not allowed.
- `docker-compose.bot.yml` validates with unset-var warnings until `DB_PASSWORD` and upstream API keys are supplied.
- `docker-compose.prod.yml` does not pass config validation until required DB/Redis/app env values are set, including `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, and `SECRET_KEY`.

## Legacy Material

Historical Docker notes were moved to `docs/backlog/DOCKER_DEPLOYMENT_LEGACY_2026-03-11.md`.
