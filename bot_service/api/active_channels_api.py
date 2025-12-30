# bot_service/api/active_channels_api.py
"""API для активных каналов"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db, UserSettings
from auth.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["channels"])

@router.get("/active-channels")
async def get_active_channels(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список активных каналов"""
    try:
        # Получаем каналы с включенным чатом
        channels = db.query(UserSettings).filter(
            UserSettings.chat_enabled.is_(True)
        ).all()

        channels_data = []
        for channel in channels:
            channel_data = {
                'id': channel.id,
                'tts_enabled': getattr(channel, 'tts_enabled', False),
                'created_at': channel.created_at.isoformat() if channel.created_at else None
            }

            # Добавляем информацию о канале в зависимости от платформы
            if hasattr(channel, 'channel_name') and channel.channel_name:
                channel_data.update({
                    'platform': 'twitch',
                    'channel_name': channel.channel_name
                })
            elif hasattr(channel, 'vk_channel_name') and channel.vk_channel_name:
                channel_data.update({
                    'platform': 'vk',
                    'channel_name': channel.vk_channel_name
                })

            channels_data.append(channel_data)

        return {
            "success": True,
            "channels": channels_data,
            "total": len(channels_data)
        }
    except Exception as e:
        logger.error(f"Error getting active channels: {e}")
        return {"success": False, "error": str(e)}
