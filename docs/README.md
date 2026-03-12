# Documentation Index

This page separates current source-of-truth docs from historical notes.

## Source Of Truth (Read First)

1. `QUICKSTART.md` - local bootstrap and first run.
2. `STATUS_TRACKER.md` - current delivery status, verified work, blockers, and handoff notes.
3. `PROJECT_CONTEXT.md` - compact current-state snapshot for agents.
4. `REPO_STRUCTURE.md` - what is product code vs generated noise.
5. `architecture/ARCHITECTURE_GUIDE.md` - current architecture contracts.
6. `setup/LOCAL_TTS_INTEGRATION.md` - active TTS runtime contract and upstream runbook.
7. `setup/LIVE_SMOKE_RUNBOOK.md` - pre-testing checklist, topology matrix, and first live smoke order.
8. `setup/LIVE_SMOKE_BEGINNER_GUIDE_RU.md` - simplified Russian step-by-step guide for the first smoke run.
9. `setup/REPO_SPLIT_GUIDE.md` - repository boundary and split plan.
10. `setup/DOCKER_DEPLOYMENT.md` - current compose entrypoints and container scenarios.
11. `setup/DEPLOYMENT.md` - current deployment summary and runtime contract.
12. `guides/DEVELOPER_ONBOARDING.md` - developer setup and first contribution.
13. `guides/DEVELOPER_GUIDE.md` - coding contracts and non-negotiable rules.

## Root-Level Rule

Only these files should stay at the root of `docs/`:

- `README.md`
- `QUICKSTART.md`
- `PROJECT_CONTEXT.md`
- `REPO_STRUCTURE.md`
- `STATUS_TRACKER.md`

Older summary files and historical notes belong in `docs/backlog/`.

## Topic Folders

- `setup/` - deployment, infra, environment contracts.
- `architecture/` - auth, websocket, caching, roles, TTS architecture.
- `features/` - feature-level behavior and constraints.
- `guides/` - operational and developer guides.
- `api/` - API references.

## Historical / Non-Authoritative

- `backlog/` contains historical audits, temporary plans, and point-in-time notes.
- Files in `backlog/` are not release source of truth.
- If a backlog note becomes relevant, rewrite it into one of the active folders.

## Hygiene Rule

- If a doc contains obsolete file paths, removed endpoints, or mojibake text, it must be rewritten or moved to `backlog/`.
