# Voice Upload Unified (Provider-Aware)

Last updated: 2026-02-22

## Scope

This document describes voice upload and management flow for advanced providers:

- `f5`
- `qwen`

Google Cloud (`gcloud`) is excluded from upload flow because it uses cloud-managed voices.

## Key Rules

1. Every voice operation is provider-scoped (`provider=f5|qwen`).
2. Voice settings in DB are split by provider (`user_voice_settings.tts_provider`).
3. Local endpoint configuration is split by provider (`local_tts_endpoints.provider`).
4. UI must always pass provider in voice-management requests.

## API Surface

User voice operations:

- `GET /api/voices/user/custom?provider=f5|qwen`
- `POST /api/user/voices/upload?provider=f5|qwen`
- `DELETE /api/voices/user/custom/{voice_id}?provider=f5|qwen`
- `PUT /api/voices/user/settings/{voice_id}?provider=f5|qwen`

Global/admin operations:

- `GET /api/voices/admin/global?provider=f5|qwen`
- `POST /api/voices/admin/upload?provider=f5|qwen`
- `PUT /api/voices/admin/global/{voice_id}?provider=f5|qwen`
- `DELETE /api/voices/admin/global/{voice_id}?provider=f5|qwen`

Voice discovery for playback setup:

- `GET /api/voices/global?provider=f5|qwen`

## Data Separation

### `user_voice_settings`

- stores user-level overrides by voice and provider:
  - `voice_id`
  - `voice_name`
  - `tts_provider`
  - `cfg_strength`
  - `speed_preset`
  - `volume`

### `local_tts_endpoints`

- stores local endpoint configuration by provider:
  - `provider=f5|qwen`
  - `endpoint_url`
  - `is_active`
  - `is_healthy`

## Frontend Integration Notes

- Provider selector in TTS UI must drive all voice API queries.
- Query keys must include provider to avoid cache mix between F5 and Qwen.
- Upload and admin dialogs must keep provider context from current tab/page state.

## Runtime Alignment

- `set_voice` and `set_random_voice` resolve candidate voice list from currently active provider.
- `gcloud` voice selection uses `gcloud_voices` (separate path, no upload).
- If selected advanced provider fails, runtime uses basic `gtts` fallback.

## Migration/Compatibility

Legacy `/api/tts/voices/*` proxy endpoints remain for compatibility but should not be the primary integration path.
Use provider-aware `/api/voices/*` and `/api/user/voices/*` routes for new code.
