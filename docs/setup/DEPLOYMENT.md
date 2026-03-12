# Deployment Guide

Last updated: 2026-03-11

This file is the active deployment summary for this repository.

## Read First

1. `docs/STATUS_TRACKER.md`
2. `docs/setup/LOCAL_TTS_INTEGRATION.md`
3. `docs/setup/REPO_SPLIT_GUIDE.md`
4. `docs/setup/DOCKER_DEPLOYMENT.md`
5. `docs/architecture/TTS_ARCHITECTURE.md`

## Current Runtime Contract

- frontend talks only to `bot_service`
- advanced synthesis for `f5` and `qwen` goes through `tts-gateway`
- provider-owned voice/admin APIs are routed by `bot_service`
- qwen voice CRUD remains disabled until `QWEN_VOICE_SERVICE_URL` is configured
- TTS upstream auth is strict API-key with `Authorization` and `X-API-Key`

## Active Deployment Paths

| Path | Use case |
|---|---|
| `deploy/docker/docker-compose.dev.yml` | Full local stack from this repo |
| `deploy/docker/docker-compose.prod.yml` | Production-like single-host stack |
| `deploy/docker/docker-compose.bot.yml` | Bot/frontend host with upstream TTS services outside this host |
| `deploy/docker/docker-compose.tts-advanced.yml` | Compatibility overlay for a remote dedicated `f5-tts-service` host |
| `deploy/docker/docker-compose.tts-simple.yml` | Compatibility overlay for a local single-node `f5-tts-service` host |

## Required Backend Env

```env
TTS_GATEWAY_URL=http://localhost:8010
TTS_GATEWAY_API_KEY=...
F5_TTS_SERVICE_URL=http://localhost:8011
F5_TTS_SERVICE_API_KEY=...
QWEN_TTS_SERVICE_URL=http://localhost:8000
QWEN_TTS_SERVICE_API_KEY=...
QWEN_VOICE_SERVICE_URL=
```

## External Upstreams

- `tts-gateway` is deployed from its own repository and requires Redis.
- `f5-tts-service` is deployed from its own repository and requires PostgreSQL plus model/vendor assets.
- `nano-qwen3tts-vllm` is deployed from its own repository and is practically a Linux or WSL2 target.

## Verification

Run these checks after deployment:

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/tts/health?provider=f5"
curl "http://localhost:8000/api/tts/health?provider=qwen"
curl "http://localhost:8000/api/voices/providers/capabilities"
```

## Legacy Material

Historical deployment notes were moved to `docs/backlog/DEPLOYMENT_LEGACY_2026-03-11.md`.
