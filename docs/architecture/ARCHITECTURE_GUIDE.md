# Architecture guide

## Обзор

Runtime-зоны проекта:

- `frontend` — React + Vite UI, который общается только с `bot_service`
- `bot_service` — control plane: auth, permissions, settings, routing policy, fallback, websocket delivery
- `tts-gateway` — advanced synthesis orchestrator для `f5` и `qwen`
- внешние provider engines:
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`

## Термины topology

- `self-hosted endpoint` — пользователь сам поднимает TTS-сервис и настраивает URL через `local_tts_endpoints`
- `project-hosted worker` — отдельный runtime-воркер проекта
- `gateway-managed` — `bot_service -> tts-gateway -> project-hosted workers`

Названия `local`, `use_local`, `f5_local`, `qwen_local` остаются как legacy naming для self-hosted path.

## Модель TTS routing

- `gcloud` — встроенный backend path в `bot_service`
- `f5` — gateway-managed synth, direct project-hosted fallback при необходимости, self-hosted optional
- `qwen` — gateway-managed synth в managed mode, self-hosted через compatibility adapter
- voice/admin API остаются provider-owned

## Границы сервисов

- `bot_service` — source of truth для пользовательских настроек и runtime policy
- `tts-gateway` — только orchestration, без владения app user settings
- `f5-tts-service` — F5 runtime и voice/admin операции
- `nano-qwen3tts-vllm` — Qwen inference runtime

## Auth для TTS upstreams

Используется strict API-key mode:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Backend env-контракт:
- `TTS_GATEWAY_URL`, `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`, `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`, `QWEN_TTS_SERVICE_API_KEY`
- `QWEN_VOICE_SERVICE_URL`

## Public backend surface

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- существующие voice/admin routes сохраняют path stability

## Frontend boundary

- frontend не должен знать прямые provider URLs
- direct runtime dependency on `VITE_TTS_SERVICE_URL` удалена
- health/capabilities/audio URL resolution идут через backend

## Deployment notes

Рекомендуемые локальные порты:
- gateway `8010`
- f5 `8011`
- qwen `8000`
- bot_service `8000`

Gateway требует Redis.