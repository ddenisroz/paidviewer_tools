# VK Channel Points

Last updated: 2026-03-12

This document describes the current VK Live channel-points contract in this repository. Historical audit notes and intermediate migration details belong in `docs/backlog/`, not in the active docs set.

## Scope

- Backend owner: `bot_service`
- Frontend consumer: points management UI in `frontend`
- Upstream dependency: VK Live API through the authenticated user's VK token

Guest mode is removed. All channel-points management flows require an authenticated user session.

## Current Backend Surface

The active VK channel-points routes are implemented in `bot_service/api/points/vk_routes.py` and supporting VK API/service modules.

Expected capabilities:

- list rewards
- create reward
- update reward
- delete reward
- enable or disable reward
- list redemption demands
- accept demands
- reject demands

## Runtime Contract

- The user authenticates through `/auth/vk/login` and `/auth/vk/callback`.
- `bot_service` resolves the VK token from the database-backed user state.
- Requests use the current channel URL format: `https://live.vkvideo.ru/{channel_name}`.
- Channel-points routes are user-scoped. There is no guest or session-scoped fallback.

## Maintenance Rules

- Keep the frontend talking only to `bot_service`.
- Do not reintroduce `/auth/vk/guest/*` routes or guest verification flows.
- If VK API scopes, paths, or payloads change, update this document together with the code and tests in the same session.

