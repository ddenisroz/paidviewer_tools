# Operations Runbook

Last updated: 2026-02-23

## Startup Checklist

1. Confirm env file values are non-placeholder.
2. Start stack (`simple` or `advanced` profile).
3. Verify:
   - `/health/live` returns 200.
   - `/health/ready` returns 200.
4. Run one synthesis smoke request via `bot_service`.

## Smoke Checks

### Service health

```bash
curl -sS http://localhost:8001/health/live
curl -sS http://localhost:8001/health/ready
```

### Voice listing

```bash
curl -sS http://localhost:8001/api/tts/voices
```

### Synthesis request

Use `bot_service` integration path (`/api/tts/synthesize`) to validate full chain.

## Incident Playbook

### `503` on `/health/ready`

Check components in response payload:

- `database=error`: verify PostgreSQL availability and `DATABASE_URL`.
- `tts_engine=not_ready|error`: inspect startup logs and model cache path.
- `background_tasks=not_running|error`: inspect task scheduler startup logs.

### Auth failures (`401`) on internal calls

Check:

- service JWT secret/issuer/audience alignment between services.
- fallback key alignment (`TTS_INTERNAL_API_KEY`) if still enabled.

### Queue/latency degradation (advanced mode)

Check:

- Redis health.
- worker process count.
- GPU resource saturation and worker timeouts.

## Routine Maintenance

- Rotate internal auth secrets.
- Prune old audio artifacts and logs.
- Validate backups and restore path.
- Track p95/p99 latency and synthesis error rate.

