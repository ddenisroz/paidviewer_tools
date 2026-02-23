# Project Context

This document gives automation agents a compact, current snapshot of the repository.

## Current TTS Direction

- Advanced provider model is provider-aware and includes:
  - `gcloud` (Google Cloud TTS)
  - `f5` (advanced F5 provider)
  - `qwen` (Qwen 3 TTS provider)
- Basic Google TTS remains the fallback path when advanced synthesis fails.
- Local provider endpoints are supported for both `f5` and `qwen`.

## Repository Naming

- Advanced TTS service source directory is `F5_tts/`.
- Legacy root directory `tts_service/` has been removed.
- Docker compose files may still use legacy service-name aliases (`tts_service`) for network compatibility.

## Database Policy

- Production/runtime database is PostgreSQL.
- SQLite is allowed only in explicit test contexts.

## Key Integration Rules

- Qwen and F5 local/cloud mode selection is provider-specific.
- Google Cloud keeps voice selection controls.
- Whitelist and bot-service safety controls apply to advanced providers.

## Useful Docs

- `docs/setup/REPO_SPLIT_GUIDE.md`
- `docs/setup/F5_TTS_EXTRACTION_CHECKLIST.md`
- `docs/setup/LOCAL_TTS_INTEGRATION.md`
- `docs/architecture/TTS_ARCHITECTURE.md`
