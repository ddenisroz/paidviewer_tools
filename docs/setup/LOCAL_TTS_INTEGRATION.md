# Local TTS Integration (F5 + Qwen)

Last updated: 2026-02-22

## Goal

Connect user-owned local TTS instances (F5 or Qwen) to `bot_service` so chat messages can be synthesized through local endpoints.

## What Is Supported

- Per-user local endpoint configuration.
- Provider split: `f5` and `qwen` are configured independently.
- Cloud/local mode switch in Advanced TTS settings.
- Automatic fallback to basic `gtts` if local/cloud advanced synthesis fails.

## Prerequisites

- Running backend: `bot_service`.
- Running frontend.
- Local provider endpoint reachable from backend host.
- User/channel in whitelist (required for advanced provider synthesis when not using an explicitly healthy local endpoint).

## 1. Configure backend URLs

In `bot_service/.env`:

```env
TTS_SERVICE_URL=http://localhost:8001
F5_TTS_SERVICE_URL=http://localhost:8001
QWEN_TTS_SERVICE_URL=http://localhost:8011
```

Notes:

- `F5_TTS_SERVICE_URL` is the cloud/default F5 provider endpoint.
- `QWEN_TTS_SERVICE_URL` is the cloud/default Qwen provider endpoint.
- Per-user local endpoints are configured via API/UI and override cloud endpoint in local mode.

## 2. Configure local endpoint in UI

Open Local TTS settings and save endpoint for selected provider:

- Provider: `F5` or `Qwen`
- Endpoint URL: e.g. `http://127.0.0.1:8001` (F5) or `http://127.0.0.1:8011` (Qwen)
- Optional API key
- Enable local usage

## 3. Select provider and mode in Advanced TTS

In TTS main page:

1. Set Advanced provider: `F5 TTS` or `Qwen 3 TTS`.
2. Select mode: `Local`.
3. Ensure local endpoint health is green.

For Google Cloud provider, local mode is not applicable.

## 4. API endpoints used

Local endpoint management:

- `GET /api/local-tts/config?provider=f5|qwen`
- `POST /api/local-tts/config`
- `POST /api/local-tts/test-connection`
- `POST /api/local-tts/toggle?provider=f5|qwen`

Provider-aware voice management:

- `GET /api/voices/global?provider=f5|qwen`
- `GET /api/voices/user/custom?provider=f5|qwen`
- `POST /api/user/voices/upload?provider=f5|qwen`

## 5. Runtime behavior summary

- If engine is `f5tts` or `qwen` and mode is `local`, runtime tries per-user local endpoint for that provider.
- If local endpoint is not healthy or missing, runtime falls back to basic `gtts`.
- If advanced provider request fails (timeout/upstream error), runtime falls back to basic `gtts`.

## 6. Troubleshooting

### Local endpoint saved, but synthesis still cloud/fallback

Check:

- `provider` matches selected advanced provider (`f5` vs `qwen`).
- local endpoint health status is `healthy`.
- user/channel whitelist status.
- backend logs for provider resolution and fallback reason.

### Voice list is empty

Check:

- correct provider query (`provider=f5|qwen`).
- upstream provider service responds to `/api/tts/voices/global`.
- internal auth key (`TTS_INTERNAL_API_KEY`) if enabled.

### Google Cloud not working

Use dedicated endpoints:

- `GET /api/tts/gcloud/voices`
- `POST /api/tts/gcloud/preview`

And verify credentials (ADC or API key) on backend side.

## 7. Security recommendations

- Keep local endpoints private (LAN/VPN/Tunnel), not public without auth.
- Use `TTS_INTERNAL_API_KEY` for service-to-service protection.
- Rotate tokens/API keys periodically.
