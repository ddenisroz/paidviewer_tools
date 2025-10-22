# bot_service/core/connection_manager_core.py
"""Основная логика ConnectionManager"""
import logging
import time
import json
import asyncio
from typing import Dict, Set, List, TYPE_CHECKING, Any, Optional
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from datetime import datetime

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class ConnectionManagerCore:
    """Основная логика управления соединениями"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.obs_connections: Dict[str, WebSocket] = {}
        self.youtube_obs_connections: Dict[str, WebSocket] = {}
        self.audio_connections: Dict[str, WebSocket] = {}
        self.tts_enabled_channels: Set[str] = set()
        self.tts_enabled_twitch: Set[str] = set()
        self.tts_enabled_vk: Set[str] = set()
        
        # Новая система: два типа TTS
        self.basic_tts_enabled_channels: Set[str] = set()
        self.ai_tts_enabled_channels: Set[str] = set()
        
        self.blocked_bots: Set[str] = set()
        self.youtube_queues: Dict[str, list] = {}
        self.current_videos: Dict[str, dict] = {}
        self.pending_verifications: Dict[str, dict] = {}
        self.verified_sessions: Set[str] = set()
        self.active_vk_bots: Dict[str, dict] = {}
        self.active_sessions: Dict[str, set] = {}
        self.tts_volume_settings: Dict[str, float] = {}
        self.voice_volume_settings: Dict[str, Dict[str, float]] = {}
        self.youtube_settings: Dict[str, dict] = {}
        self.twitch_cache: Dict[str, Any] = {}
        
        # Отложенные отключения TTS (user_id -> asyncio.Task)
        self.pending_tts_disconnects: Dict[int, asyncio.Task] = {}
        # Таймаут ожидания переподключения (в секундах)
        self.reconnect_timeout: int = 15

    def add_active_session(self, channel_name: str, session_id: str, platform: str = "twitch"):
        """Добавить активную сессию"""
        if channel_name not in self.active_sessions:
            self.active_sessions[channel_name] = set()
        self.active_sessions[channel_name].add(session_id)
        logger.debug(f"Added session {session_id} to channel {channel_name} ({platform})")

    def remove_active_session(self, channel_name: str, reason: str = "disconnect") -> bool:
        """Удалить активную сессию"""
        if channel_name in self.active_sessions:
            sessions = self.active_sessions[channel_name]
            if sessions:
                session_id = sessions.pop()
                logger.debug(f"Removed session {session_id} from channel {channel_name} ({reason})")
                return True
            else:
                del self.active_sessions[channel_name]
                logger.debug(f"Removed empty channel {channel_name} ({reason})")
                return True
        return False

    def get_active_channels(self) -> List[str]:
        """Получить список активных каналов"""
        return list(self.active_sessions.keys())

    def get_active_sessions(self) -> Dict[str, set]:
        """Получить активные сессии"""
        return self.active_sessions.copy()

    def is_channel_active(self, channel_name: str) -> bool:
        """Проверить активность канала"""
        return channel_name in self.active_sessions and len(self.active_sessions[channel_name]) > 0

    def get_channel_session_count(self, channel_name: str) -> int:
        """Получить количество сессий канала"""
        return len(self.active_sessions.get(channel_name, set()))

    def enable_tts_for_channel(self, channel_name: str, tts_type: str = "basic"):
        """Включить TTS для канала"""
        if tts_type == "basic":
            self.basic_tts_enabled_channels.add(channel_name)
        elif tts_type == "ai":
            self.ai_tts_enabled_channels.add(channel_name)
        
        self.tts_enabled_channels.add(channel_name)
        logger.info(f"TTS enabled for channel {channel_name} (type: {tts_type})")

    def disable_tts_for_channel(self, channel_name: str):
        """Отключить TTS для канала"""
        self.basic_tts_enabled_channels.discard(channel_name)
        self.ai_tts_enabled_channels.discard(channel_name)
        self.tts_enabled_channels.discard(channel_name)
        logger.info(f"TTS disabled for channel {channel_name}")

    def is_tts_enabled(self, channel_name: str) -> bool:
        """Проверить включен ли TTS для канала"""
        is_enabled = channel_name in self.tts_enabled_channels
        logger.warning(f"🔍 [TTS CHECK] is_tts_enabled('{channel_name}') = {is_enabled}")
        logger.warning(f"🔍 [TTS CHECK] Current tts_enabled_channels: {self.tts_enabled_channels}")
        logger.warning(f"🔍 [TTS CHECK] Current tts_enabled_twitch: {self.tts_enabled_twitch}")
        logger.warning(f"🔍 [TTS CHECK] Current tts_enabled_vk: {self.tts_enabled_vk}")
        return is_enabled

    def get_tts_type(self, channel_name: str) -> str:
        """Получить тип TTS для канала"""
        if channel_name in self.ai_tts_enabled_channels:
            return "ai"
        elif channel_name in self.basic_tts_enabled_channels:
            return "basic"
        return "none"

    def set_tts_volume(self, channel_name: str, volume: float):
        """Установить громкость TTS для канала"""
        self.tts_volume_settings[channel_name] = max(0.0, min(1.0, volume))
        logger.debug(f"TTS volume set to {volume} for channel {channel_name}")

    def get_tts_volume(self, channel_name: str) -> float:
        """Получить громкость TTS для канала"""
        return self.tts_volume_settings.get(channel_name, 1.0)

    def set_voice_volume(self, channel_name: str, voice_name: str, volume: float):
        """Установить громкость голоса для канала"""
        if channel_name not in self.voice_volume_settings:
            self.voice_volume_settings[channel_name] = {}
        self.voice_volume_settings[channel_name][voice_name] = max(0.0, min(1.0, volume))
        logger.debug(f"Voice {voice_name} volume set to {volume} for channel {channel_name}")

    def get_voice_volume(self, channel_name: str, voice_name: str) -> float:
        """Получить громкость голоса для канала"""
        return self.voice_volume_settings.get(channel_name, {}).get(voice_name, 1.0)

    def get_stats(self) -> Dict[str, any]:
        """Получить статистику соединений"""
        return {
            "active_connections": len(self.active_connections),
            "obs_connections": len(self.obs_connections),
            "youtube_obs_connections": len(self.youtube_obs_connections),
            "audio_connections": len(self.audio_connections),
            "active_channels": len(self.active_sessions),
            "tts_enabled_channels": len(self.tts_enabled_channels),
            "basic_tts_channels": len(self.basic_tts_enabled_channels),
            "ai_tts_channels": len(self.ai_tts_enabled_channels),
            "active_vk_bots": len(self.active_vk_bots),
            "total_sessions": sum(len(sessions) for sessions in self.active_sessions.values())
        }

    def get_twitch_cache(self, cache_key: str) -> Any:
        """Получить значение из Twitch кеша"""
        return self.twitch_cache.get(cache_key)

    def update_twitch_cache(self, cache_key: str, value: Any):
        """Обновить значение в Twitch кеше"""
        self.twitch_cache[cache_key] = value
        logger.debug(f"Updated Twitch cache key: {cache_key}")

    async def _delayed_tts_disable(self, user_id: int, username: str):
        """Отключить TTS с задержкой (вызывается после таймера)"""
        try:
            await asyncio.sleep(self.reconnect_timeout)
            
            # Если пользователь не переподключился, отключаем TTS
            logger.info(f"⏰ [TTS TIMEOUT] User {user_id} ({username}) did not reconnect - disabling TTS")
            
            # Импортируем здесь, чтобы избежать циклических импортов
            from services.tts_service import TTSService
            from core.database import get_db
            
            db = next(get_db())
            try:
                tts_service = TTSService(db)
                await tts_service.disable_tts(user_id=user_id)
                logger.info(f"✅ [TTS TIMEOUT] TTS disabled for user {user_id}")
            finally:
                db.close()
            
            # Удаляем задачу из pending
            if user_id in self.pending_tts_disconnects:
                del self.pending_tts_disconnects[user_id]
                
        except asyncio.CancelledError:
            logger.info(f"✅ [TTS RECONNECT] User {user_id} reconnected - keeping TTS enabled")
        except Exception as e:
            logger.error(f"❌ [TTS TIMEOUT] Error disabling TTS for user {user_id}: {e}")

    def schedule_tts_disconnect(self, user_id: int, username: str):
        """Запланировать отключение TTS с таймаутом"""
        # Если уже есть pending задача - отменяем её
        self.cancel_tts_disconnect(user_id)
        
        # Создаём новую задачу
        task = asyncio.create_task(self._delayed_tts_disable(user_id, username))
        self.pending_tts_disconnects[user_id] = task
        
        logger.info(f"⏱️ [TTS DISCONNECT] Scheduled TTS disable for user {user_id} ({username}) in {self.reconnect_timeout}s")

    def cancel_tts_disconnect(self, user_id: int):
        """Отменить запланированное отключение TTS"""
        if user_id in self.pending_tts_disconnects:
            task = self.pending_tts_disconnects[user_id]
            if not task.done():
                task.cancel()
            del self.pending_tts_disconnects[user_id]
            logger.info(f"🔄 [TTS RECONNECT] Cancelled scheduled TTS disable for user {user_id}")
