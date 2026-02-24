# Architecture Guide

## Overview

The project consists of three runtime zones:

- `frontend`: React + Vite UI.
- `bot_service`: FastAPI backend, auth, business logic, orchestration.
- external `f5-tts-service`: advanced F5 TTS execution service.

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
- `f5-tts-service` is an execution plane for F5 synthesis and voice operations.
- Qwen local/cloud endpoints are treated as external execution planes and called through `bot_service` integration endpoints.

## Deployment Notes

- Compose profiles support both integrated and split deployment strategies.
- Provider endpoints are explicit:
  - `F5_TTS_SERVICE_URL` (F5 provider endpoint)
  - `QWEN_TTS_SERVICE_URL` (Qwen provider endpoint)

## Repository Split Readiness

F5 TTS is extracted into a separate repository with minimal coupling.
See:

- `docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md`
- `docs/setup/REPO_SPLIT_GUIDE.md`
