"""Platform constants for TTS bot service.

This module defines platform-related constants to avoid hardcoded values.
"""

# Default platforms enabled for new users
DEFAULT_ENABLED_PLATFORMS = ["twitch", "vk"]

# All supported platforms
SUPPORTED_PLATFORMS = ["twitch", "vk", "youtube"]

# Platform display names
PLATFORM_NAMES = {
    "twitch": "Twitch",
    "vk": "VK Live",
    "youtube": "YouTube"
}
