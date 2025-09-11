import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class StateService:
    _instance = None
    _state_file_path = Path(__file__).resolve().parent.parent.parent / "state.json"

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(StateService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, 'initialized'):
            return
        logger.info("Initializing State Service...")
        self.channels = {}
        self._load_state_from_disk()
        self.initialized = True
        
    def _load_state_from_disk(self):
        try:
            if self._state_file_path.exists():
                with open(self._state_file_path, 'r') as f:
                    self.channels = json.load(f)
                logger.info(f"Loaded state from {self._state_file_path}. Channels: {list(self.channels.keys())}")
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Could not load state from disk: {e}. Starting with a fresh state.")
            self.channels = {}

    def _save_state_to_disk(self):
        try:
            with open(self._state_file_path, 'w') as f:
                json.dump(self.channels, f, indent=4)
        except IOError as e:
            logger.error(f"Could not save state to disk: {e}")

    def get_registered_channels(self):
        return list(self.channels.keys())

    def register_channel(self, channel_name: str):
        if channel_name not in self.channels:
            self.channels[channel_name] = {
                "tts_enabled": False,
                "volume": 0.5,
                "queue": []
            }
            logger.info(f"Registered new channel: {channel_name}")
            self._save_state_to_disk()

    def unregister_channel(self, channel_name: str):
        if channel_name in self.channels:
            del self.channels[channel_name]
            logger.info(f"Unregistered channel: {channel_name}")
            self._save_state_to_disk()

    def get_channel_state(self, channel_name: str):
        return self.channels.get(channel_name)

    def is_tts_enabled(self, channel_name: str) -> bool:
        state = self.get_channel_state(channel_name)
        return state["tts_enabled"] if state else False

    def set_tts_enabled(self, channel_name: str, enabled: bool):
        state = self.get_channel_state(channel_name)
        if state:
            state["tts_enabled"] = enabled
            self._save_state_to_disk()

    def get_volume(self, channel_name: str) -> float:
        state = self.get_channel_state(channel_name)
        return state["volume"] if state else 0.5

    def set_volume(self, channel_name: str, volume: float):
        state = self.get_channel_state(channel_name)
        if state:
            state["volume"] = max(0.0, min(1.0, volume))
            self._save_state_to_disk()

    def get_queue(self, channel_name: str) -> list:
        state = self.get_channel_state(channel_name)
        return state["queue"] if state else []

    def add_to_queue(self, channel_name: str, item):
        state = self.get_channel_state(channel_name)
        if state:
            state["queue"].append(item)
            # No need to save state for queue changes as it's ephemeral
    
    def get_next_in_queue(self, channel_name: str):
        queue = self.get_queue(channel_name)
        return queue.pop(0) if queue else None

    def clear_queue(self, channel_name: str):
        state = self.get_channel_state(channel_name)
        if state:
            state["queue"].clear()
            logger.info(f"Queue cleared for channel {channel_name}")

state_service_instance = StateService()
