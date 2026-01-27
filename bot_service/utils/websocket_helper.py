# bot_service/utils/websocket_helper.py
"""
Вспомогательные функции для работы с WebSocket
Refactored to delegate logic to dedicated services.
"""
import logging
from typing import Dict, Any, Optional

from services.notification_service import notification_service
from services.tts_handler_service import tts_handler_service

logger = logging.getLogger('bot_service')

async def broadcast_chat_message(
    username: str,
    content: str,
    platform: str,
    channel: str,
    message_id: Optional[str] = None,
    role: Optional[str] = None,
    badges: Optional[list] = None,
    emotes: Optional[list] = None
) -> bool:
    """
    Отправить сообщение чата во все WebSocket соединения.
    Delegates to NotificationService.
    """
    return await notification_service.broadcast_chat_message(
        username, content, platform, channel, message_id, role, badges, emotes
    )

async def handle_tts_for_message(
    text: str,
    username: str,
    channel_identifier: str,
    platform: str,
    tts_api,
    connection_manager,
    skip_if_command: bool = True,
    is_reply: bool = False,
    mentioned_users: list = None,
    reward_id: str = None
) -> Dict[str, Any]:
    """
    Обработать TTS для сообщения.
    Delegates to TTSHandlerService.
    """
    return await tts_handler_service.process_message_for_tts(
        text, username, channel_identifier, platform, tts_api, 
        connection_manager, skip_if_command, is_reply, mentioned_users, reward_id
    )

async def broadcast_tts_audio(
    audio_data: Dict[str, Any],
    channel_name: str,
    platform: str = "twitch"
) -> bool:
    """
    Отправить готовое TTS аудио на фронтенд.
    Delegates to NotificationService.
    """
    return await notification_service.broadcast_tts_audio(
        audio_data, channel_name, platform
    )

async def broadcast_drops_event(drops_data: Dict[str, Any]) -> bool:
    """
    Отправить событие Drops.
    Delegates to NotificationService.
    """
    return await notification_service.broadcast_drops_event(drops_data)
