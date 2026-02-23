# API Contract

Last updated: 2026-02-23

## Base URL

- Local default: `http://localhost:8001`

## Authentication

Inter-service authorization supports:

1. Primary: `Authorization: Bearer <service JWT>`
2. Compatibility fallback: `X-Internal-Service-Key: <TTS_INTERNAL_API_KEY>`

Expected JWT claims:

- `type=service`
- `iss=bot_service` (configurable)
- `aud=f5_tts` (configurable)
- `sub=bot_service` (allowed subjects configurable)

User JWT authorization is also accepted where applicable.

## Health Endpoints

- `GET /health/live` - liveness probe.
- `GET /health/ready` - readiness probe (DB + engine + background tasks).
- `GET /health` - compatibility alias.
- `GET /api/health` - compatibility alias for legacy callers.
- `GET /detailed` - detailed component checks.
- `GET /metrics` - service metrics payload.

## Stable Endpoints Used By bot_service

### Synthesis

- `POST /api/tts/synthesize-channel`
- `GET /api/tts/task/{task_id}`

### Voices (provider storage side)

- `GET /api/tts/voices`
- `GET /api/tts/voices/global`
- `GET /api/tts/voices/{voice_id}`
- `GET /api/tts/user/voices/{user_id}`
- `POST /api/tts/user/voices/upload`
- `DELETE /api/tts/user/voices/{voice_id}`
- `PUT /api/tts/user/voices/{voice_id}/rename`
- `POST /api/tts/user/voices/{voice_id}/retranscribe`
- `PUT /api/tts/user/voices/{voice_id}/settings`

### User Voice Enabled

- `GET /api/tts/user/voices/enabled/{user_id}`
- `POST /api/tts/user/voices/enabled/{user_id}`
- `PUT /api/tts/user/voices/enabled/{user_id}/{voice_id}`

### Admin

- `GET /api/admin/voices`
- `POST /api/admin/voices/upload`
- `PUT /api/admin/voices/{voice_id}/settings`
- `DELETE /api/admin/voices/{voice_id}`
- `PUT /api/admin/voices/{voice_id}/rename`
- `POST /api/admin/voices/{voice_id}/retranscribe`
- `POST /api/admin/voices/{voice_id}/toggle`
- `GET /api/admin/stats`
- `GET /api/admin/system/status`
- `POST /api/admin/system/restart`

## Deprecated Endpoints

Deprecated headers are intentionally returned for one-release grace period:

- `DELETE /api/admin/legacy/voices/{voice_id}`
- `PUT /api/admin/legacy/voices/{voice_id}/settings`
- `PUT /api/admin/legacy/voices/{voice_id}/rename`

Headers:

- `Deprecation: true`
- `Sunset: Wed, 31 Dec 2026 23:59:59 GMT`
- `Link: </api/admin/voices>; rel="successor-version"`

## Compatibility Notes

- Keep request/response contracts backward-compatible for `bot_service` integration paths.
- If schema changes are required, release with deprecation headers first, then remove after a full warning release.

