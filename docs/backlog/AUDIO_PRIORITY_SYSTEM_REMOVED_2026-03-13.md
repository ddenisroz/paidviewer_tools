# Audio Priority System (Removed)

## Status

Removed from frontend runtime and settings UI.

## Removal Date

February 8, 2026.

## What Changed

- The "Audio Priority" block was removed from `SettingsPage`.
- TTS playback no longer sends pause/resume commands to YouTube.
- YouTube player no longer listens for `audio_priority_change` events.
- `AudioPriorityContext` provider/hook were removed from the app.

## Current Behavior

- TTS and YouTube run independently.
- In `listening_mode = website`, audio is controlled only by `TTS Player` tab logic.
- In `listening_mode = obs`, browser TTS playback remains suppressed as before.
