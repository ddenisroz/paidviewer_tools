# Paidviewer TTS Worker Agent

`tts_worker_agent` is the official self-host runtime for Paidviewer.

## Production role

- `cloud` mode: `frontend -> bot_service -> tts-gateway -> provider runtime`
- `self_host` mode: `frontend -> bot_service provisioning/pairing -> tts_worker_agent -> local F5/Qwen runtime`

The agent is the main self-host path for end users. Manual raw endpoint wiring is compatibility-only and should be used only for support/dev recovery.

## What the agent does

1. Imports a provisioning bundle from Paidviewer.
2. Activates itself with a one-time pairing code.
3. Polls `bot_service` for jobs.
4. Sends synthesis to the local F5 or Qwen runtime.
5. Uploads the generated audio/result back to `bot_service`.

## Quick start

1. Open `Local TTS` in Paidviewer.
2. Use the worker-agent pairing flow and download `paidviewer-worker-provisioning-*.json`.
3. Install the agent:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

4. Run the installer or the agent directly:

```powershell
.\install-agent.ps1
```

or

```powershell
.venv\Scripts\python.exe .\main.py --config .\config.json
```

On first run the agent looks for the newest provisioning bundle in the agent directory and then in `Downloads`.

## Local diagnostics

- `GET http://127.0.0.1:46321/health`
- `GET http://127.0.0.1:46321/diagnostics`

Typical codes:

- `version_mismatch`
- `provider_unreachable`
- `auth_failed`
- `model_not_ready`
- `voice_missing`

## Local provider expectations

- F5 runtime: `POST /api/tts/synthesize-channel`
- Qwen runtime: `POST /api/prepare` then `GET /api/stream/{stream_id}`

## Security notes

- On Windows the agent stores pairing/token/provider secrets using DPAPI best-effort protection.
- Provisioning bundles carry the required/recommended agent version.
- Activation and polling are rejected when the installed agent is older than the required server contract.

## Support boundary

- Main user contract: provisioning bundle + pairing + worker agent.
- Legacy raw endpoint mode is not the primary UX and should not be presented as the default production setup.
