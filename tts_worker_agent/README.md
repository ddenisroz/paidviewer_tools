# Paidviewer TTS Worker Agent

Backend-only worker agent for the new TTS control plane.

What it does:

1. Activates itself with a one-time pairing code from `bot_service`
2. Long-polls `/api/worker-agent/poll`
3. Runs local F5 or Qwen synthesis
4. Sends audio back through `/api/worker-agent/jobs/{job_id}/complete`

This phase does not require any frontend changes.

## Quick Start

1. Copy `config.example.json` to `config.json`
2. Put your backend URL and pairing code into `config.json`
3. Configure local F5 and/or Qwen endpoint URLs
4. Install dependencies:

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

5. Start the agent:

```powershell
.venv\Scripts\python.exe .\main.py --config .\config.json
```

Or run `install-agent.ps1` to register a Windows Scheduled Task.

## Local Provider Expectations

- F5 runtime: `POST /api/tts/synthesize-channel`
- Qwen runtime: `POST /api/prepare` then `GET /api/stream/{stream_id}`

## Pairing

Get a one-time pairing code from `bot_service`:

```powershell
Invoke-RestMethod -Method POST `
  -Uri http://127.0.0.1:8000/api/tts/workers/pairing-tokens `
  -WebSession $session `
  -Headers @{ "X-CSRF-Token" = $csrfToken } `
  -ContentType "application/json" `
  -Body '{"label_hint":"My PC","provider_hint":"both"}'
```

Paste the returned `pairing_code` into `config.json`, then start the agent.
