# Chrome MCP TTS Test Agent

Internal guide for live browser checks through Chrome DevTools MCP.
This is not a product doc for end users. It is a short runbook for finding runtime bugs that static code reading will miss.

## Main Goal

Prioritize issues in this order:

1. TTS synthesis and playback
2. Voice management
3. Provider and mode switching
4. Admin runtime controls that affect TTS
5. UI/runtime regressions that block the main scenario

## What Counts As A Real Bug

Focus on observable runtime evidence:

- wrong frontend request shape
- broken backend/frontend contracts
- false `healthy` or false success states
- silent fallback to the wrong provider
- hanging preview/upload/test voice flows
- broken `cloud` / `self_host` switching
- broken audio fetch or playback in `/tts-player`
- admin/TTS actions that look successful but are not

Do not infer success from a toast alone. Confirm with network, console, DOM, and actual audio fetch behavior.

## Hard Rules

- Do not start, stop, or restart services unless the user explicitly asks.
- Do not delete voices, tokens, channels, or user settings without direct approval.
- Do not treat an unavailable frontend as a frontend bug by default. It may be an environment blocker.
- Do not invent causes when runtime is unavailable. Record the blocker first.

## Read Before Running

1. `docs/PROJECT_CONTEXT.md`
2. `AGENTS.md`
3. `docs/architecture/TTS_ARCHITECTURE.md`
4. `docs/setup/LIVE_SMOKE_RUNBOOK.md`

## Main Routes

- Product:
  - `/dashboard/tts`
  - `/dashboard/tts/voices`
  - `/tts-player`
- Admin:
  - `/dashboard/admin?tab=overview`
  - `/dashboard/admin?tab=runtime`
  - `/dashboard/admin?tab=tts`
  - `/dashboard/admin?tab=accounts`
  - `/dashboard/admin?tab=channels`
  - `/dashboard/admin?tab=logs`

## Priority Checks

### P0. TTS Path

Always verify:

- provider switching
- `cloud` / `self_host`
- preview/test voice
- actual audio playback
- absence of false fallback to `gtts`

Success means:

- synth/test request returns `200`
- backend returns a valid `audio_url`
- browser actually requests the audio URL
- audio request does not fail with `401/403/404/5xx`
- UI status matches what happened
- the real provider matches the selected one

Bug examples:

- synth is `200`, but audio fetch fails
- UI says success, but no audio request was made
- selected `qwen` or `f5`, but runtime fell back elsewhere
- `self_host` is selectable while the worker/runtime is clearly unavailable
- health says healthy while live synth hangs or fails

### P1. Voice Management

Check:

- provider-specific voice lists
- admin/global voices
- user voices
- upload
- rename
- settings edit
- preview/test
- retranscribe if available

For `qwen`, separately verify:

- runtime model list matches what is actually usable
- sample voices survive model changes
- warmup/model-loading errors are readable and fail fast

### P2. Admin Runtime Controls

Secondary to TTS, but still important if they affect the main path:

- bot OAuth status
- bot runtime status
- channel status
- logs
- worker status

## Required Live Order

### 1. Frontend Availability

Before deeper checks:

- open the current page
- if you see `ERR_CONNECTION_REFUSED`, `chrome-error://chromewebdata/`, or a blank page:
  - record it as an environment blocker
  - stop treating later failures as pure frontend bugs

### 2. Auth

If a user session is needed:

- use the existing login state
- if login is missing, wait for the user to authenticate
- do not guess credentials

### 3. `/dashboard/tts`

Minimum checks:

- provider switch
- `cloud` / `self_host`
- model list for `qwen`
- self-host availability only when runtime is actually available
- no false success or silent rollback

### 4. `/tts-player`

Confirm:

- the route opens normally
- in website mode, audio really arrives there
- successful generation does not end in silent playback failure

### 5. Admin TTS Screen

Route:

- `/dashboard/admin?tab=tts`

Check:

- provider switch
- user/global voice lists
- upload
- preview/test
- settings modal
- rename
- retranscribe when supported

## What To Inspect In DevTools

### DOM / Snapshot

Use for:

- real button text and status labels
- confirming the right UI version loaded
- broken layout only when it blocks the scenario

### Console

Look for:

- uncaught exceptions
- React errors
- failed audio play promises
- runtime warnings that explain a broken flow

### Network

This is the main source of truth.

For any suspicious case, record:

- URL
- method
- status
- request payload
- response payload
- hanging requests
- duplicate requests
- request order such as `test -> audio_url fetch -> playback`

Prioritize:

- `/api/tts/*`
- `/api/voices/*`
- `/api/admin/*`
- `/audio/*`
- playback URLs returned by backend/gateway

## How To Report Findings

For each bug, record:

1. where it reproduces
2. what was expected
3. what actually happened
4. which requests or console errors prove it
5. whether it is frontend, backend, or contract mismatch

Example:

- `Qwen preview` fails in admin TTS screen
- reproduced on `/dashboard/admin?tab=tts`
- `POST /api/voices/2/test?provider=qwen` returns `504`
- the earlier lookup route hangs too long
- this is a runtime/backend problem, not a pure UI problem

## When A Code Fix Is Justified

Only propose a code fix when runtime evidence is strong enough:

- there is a failing request, console stack, or clear broken contract
- the failing layer is identifiable
- the issue is not just an environment outage

## Minimum Smoke Check After A Fix

Repeat the exact failing flow and confirm:

1. the page still opens
2. the original failure is gone
3. requests are now correct
4. the UI no longer lies about the result
5. no nearby regression appeared
