# Architecture Guide

## Overview

The project consists of three runtime zones:

- `frontend`: React + Vite UI.
- `bot_service`: FastAPI backend, auth, business logic, orchestration.
- `F5_tts`: advanced standalone-ready F5 TTS service.

The backend also integrates with external/local providers for Qwen and F5 where configured.

## TTS Model

Provider-aware advanced TTS now supports:

- `gcloud`: Google Cloud TTS (voice selection settings).
- `f5`: F5 provider (cloud/local mode).
- `qwen`: Qwen 3 provider (cloud/local mode).

If advanced synthesis fails, runtime falls back to basic Google TTS.

## Data and Ownership

- Primary runtime database: PostgreSQL.
- SQLite is test-only.
- Voice settings and usage are provider-aware.
- Local endpoint configs are separated by provider (`f5`, `qwen`).

## Service Boundaries

- `bot_service` is the control plane (permissions, whitelist, safety filters, queueing).
- `F5_tts` is an execution plane for F5 synthesis and voice operations.
- Qwen local/cloud endpoints are treated as external execution planes and called through `bot_service` integration endpoints.

## Deployment Notes

- Compose profiles support both integrated and split deployment strategies.
- Environment compatibility is preserved with `TTS_SERVICE_URL`, while provider-specific URLs are available:
  - `F5_TTS_SERVICE_URL`
  - `QWEN_TTS_SERVICE_URL`

## Repository Split Readiness

`F5_tts` is organized to be exported into a separate repository with minimal coupling.
See:

- `docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md`
- `docs/setup/REPO_SPLIT_GUIDE.md`
