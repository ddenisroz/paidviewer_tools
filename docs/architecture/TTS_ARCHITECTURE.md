# TTS Architecture

Last updated: 2026-03-31

## Runtime topology

- `frontend` talks only to `bot_service`.
- `bot_service` is the source of truth for auth, settings, routing policy, slot gating, health, and playback contracts.
- `tts-gateway` is the shared cloud orchestrator for `f5` and `qwen`.
- `f5-tts-service` is the F5 runtime and F5 voice/admin API.
- `nano-qwen3tts-vllm` is the Qwen runtime.
- `tts_worker_agent` is the official self-host runtime bridge.

## Official TTS modes

Only two user-facing modes are official:

- `cloud`
- `self_host`

### Cloud

`frontend -> bot_service -> tts-gateway -> provider runtime`

This is the only official cloud path for both `f5` and `qwen`.

### Self-host

`frontend -> bot_service provisioning/pairing -> tts_worker_agent -> local runtime`

This is the only official self-host path for both `f5` and `qwen`.

## Compatibility-only paths

The following terms are legacy/compatibility-only and must not be treated as primary production topology:

- `self-hosted endpoint`
- `project-hosted worker`
- `gateway-managed`

Legacy flags like `use_local`, `f5_local`, `qwen_local` remain compatibility names only. Product language should use `cloud` and `self_host`.

## Public backend contract

- `GET /api/tts/status`
- `GET /api/tts/health`
- `GET /api/voices/providers/capabilities`
- `POST /api/local-tts/test-connection`

The TTS status/health shape is mode-first and provider-agnostic:

- `available`
- `degraded_reason`
- `slot_allowed`
- `recommended_path`
- `capabilities`
- `error_code`

## Ownership boundaries

`bot_service` owns:

- user settings
- routing policy
- slot gating
- provider selection
- self-host provisioning/pairing

`tts-gateway` owns:

- cloud orchestration
- queue/scheduler behavior
- provider runtime calls

`f5-tts-service` owns only F5-local operational state:

- F5 synthesis
- F5 voice/admin operations
- F5-local usage/limits

`nano-qwen3tts-vllm` owns only Qwen runtime state:

- runtime model exposure
- streaming synthesis
- persistent voice sample storage required by Qwen base mode

`tts_worker_agent` owns:

- self-host activation
- worker polling
- local diagnostics
- dispatch to local F5/Qwen runtimes

## Production notes

- `tts-gateway` requires Redis.
- `nano-qwen3tts-vllm` should be treated as Linux/WSL-first.
- `Qwen` production runtime should stay single-model-first unless there is an explicit need for a broader catalog.
- Frontend must not rely on direct provider URLs.
