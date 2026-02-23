# Operations Runbook

## Startup Checklist

1. Verify `.env` has no placeholder secrets.
2. Start `simple` or `advanced` profile.
3. Check `200` for `/health/live` and `/health/ready`.
4. Run one synthesis request through your client integration.

## Smoke Commands

```bash
curl -sS http://localhost:8001/health/live
curl -sS http://localhost:8001/health/ready
curl -sS http://localhost:8001/api/tts/voices
```

## Incident Guide

`/health/ready` returns `503`:

- Verify PostgreSQL and `DATABASE_URL`.
- Check model init logs.
- Check background tasks status.

Internal `401` between services:

- Verify JWT secret/issuer/audience/subject alignment.
- Verify `TTS_INTERNAL_API_KEY` only if fallback is enabled.

Latency or queue growth (advanced):

- Verify Redis health.
- Verify worker count and worker logs.
- Verify GPU saturation and task timeout metrics.

## Routine Maintenance

- Rotate internal auth secrets.
- Prune old logs and temporary audio artifacts.
- Validate backups and restore flow.
- Monitor p95/p99 latency and synthesis error rate.
