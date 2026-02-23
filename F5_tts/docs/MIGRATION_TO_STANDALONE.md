# Migration To Standalone Repository

Last updated: 2026-02-23

## Goal

Move `F5_tts` out of monorepo into dedicated repository `f5-tts-service` with no integration regressions.

## Step 1. Freeze Interface

Before cutover:

1. Freeze `F5_tts` public contracts used by `bot_service`.
2. Keep compatibility aliases (`/health`, `/api/health`) during migration window.
3. Keep legacy auth fallback key during migration window.

## Step 2. Export Service

From monorepo root:

```powershell
.\scripts\dev\prepare_f5_tts_export.ps1 -OutputDir artifacts/f5-tts-service -FlatLayout
```

Result: export bundle ready for direct push to a new repo.

## Step 3. Bootstrap New Repo

1. Create empty repository `f5-tts-service`.
2. Copy export bundle contents to repository root.
3. Configure secrets and environment values.
4. Run CI and smoke checks.

## Step 4. Parallel Deploy

1. Deploy standalone `f5-tts-service` in parallel.
2. Validate:
   - `/health/live`
   - `/health/ready`
   - voice endpoints
   - synthesis flow through `bot_service`

## Step 5. Switch Traffic

1. Update `bot_service`:
   - `TTS_SERVICE_URL`
   - `F5_TTS_SERVICE_URL`
2. Restart `bot_service`.
3. Monitor errors/latency for at least 24 hours.

## Step 6. Rollback Plan

If issues appear:

1. Revert `TTS_SERVICE_URL`/`F5_TTS_SERVICE_URL` to previous deployment.
2. Restart `bot_service`.
3. Keep standalone service running for diagnostics.

## Step 7. Finalize

After stable window:

1. Remove duplicated runtime deployment from monorepo.
2. Keep shared contract docs in sync between repos.

