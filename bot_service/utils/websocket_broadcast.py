"""
WebSocket Broadcast Utilities

Helper functions for broadcasting state changes via WebSocket
"""
import logging
from typing import Dict, Any
from core.connection_manager import get_connection_manager

logger = logging.getLogger(__name__)

async def broadcast_settings_change(user_id: int, setting_type: str, settings: Dict[str, Any]):
    """
    Broadcast settings change to all user's connections
    
    Args:
        user_id: User ID
        setting_type: Type of settings (e.g., 'settings', 'tts_settings')
        settings: Updated settings data
    """
    try:
        connection_manager = get_connection_manager()
        await connection_manager.broadcast_settings_update(
            str(user_id),
            setting_type,
            settings
        )
        logger.debug(f"Broadcasted {setting_type} change for user {user_id}")
    except Exception as e:
        logger.error(f"Error broadcasting settings change: {e}")


async def broadcast_stream_info_change(user_id: int, platform: str, stream_info: Dict[str, Any]):
    """
    Broadcast stream info change to all user's connections
    
    Args:
        user_id: User ID
        platform: Platform name ('twitch' or 'vk')
        stream_info: Updated stream information
    """
    try:
        connection_manager = get_connection_manager()
        await connection_manager.broadcast_stream_info_update(
            str(user_id),
            platform,
            stream_info
        )
        logger.debug(f"Broadcasted stream info change for user {user_id} on {platform}")
    except Exception as e:
        logger.error(f"Error broadcasting stream info change: {e}")


async def broadcast_tts_status_change(user_id: int, enabled: bool):
    """
    Broadcast TTS status change to all user's connections
    
    Args:
        user_id: User ID
        enabled: Whether TTS is enabled
    """
    try:
        connection_manager = get_connection_manager()
        await connection_manager.broadcast_tts_status_change(
            str(user_id),
            enabled
        )
        logger.debug(f"Broadcasted TTS status change for user {user_id}: {enabled}")
    except Exception as e:
        logger.error(f"Error broadcasting TTS status change: {e}")


async def broadcast_youtube_queue_update(user_id: int):
    """
    Broadcast YouTube queue update to all user's connections
    
    Args:
        user_id: User ID
    """
    try:
        connection_manager = get_connection_manager()
        message = {
            "type": "youtube_queue_updated",
            "data": {}
        }
        await connection_manager.send_to_user(str(user_id), message)
        logger.debug(f"Broadcasted YouTube queue update for user {user_id}")
    except Exception as e:
        logger.error(f"Error broadcasting YouTube queue update: {e}")


async def broadcast_points_update(user_id: int):
    """
    Broadcast points/rewards update to all user's connections
    
    Args:
        user_id: User ID
    """
    try:
        connection_manager = get_connection_manager()
        message = {
            "type": "points_updated",
            "data": {}
        }
        await connection_manager.send_to_user(str(user_id), message)
        logger.debug(f"Broadcasted points update for user {user_id}")
    except Exception as e:
        logger.error(f"Error broadcasting points update: {e}")


async def broadcast_drops_result(user_id: int, result: Dict[str, Any]):
    """
    Broadcast drops result to all user's connections
    
    Args:
        user_id: User ID
        result: Drops result data
    """
    try:
        connection_manager = get_connection_manager()
        message = {
            "type": "drops_result",
            "data": result
        }
        await connection_manager.send_to_user(str(user_id), message)
        logger.debug(f"Broadcasted drops result for user {user_id}")
    except Exception as e:
        logger.error(f"Error broadcasting drops result: {e}")
