# Configuration Migration Guide

## Overview

This guide explains how to migrate from `os.getenv()` calls to the centralized `settings` object from `core.config`.

## Benefits

- **Type Safety**: All settings have proper types and validation
- **Validation**: Settings are validated on startup
- **Documentation**: Each setting has a description
- **IDE Support**: Autocomplete and type hints
- **Centralized**: All configuration in one place
- **No Hardcoded Values**: All values come from environment variables

## Migration Pattern

### Before (Old Pattern)
```python
import os

# Scattered throughout codebase
twitch_client_id = os.getenv("TWITCH_CLIENT_ID")
database_url = os.getenv("DATABASE_URL", "sqlite:///./data/bot.db")
debug = os.getenv("DEBUG", "false").lower() == "true"
```

### After (New Pattern)
```python
from core.config import settings

# Type-safe, validated, documented
twitch_client_id = settings.twitch_client_id
database_url = settings.database_url
debug = settings.debug
```

## Common Replacements

| Old Code | New Code |
|----------|----------|
| `os.getenv("SECRET_KEY")` | `settings.secret_key` |
| `os.getenv("DATABASE_URL")` | `settings.database_url` |
| `os.getenv("TWITCH_CLIENT_ID")` | `settings.twitch_client_id` |
| `os.getenv("TWITCH_CLIENT_SECRET")` | `settings.twitch_client_secret` |
| `os.getenv("TWITCH_BOT_TOKEN")` | `settings.twitch_bot_token` |
| `os.getenv("VK_CLIENT_ID")` | `settings.vk_client_id` |
| `os.getenv("VK_CLIENT_SECRET")` | `settings.vk_client_secret` |
| `os.getenv("VK_LIVE_USER_TOKEN")` | `settings.vk_live_user_token` |
| `os.getenv("YOUTUBE_API_KEY")` | `settings.youtube_api_key` |
| `os.getenv("HUGGINGFACE_TOKEN")` | `settings.huggingface_token` |
| `os.getenv("TTS_SERVICE_URL")` | `settings.tts_service_url` |
| `os.getenv("BACKEND_URL")` | `settings.backend_url` |
| `os.getenv("FRONTEND_URL")` | `settings.frontend_url` |
| `os.getenv("ENVIRONMENT")` | `settings.environment` |
| `os.getenv("DEBUG")` | `settings.debug` |
| `os.getenv("LOG_LEVEL")` | `settings.log_level` |

## Files to Update

Run this command to find all files that need updating:
```bash
grep -r "os\.getenv(" bot_service/ --include="*.py"
```

## Example Migrations

See `main.py` for examples of migrated code.
