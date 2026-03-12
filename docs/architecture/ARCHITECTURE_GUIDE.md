# Architecture Guide

## Overview

Runtime zones:

- `frontend`: React + Vite UI (API/WS client only for `bot_service`).
- `bot_service`: FastAPI control plane (auth, settings, permissions, routing, fallback).
- `tts-gateway`: advanced synthesis orchestrator (`f5`, `qwen`).
- external provider engines:
  - `f5-tts-service`
  - `nano-qwen3tts-vllm`

Topology terms:

- `self-hosted endpoint`: пользователь сам поднимает TTS-сервис и настраивает URL через `local_tts_endpoints`.
- `project-hosted worker`: отдельный runtime-воркер проекта.
- `gateway-managed`: `bot_service` идет в `tts-gateway`, а gateway маршрутизирует запросы в project-hosted workers.
- Existing `local`/`use_local` names are legacy runtime naming for the self-hosted path.

## TTS Routing Model

- `gcloud`: backend-internal provider path.
- `f5`: gateway-managed for synthesis; project-hosted direct fallback if gateway is absent.
- `qwen`: gateway-managed for managed synthesis; self-hosted path exists separately through local endpoint configuration.
- provider voice/admin API remains provider-owned (`f5` now, qwen later).

Fallback policy remains mandatory: advanced failure -> basic `gtts`.

## Service Boundaries

- `bot_service` is the source of truth for user settings and runtime policy.
- `tts-gateway` is orchestration-only; it does not own app user settings.
- `f5-tts-service` owns F5 provider runtime and voice/admin operations.
- `nano-qwen3tts-vllm` is qwen inference runtime.

## Auth Contract (TTS Upstreams)

Strict API-key mode:

- `Authorization: Bearer <key>`
- `X-API-Key: <key>`

`bot_service` env contract:

- `TTS_GATEWAY_URL`, `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`, `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`, `QWEN_TTS_SERVICE_API_KEY` (reserved)
- `QWEN_VOICE_SERVICE_URL` (optional extension point)

## Backend API Additions

- `GET /api/tts/health?provider=f5|qwen|gcloud`
- `GET /api/voices/providers/capabilities`

Voice endpoints remain backward-compatible in path names.

## Qwen Voice CRUD Phase Policy

- Current phase: qwen voice CRUD disabled by default.
- Core returns explicit `501` with machine-readable `detail`.
- When `QWEN_VOICE_SERVICE_URL` is set, qwen voice/admin requests are routed there without frontend API changes.

## Frontend Split Preparation

- Frontend runtime no longer requires `VITE_TTS_SERVICE_URL`.
- Health checks and voice capability checks are backend-routed.
- Direct runtime coupling to provider URLs is removed from websocket/player paths.

## Deployment Notes

Recommended local ports:

- gateway `8010`
- f5 `8011`
- qwen `8000`
- bot_service `8000`

Gateway requires Redis connectivity in deployment profiles.

## Repository Split Readiness

- `docs/setup/REPO_SPLIT_GUIDE.md`
- `docs/architecture/TTS_ARCHITECTURE.md`
- `docs/setup/LOCAL_TTS_INTEGRATION.md`
