# bot_service/connection_manager.py
import logging
import time
from typing import Dict, Set
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.obs_connections: Dict[str, WebSocket] = {}
        self.tts_enabled_channels: Set[str] = set()
        self.blocked_bots: Set[str] = set()
        self.youtube_queues: Dict[str, list] = {}
        self.current_videos: Dict[str, dict] = {}
        
        # Кэш для Twitch API
        self.twitch_cache = {
            'categories': {},
            'streams': {},
            'last_update': 0
        }
        
        # Кэш для YouTube API
        self.youtube_cache = {
            'videos': {},
            'last_update': 0
        }

    @property
    def connected_users(self):
        """Возвращает список активных соединений для совместимости"""
        return self.active_connections

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connection established for user {user_id}")

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].close()
            except Exception as e:
                logger.warning(f"Error closing WebSocket for user {user_id}: {e}")
            del self.active_connections[user_id]
            logger.info(f"WebSocket connection closed for user {user_id}")

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
            except WebSocketDisconnect:
                await self.disconnect(user_id)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")

    async def broadcast(self, message: str):
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except WebSocketDisconnect:
                await self.disconnect(user_id)
            except Exception as e:
                logger.error(f"Error broadcasting message to user {user_id}: {e}")

    # OBS connections
    async def connect_obs(self, websocket: WebSocket, token: str):
        await websocket.accept()
        self.obs_connections[token] = websocket
        logger.info(f"OBS WebSocket connection established for token {token}")

    async def disconnect_obs(self, token: str):
        if token in self.obs_connections:
            try:
                await self.obs_connections[token].close()
            except Exception as e:
                logger.warning(f"Error closing OBS WebSocket for token {token}: {e}")
            del self.obs_connections[token]
            logger.info(f"OBS WebSocket connection closed for token {token}")

    async def send_obs_message(self, message: str, token: str):
        if token in self.obs_connections:
            try:
                await self.obs_connections[token].send_text(message)
            except WebSocketDisconnect:
                await self.disconnect_obs(token)
            except Exception as e:
                logger.error(f"Error sending OBS message to token {token}: {e}")

    # TTS management
    def enable_tts(self, channel_name: str):
        self.tts_enabled_channels.add(channel_name.lower())
        logger.info(f"TTS enabled for channel: {channel_name}")

    def disable_tts(self, channel_name: str):
        self.tts_enabled_channels.discard(channel_name.lower())
        logger.info(f"TTS disabled for channel: {channel_name}")

    def is_tts_enabled(self, channel_name: str) -> bool:
        return channel_name.lower() in self.tts_enabled_channels

    # Bot management
    def add_blocked_bot(self, bot_name: str):
        self.blocked_bots.add(bot_name.lower())
        logger.info(f"Bot blocked: {bot_name}")

    def remove_blocked_bot(self, bot_name: str):
        self.blocked_bots.discard(bot_name.lower())
        logger.info(f"Bot unblocked: {bot_name}")

    def is_bot_blocked(self, bot_name: str) -> bool:
        return bot_name.lower() in self.blocked_bots

    # YouTube queue management
    def add_to_youtube_queue(self, user_id: str, video_data: dict):
        if user_id not in self.youtube_queues:
            self.youtube_queues[user_id] = []
        self.youtube_queues[user_id].append(video_data)
        logger.info(f"Video added to queue for user {user_id}: {video_data.get('title', 'Unknown')}")

    def get_youtube_queue(self, user_id: str) -> list:
        return self.youtube_queues.get(user_id, [])

    def clear_youtube_queue(self, user_id: str):
        if user_id in self.youtube_queues:
            self.youtube_queues[user_id] = []
            logger.info(f"YouTube queue cleared for user {user_id}")

    def set_current_video(self, user_id: str, video_data: dict):
        self.current_videos[user_id] = video_data
        logger.info(f"Current video set for user {user_id}: {video_data.get('title', 'Unknown')}")

    def get_current_video(self, user_id: str) -> dict:
        return self.current_videos.get(user_id, {})

    def next_youtube_video(self, user_id: str):
        if user_id in self.youtube_queues and self.youtube_queues[user_id]:
            next_video = self.youtube_queues[user_id].pop(0)
            self.set_current_video(user_id, next_video)
            return next_video
        return None

    # Cache management
    def update_twitch_cache(self, key: str, data: dict):
        self.twitch_cache[key] = data
        self.twitch_cache['last_update'] = time.time()

    def get_twitch_cache(self, key: str, max_age: int = 300):
        if key in self.twitch_cache:
            if time.time() - self.twitch_cache['last_update'] < max_age:
                return self.twitch_cache[key]
        return None

    def update_youtube_cache(self, key: str, data: dict):
        self.youtube_cache[key] = data
        self.youtube_cache['last_update'] = time.time()

    def get_youtube_cache(self, key: str, max_age: int = 300):
        if key in self.youtube_cache:
            if time.time() - self.youtube_cache['last_update'] < max_age:
                return self.youtube_cache[key]
        return None
