# Platform Abstraction Layer

This directory contains the platform abstraction layer that provides a unified interface for working with different streaming platforms (Twitch, VK Live, Kick, YouTube Live, etc.).

## Architecture

### Base Interface (`base.py`)

Defines the abstract `StreamingPlatform` class and `PlatformConfig` dataclass that all platform implementations must follow.

**Key Methods:**
- `authenticate(code)` - Handle OAuth authentication
- `get_user_info(access_token)` - Get user information
- `update_stream_title(user_id, title)` - Update stream title
- `update_stream_category(user_id, category_id)` - Update stream category
- `search_categories(query)` - Search for categories
- `get_stream_status(username)` - Get current stream status
- `get_channel_info(username)` - Get channel information
- `send_chat_message(user_id, message)` - Send chat message
- `create_reward(user_id, reward_data)` - Create channel points reward (optional)
- `update_reward(user_id, reward_id, reward_data)` - Update reward (optional)
- `delete_reward(user_id, reward_id)` - Delete reward (optional)
- `get_user_roles(username, channel_name)` - Get user roles (optional)

### Platform Registry (`registry.py`)

Central registry that manages all available platforms. Uses lazy initialization to avoid circular imports.

**Usage:**
```python
from platforms.registry import platform_registry

# Get a specific platform
platform = platform_registry.get('twitch')

# Get all platforms
all_platforms = platform_registry.get_all()

# Get platform configs for frontend
configs = platform_registry.get_configs()

# Check if platform is valid
is_valid = platform_registry.is_valid_platform('twitch')
```

### Platform Implementations

#### Twitch (`twitch.py`)
Wraps the existing `TwitchAPI` class to conform to the `StreamingPlatform` interface.

**Configuration:**
- Name: `twitch`
- Display Name: `Twitch`
- Color: `#9146FF`
- Supports: OAuth, Chat, TTS, Points, Categories

#### VK Live (`vk.py`)
Wraps the existing `VKLiveAPI` class to conform to the `StreamingPlatform` interface.

**Configuration:**
- Name: `vk`
- Display Name: `VK Live`
- Color: `#0077FF`
- Supports: OAuth, Chat, TTS, Points, Categories

**Note:** VK API requires user_id for most operations, so some methods have additional `*_for_user` variants.

## API Endpoints

### Platform Configuration (`api/platforms_api.py`)

**GET `/api/platforms/config`**
Returns configuration for all available platforms with their capabilities.

**GET `/api/platforms/list`**
Returns list of available platform names.

### Generic Platform Endpoints (`api/stream_info_api.py`)

**GET `/api/platforms/{platform_name}/categories?search=query`**
Search categories for any platform.

**POST `/api/platforms/{platform_name}/stream/update`**
Update stream title or category for any platform.

## Adding New Platforms

To add a new platform (e.g., Kick, YouTube Live):

1. Create a new file `platforms/kick.py`
2. Implement the `StreamingPlatform` interface:
```python
from .base import StreamingPlatform, PlatformConfig

class KickPlatform(StreamingPlatform):
    def __init__(self):
        config = PlatformConfig(
            name='kick',
            display_name='Kick',
            supports_oauth=True,
            supports_chat=True,
            supports_tts=True,
            supports_points=False,  # Kick doesn't have points
            supports_categories=True,
            color='#53FC18'
        )
        super().__init__(config)
    
    async def authenticate(self, code: str) -> Dict[str, Any]:
        # Implement Kick OAuth
        pass
    
    # Implement other required methods...
```

3. Register the platform in `registry.py`:
```python
def _register_platforms(self):
    # ... existing platforms ...
    
    try:
        from .kick import KickPlatform
        self.register(KickPlatform())
        logger.info("Registered Kick platform")
    except Exception as e:
        logger.error(f"Failed to register Kick platform: {e}")
```

4. The platform will automatically be available through:
   - Platform registry
   - Generic API endpoints
   - Frontend platform configuration

## Benefits

1. **Extensibility**: Easy to add new platforms without modifying existing code
2. **Consistency**: All platforms follow the same interface
3. **Maintainability**: Platform-specific logic is isolated
4. **Type Safety**: Clear contracts defined by abstract base class
5. **Frontend Integration**: Platform configs automatically exposed to frontend
6. **Backward Compatibility**: Existing platform APIs continue to work

## Migration Notes

The existing platform-specific APIs (`TwitchAPI`, `VKLiveAPI`) continue to work as before. The abstraction layer wraps them without breaking existing functionality.

Endpoints can gradually migrate to use the platform registry:
- Old: Direct import of `TwitchAPI` or `VKLiveAPI`
- New: Use `platform_registry.get('twitch')` or `platform_registry.get('vk')`

Generic endpoints (`/api/platforms/{platform_name}/*`) work with any registered platform automatically.
