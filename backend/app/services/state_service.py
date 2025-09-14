import json
import logging
from pathlib import Path
import aiofiles
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger(__name__)

class StateService:
    def __init__(self):
        self._state_file_path = settings.BASE_DIR / "state.json"
        logger.info(f"Initializing State Service with state file: {self._state_file_path}")
        self.channels = {}
        # Создаем пустой файл если его нет
        if not self._state_file_path.exists():
            self._state_file_path.write_text("{}")
            logger.info("Created empty state.json file")
        logger.info("State file initialized with empty state")

    async def initialize(self):
        """Asynchronously load the initial state. Must be called after creation."""
        await self._load_state_from_disk()
        # Сохраняем пустое состояние, если файл был пустой
        if not self.channels:
            self.channels = {}
            logger.info("Initialized empty state")
        
        logger.info("State service initialized successfully")

    async def _load_state_from_disk(self):
        try:
            if self._state_file_path.exists():
                async with aiofiles.open(self._state_file_path, 'r') as f:
                    content = await f.read()
                    logger.info(f"State file content length: {len(content)}")
                    logger.info(f"State file content: {content[:200]}...")  # Первые 200 символов
                    if content.strip():  # Проверяем, что файл не пустой
                        self.channels = await run_in_threadpool(json.loads, content)
                        logger.info(f"Loaded state from {self._state_file_path}. Channels: {list(self.channels.keys())}")
                        logger.info(f"Channel data: {self.channels}")
                        await self._migrate_and_ensure_defaults()
                    else:
                        logger.info("State file is empty, starting with fresh state")
                        self.channels = {}
            else:
                logger.info("State file does not exist, starting with fresh state")
                self.channels = {}
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Could not load state from disk: {e}. Starting with a fresh state.")
            self.channels = {}

    async def _migrate_and_ensure_defaults(self):
        """
        Migrates old settings structure and ensures all default TTS settings are present.
        Now async.
        """
        defaults = {
            "read_emotes": False,
            "speed": 1.0,
            "cfg_strength": 2.0,
            "nfe_step": 32,
            "sway_sampling_coef": -1.0
        }
        updated = False
        for channel_name, channel_data in self.channels.items():
            if "integrations" not in channel_data:
                channel_data["integrations"] = {
                    "twitch_enabled": True,
                    "vk_enabled": False
                }
                updated = True
            
            # Ensure vk_enabled exists for older configs
            if "vk_enabled" not in channel_data.get("integrations", {}):
                channel_data["integrations"]["vk_enabled"] = False
                updated = True

            if "settings" in channel_data:
                user_settings = channel_data.pop("settings")
                channel_data["user_settings"] = user_settings
                updated = True
            if "default_settings" not in channel_data:
                channel_data["default_settings"] = defaults.copy()
                updated = True
            if "user_settings" not in channel_data:
                channel_data["user_settings"] = {}
                updated = True
        
        if updated:
            logger.info("Migrated and updated channel settings to new structure.")
            await self._save_state_to_disk()

    async def _save_state_to_disk(self):
        try:
            content = await run_in_threadpool(json.dumps, self.channels, indent=4)
            async with aiofiles.open(self._state_file_path, 'w') as f:
                await f.write(content)
        except IOError as e:
            logger.error(f"Could not save state to disk: {e}")

    def get_registered_channels(self):
        return list(self.channels.keys())

    def get_channel_data(self, channel_name: str):
        """Get data for a specific channel."""
        return self.channels.get(channel_name, {})

    def set_channel_data(self, channel_name: str, data: dict):
        """Set data for a specific channel."""
        self.channels[channel_name] = data
        # Сохраняем асинхронно
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Если мы в уже запущенном цикле, создаем задачу
                asyncio.create_task(self._save_state_to_disk())
            else:
                # Если цикл не запущен, запускаем его
                loop.run_until_complete(self._save_state_to_disk())
        except Exception as e:
            logger.error(f"Error saving state after channel update: {e}")

    async def register_channel(self, channel_name: str):
        if channel_name not in self.channels:
            self.channels[channel_name] = {
                "tts_enabled": True,  # Включаем TTS по умолчанию для новых каналов
                "bot_enabled": False,
                "integrations": {"twitch_enabled": True},
                "user_voices": {},
                "default_settings": {
                    "read_emotes": False,
                    "speed": 1.0,
                    "cfg_strength": 2.0,
                    "nfe_step": 32,
                    "sway_sampling_coef": -1.0
                },
                "user_settings": {}
            }
            logger.info(f"Registered new channel: {channel_name} with TTS enabled")
            await self._save_state_to_disk()

    async def unregister_channel(self, channel_name: str):
        if channel_name in self.channels:
            del self.channels[channel_name]
            logger.info(f"Unregistered channel: {channel_name}")
            await self._save_state_to_disk()

    def get_channel_state(self, channel_name: str):
        return self.channels.get(channel_name)

    def is_tts_enabled(self, channel_name: str) -> bool:
        state = self.get_channel_state(channel_name)
        return state.get("tts_enabled", False) if state else False

    async def set_tts_enabled(self, channel_name: str, enabled: bool):
        state = self.get_channel_state(channel_name)
        if state:
            state["tts_enabled"] = enabled
            await self._save_state_to_disk()

    def get_bot_enabled_state(self, channel_name: str) -> bool:
        channel_state = self.channels.get(channel_name, {})
        return channel_state.get("bot_enabled", False)

    async def set_bot_enabled_state(self, channel_name: str, is_enabled: bool):
        if channel_name not in self.channels:
            await self.register_channel(channel_name)
        self.channels[channel_name]["bot_enabled"] = is_enabled
        await self._save_state_to_disk()

    def get_integrations(self, channel_name: str) -> dict:
        state = self.get_channel_state(channel_name)
        return state.get("integrations", {"twitch_enabled": False}) if state else {"twitch_enabled": False}

    async def set_twitch_integration(self, channel_name: str, enabled: bool):
        state = self.get_channel_state(channel_name)
        if state:
            if "integrations" not in state:
                state["integrations"] = {}
            state["integrations"]["twitch_enabled"] = enabled
            await self._save_state_to_disk()
            logger.info(f"Twitch integration for '{channel_name}' set to {enabled}")

    async def set_vk_integration(self, channel_name: str, enabled: bool):
        """Sets the state of the VK integration for a channel."""
        state = self.get_channel_state(channel_name)
        if state:
            if "integrations" not in state:
                state["integrations"] = {}
            state["integrations"]["vk_enabled"] = enabled
            await self._save_state_to_disk()
            logger.info(f"VK integration for '{channel_name}' set to {enabled}")

    def get_all_channels(self) -> list[str]:
        return list(self.channels.keys())

    def get_channel_settings(self, channel_name: str) -> dict:
        state = self.get_channel_state(channel_name)
        if not state:
            raise ValueError(f"Channel '{channel_name}' not found.")
        
        default_settings = state.get("default_settings", {})
        user_settings = state.get("user_settings", {})
        combined_settings = {**default_settings, **user_settings}
        return combined_settings

    async def update_channel_settings(self, channel_name: str, new_settings: dict):
        state = self.get_channel_state(channel_name)
        if not state:
            raise ValueError(f"Channel '{channel_name}' not found.")
        
        if "user_settings" not in state:
            state["user_settings"] = {}
            
        state["user_settings"].update(new_settings)
        await self._save_state_to_disk()

    async def reset_channel_settings(self, channel_name: str):
        state = self.get_channel_state(channel_name)
        if not state:
            raise ValueError(f"Channel '{channel_name}' not found.")
        
        state["user_settings"] = {}
        await self._save_state_to_disk()
        logger.info(f"Reset settings for channel: {channel_name}")

    def get_user_voice(self, channel_name: str, user_name: str) -> str:
        """Get the user's preferred voice for a channel."""
        state = self.get_channel_state(channel_name)
        if not state:
            return None
        
        user_voices = state.get("user_voices", {})
        return user_voices.get(user_name.lower(), None)

    def set_user_voice(self, channel_name: str, user_name: str, voice_name: str):
        """Set the user's preferred voice for a channel."""
        state = self.get_channel_state(channel_name)
        if not state:
            logger.warning(f"Channel '{channel_name}' not found when setting user voice.")
            return
        
        if "user_voices" not in state:
            state["user_voices"] = {}
        
        state["user_voices"][user_name.lower()] = voice_name
        # Note: this is sync, we should make it async later for consistency
        # For now, we'll save immediately
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If in async context, schedule the save
                asyncio.create_task(self._save_state_to_disk())
            else:
                # If not in async context, run sync
                loop.run_until_complete(self._save_state_to_disk())
        except RuntimeError:
            # No event loop, create one
            asyncio.run(self._save_state_to_disk())
        
        logger.info(f"Set voice '{voice_name}' for user '{user_name}' in channel '{channel_name}'")


# state_service_instance = StateService()
