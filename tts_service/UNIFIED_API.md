# TTS Service Unified API

This document defines the unified API contract that both TTS Service and TTS Service Simple must implement.

## API Contract

### 1. Health Check
```
GET /health
Response: {
  "status": "healthy" | "error",
  "engine_info": {
    "type": "f5_tts" | "simple",
    "version": string,
    "mode": "advanced" | "local"
  },
  "timestamp": float
}
```

### 2. Synthesize Speech
```
POST /api/tts/synthesize-channel
Request: {
  "channel_name": string,
  "text": string,
  "author": string,
  "user_id": int (optional),
  "volume_level": int (default: 50),
  "tts_settings": {
    "voice": string (optional),
    "enable7TV": bool,
    "enableTwitch": bool,
    "enableProfanity": bool,
    "maxLength": int,
    "skipCommands": bool
  },
  "word_filter": string[],
  "blocked_users": string[]
}

Response: {
  "success": bool,
  "audio_url": string (optional),
  "voice": string (optional),
  "volume": int (optional),
  "tts_type": "f5" | "local_f5",
  "duration": float (optional),
  "channel": string (optional),
  "author": string (optional),
  "error": string (optional)
}
```

### 3. Get Voices
```
GET /api/voices
Response: {
  "voices": [
    {
      "id": string,
      "name": string,
      "type": "base" | "custom" | "global",
      "language": string
    }
  ]
}
```

### 4. Get Global Voices
```
GET /voices/global
Response: {
  "voices": [
    {
      "id": int,
      "name": string,
      "voice_type": "global",
      "file_path": string,
      "reference_text": string,
      "cfg_strength": float,
      "speed_preset": string,
      "created_at": string (ISO format)
    }
  ]
}
```

### 5. Get User Voices
```
GET /user/voices/{user_id}
Response: [
  {
    "id": int,
    "name": string,
    "voice_type": "user",
    "owner_id": int,
    "file_path": string,
    "is_public": bool,
    "created_at": string (ISO format)
  }
]
```

### 6. Upload Voice (Optional - TTS Service only)
```
POST /user/voices/upload
Request: multipart/form-data
  - file: audio file
  - voice_name: string
  - user_id: int

Response: {
  "success": bool,
  "message": string,
  "voice_id": int,
  "voice_name": string
}
```

## Implementation Notes

### TTS Service (Advanced - F5-TTS)
- Centralized voice storage for all users
- Admin can upload global voices
- Users can upload personal voices
- GPU-accelerated synthesis
- Supports voice cloning

### TTS Service Simple (Local - F5-TTS)
- User-specific voice storage (`voices/user_{user_id}/`)
- Can download global voice packs
- Same F5-TTS engine
- Local deployment on user's PC
- Privacy-focused (voices stored locally)

### Bot Service Integration
- Bot Service doesn't care which TTS service is used
- Configured via `TTS_SERVICE_URL` environment variable
- Automatic health checks before synthesis
- Retry logic with exponential backoff
- Connection-based TTS generation control

## Compatibility

Both services implement the same API, allowing Bot Service to work with either:
- TTS Service (for shared hosting, multiple streamers)
- TTS Service Simple (for personal use, privacy)

The choice is made via environment configuration, not code changes.
