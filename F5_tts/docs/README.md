# F5_tts Service Docs

This folder contains standalone documentation for extracting and operating the `F5_tts` service as an independent repository.

## Documents

- `API_CONTRACT.md` - external API surface, compatibility guarantees, auth model.
- `DEPLOYMENT.md` - local run, Docker run, standalone compose profiles.
- `RUNBOOK.md` - production operations, smoke checks, troubleshooting.
- `MIGRATION_TO_STANDALONE.md` - step-by-step extraction and cutover plan.

## Scope

`F5_tts` is the synthesis and voice-management backend for F5 provider flows.

Out of scope:
- Google Cloud TTS runtime behavior.
- Qwen provider runtime behavior.
- Frontend routing and UI orchestration logic.

