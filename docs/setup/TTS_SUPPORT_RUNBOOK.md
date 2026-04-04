# TTS Support Runbook

## `cloud_slot_required`

- Symptom: `GET /api/tts/status` returns `slot_allowed=false`.
- Action: move the user to `self_host` onboarding through the provisioning bundle flow.
- Do not manually force-enable cloud capacity for all providers as a support shortcut.

## `version_mismatch`

- Symptom: `tts_worker_agent` receives `409` on activation or poll.
- Action: compare the bundle `required_agent_version` with the locally installed agent version.
- Resolution: update the agent. Lower the required version only as a temporary rollback action if the new rollout is not yet fully deployed.

## `provider_unreachable`

- Symptom: `test-connection` or synthesis fails with upstream/connect timeout.
- Action: verify `endpoint_url`, `api_key`, runtime health, and local firewall/network path.
- For cloud mode: check `tts-gateway` plus the provider runtime.
- For self-host mode: check the user's local runtime and localhost diagnostics.

## `worker_offline`

- Symptom: the worker exists in the backend but is inactive or has not polled recently.
- Action: ask the user to open local diagnostics and restart `tts_worker_agent`.
- Verify provisioning bundle import, `worker_token`, agent version, and backend URL reachability.

## `voice_missing`

- Symptom: synthesis cannot resolve the requested voice.
- Action: verify provider, voice id/name, and runtime storage state.
- For Qwen, explicitly verify the persistent `QWEN_VOICE_STORAGE_DIR` volume.

## `vk_bot_auth_failed`

- Symptom: VK bot OAuth returns `access_denied`, `invalid_state`, `save_failed`, or `restart_failed`.
- Action:
  1. verify the state cookie and callback URL
  2. verify token persistence in backend storage
  3. verify that VK bot runtime was able to restart after callback
- `restart_failed` is not a successful auth outcome. Treat it as a separate bot-runtime incident.
