# Архитектурный обзор

## Обзор

Основные зоны проекта:

- `frontend` — React + Vite UI, который общается только с `bot_service`;
- `bot_service` — центральный backend: auth, permissions, settings, routing policy, fallback, websocket delivery;
- `tts-gateway` — orchestrator синтеза для `f5` и `qwen`;
- внешние TTS-движки:
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`

## Термины topology

- `self-hosted endpoint` — пользователь сам поднимает TTS-сервис и настраивает URL через `local_tts_endpoints`;
- `project-hosted worker` — отдельный runtime-воркер проекта;
- `gateway-managed` — `bot_service -> tts-gateway -> project-hosted workers`.

Названия `local`, `use_local`, `f5_local`, `qwen_local` пока сохраняются как старые имена для self-hosted path.

## Маршрутизация TTS

- `gcloud` — встроенный путь в `bot_service`;
- `f5` — сначала gateway-managed synth, прямой project-hosted fallback при необходимости, self-hosted optional;
- `qwen` — gateway-managed synth в управляемом режиме, self-hosted через слой совместимости;
- voice/admin API остаются на стороне провайдера.

## Границы сервисов

- `bot_service` — основной источник истины для пользовательских настроек и runtime policy;
- `tts-gateway` — только orchestration, без владения пользовательскими настройками приложения;
- `f5-tts-service` — F5 runtime и voice/admin операции;
- `nano-qwen3tts-vllm` — Qwen inference runtime.

## Авторизация для TTS upstreams

Используется строгий режим API-key:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

Backend env-контракт:

- `TTS_GATEWAY_URL`, `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`, `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`, `QWEN_TTS_SERVICE_API_KEY`
- `QWEN_VOICE_SERVICE_URL`

## Публичный backend-контракт

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`
- существующие voice/admin routes сохраняют стабильные пути

## Граница frontend

- frontend не должен знать прямые provider URLs;
- прямая runtime-зависимость от `VITE_TTS_SERVICE_URL` удалена;
- health, capabilities и audio URL resolution идут через backend.

## Деплой

Рекомендуемые локальные порты:

- gateway `8010`
- f5 `8011`
- qwen `8000`
- bot_service `8000`

Gateway требует Redis.
