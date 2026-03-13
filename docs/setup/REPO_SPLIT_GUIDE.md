# Repo split guide

Last updated: 2026-03-13

Этот документ фиксирует целевые границы между core repo и внешними TTS upstreams.

## Целевые репозитории

1. `ttv-core` — этот репозиторий
   - `bot_service/`, `frontend/`, shared docs, deploy overlays
   - control-plane ответственность: auth, moderation, orchestration, settings, provider routing policy

2. `tts-gateway`
   - advanced synthesis orchestrator для `f5` и `qwen`
   - fairness/scheduling/provider adapters

3. `f5-tts-service`
   - F5 runtime + provider-owned voice/admin APIs

4. `nano-qwen3tts-vllm`
   - Qwen inference engine
   - voice CRUD не входит в текущую фазу этого репозитория

## Термины

- `self-hosted endpoint` — пользователь сам поднимает TTS и задаёт URL через `local_tts_endpoints`
- `project-hosted worker` — отдельный runtime-воркер проекта
- `gateway-managed` — `bot_service -> tts-gateway -> project-hosted workers`

## Что замораживается по контракту

### Synth
- core вызывает gateway synth endpoint
- health идёт через backend `GET /api/tts/health`

### Voice/Admin
- F5 voice/admin API остаётся provider-owned
- Qwen voice/admin в core остаётся `501`, пока не задан `QWEN_VOICE_SERVICE_URL`

### Auth
- только strict API-key mode для TTS upstreams
- core отправляет `Authorization: Bearer <key>` и `X-API-Key: <key>`

## Стабильная backend boundary для frontend

- никакой прямой runtime зависимости от `VITE_TTS_SERVICE_URL`
- health checks только через backend
- capability gating только через backend
- audio URL resolution должна оставаться backend-safe

## Владение env

### `ttv-core`
- `TTS_GATEWAY_URL`
- `TTS_GATEWAY_API_KEY`
- `F5_TTS_SERVICE_URL`
- `F5_TTS_SERVICE_API_KEY`
- `QWEN_TTS_SERVICE_URL`
- `QWEN_TTS_SERVICE_API_KEY`
- `QWEN_VOICE_SERVICE_URL`

### `tts-gateway`
- `TTS_GATEWAY_API_KEYS`
- `TTS_GATEWAY_REDIS_URL`
- `TTS_GATEWAY_F5_URL`
- `TTS_GATEWAY_F5_API_KEY`
- `TTS_GATEWAY_QWEN_URL`
- `TTS_GATEWAY_QWEN_API_KEY`

### `f5-tts-service`
- `F5_TTS_SERVICE_API_KEYS`
- `F5_TTS_DATABASE_URL`

### `nano-qwen3tts-vllm`
- runtime/model vars из upstream repo

## Текущая фаза

- `f5` synth: gateway-managed first, direct project-hosted fallback допустим
- `qwen` synth: gateway-managed в managed mode
- self-hosted endpoints остаются отдельным пользовательским path
- `qwen` voice CRUD пока intentionally unavailable