# Release Checklist

## Before deploy

- pinned `BOT_SERVICE_IMAGE`, `FRONTEND_IMAGE`, `TTS_GATEWAY_IMAGE`, `F5_TTS_IMAGE`, `QWEN_TTS_IMAGE` are set
- `docker-compose.prod.yml` validates and contains no host-port conflicts
- migrations apply without manual patching
- `VK Live` is marked `beta`, while `Twitch` remains the primary GA platform

## Env contract

- `BACKEND_URL`, `FRONTEND_URL`, `DATABASE_URL`, `REDIS_URL` are filled in for the target environment
- `TTS_GATEWAY_URL`, `TTS_GATEWAY_API_KEY`, `F5_TTS_SERVICE_URL`, `F5_TTS_SERVICE_API_KEY`, `QWEN_TTS_SERVICE_URL` are set
- `BOT_SERVICE_IMAGE` and `FRONTEND_IMAGE` point to release images, not local `build:` paths
- `tts_worker_agent_required_version` and `tts_worker_agent_recommended_version` are configured

## Regression gate

- full backend `pytest` is green
- `frontend` `npm run type-check` is green
- `frontend` `npm run test:run` is green
- `frontend` `npm run build` is green

## Smoke order

1. `cloud x f5`
2. `cloud x qwen`
3. `self_host x f5 via tts_worker_agent`
4. `self_host x qwen via tts_worker_agent`
5. `drops duplicate-event/session-boundary`
6. `youtube next/skip/reorder`
7. `vk bot OAuth beta flow`

## Demo gate

- image set is pinned before the demo build is frozen
- `f5-tts-service` dirty state is explicitly confirmed before freezing demo images
- the full staging walkthrough succeeds twice in a row without restart or manual cleanup

## Rollback

- roll back pinned images to the previous tested tags/digests
- roll back the release image set as a whole; do not mix old `core` images with new `cloud-tts` images
- if the issue is isolated to the self-host agent, roll back the required/recommended agent version and temporarily rely on the compatibility path only for support

## Known issues

- raw endpoint mode remains compatibility-only and is not the primary UX
- `VK Live` stays beta-tier and may expose fewer badges/moderation capabilities than Twitch
- large legacy frontend screens still need a separate tech-debt refactor sprint after release
