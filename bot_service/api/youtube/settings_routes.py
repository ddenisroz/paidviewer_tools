# bot_service/api/youtube/settings_routes.py
"""
API endpoints для настроек YouTube интеграции.

Clean Architecture: endpoints delegate to repositories/services.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Literal
import logging

from core.database import get_db
from auth.auth import get_current_user
from repositories.tts_settings_repository import TTSSettingsRepository

logger = logging.getLogger('bot_service')

# Создаем роутер для YouTube settings
youtube_settings_router = APIRouter(prefix="/api/tts", tags=["youtube-settings"])


class YouTubeSettingsResponse(BaseModel):
    """Response model для настроек YouTube"""
    playback_mode: Literal['browser', 'obs'] = Field(default='browser', description="Режим воспроизведения")
    volume_level: int = Field(default=100, ge=0, le=100, description="Уровень громкости (0-100)")
    requests_command_enabled: bool = Field(default=True, description="Разрешить заказ через команду !sr")
    requests_reward_enabled: bool = Field(default=False, description="Разрешить заказ через награду")
    requests_reward_id: Optional[str] = Field(None, description="ID награды для заказа")
    requests_reward_platform: Literal['twitch', 'vk'] = Field(default='twitch', description="Платформа награды для заказа")


class YouTubeSettingsUpdate(BaseModel):
    """Request model для обновления настроек YouTube"""
    playback_mode: Optional[Literal['browser', 'obs']] = Field(None, description="Режим воспроизведения")
    volume_level: Optional[int] = Field(None, ge=0, le=100, description="Уровень громкости (0-100)")
    requests_command_enabled: Optional[bool] = Field(None, description="Разрешить заказ через команду !sr")
    requests_reward_enabled: Optional[bool] = Field(None, description="Разрешить заказ через награду")
    requests_reward_id: Optional[str] = Field(None, description="ID награды для заказа")
    requests_reward_platform: Optional[Literal['twitch', 'vk']] = Field(None, description="Платформа награды для заказа")


def _get_youtube_settings_from_tts(tts_settings) -> dict:
    """Extract YouTube settings from TTS settings object."""
    youtube_settings = getattr(tts_settings, 'youtube_settings', None) or {}
    return {
        'playback_mode': youtube_settings.get('playback_mode', 'browser'),
        'volume_level': youtube_settings.get('volume_level', 100),
        'requests_command_enabled': youtube_settings.get('requests_command_enabled', True),
        'requests_reward_enabled': youtube_settings.get('requests_reward_enabled', False),
        'requests_reward_id': youtube_settings.get('requests_reward_id', None),
        'requests_reward_platform': youtube_settings.get('requests_reward_platform', 'twitch')
    }


@youtube_settings_router.get("/youtube-settings", response_model=YouTubeSettingsResponse)
async def get_youtube_settings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить настройки YouTube для текущего пользователя
    
    Возвращает:
    - playback_mode: 'browser' или 'obs'
    - volume_level: 0-100
    - requests_command_enabled: bool
    - requests_reward_enabled: bool
    - requests_reward_id: str
    """
    try:
        user_id = user.get('id')
        
        # Use repository pattern
        repo = TTSSettingsRepository(db)
        tts_settings = repo.get_or_create(user_id=user_id)
        
        settings = _get_youtube_settings_from_tts(tts_settings)
        return YouTubeSettingsResponse(**settings)
        
    except Exception as e:
        logger.error(f"Error getting YouTube settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка получения настроек YouTube")


@youtube_settings_router.post("/youtube-settings", response_model=YouTubeSettingsResponse)
async def save_youtube_settings(
    settings: YouTubeSettingsUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Сохранить настройки YouTube для текущего пользователя
    """
    try:
        user_id = user.get('id')
        
        # Use repository pattern
        repo = TTSSettingsRepository(db)
        tts_settings = repo.get_or_create(user_id=user_id)
        
        # Get current YouTube settings
        youtube_settings = getattr(tts_settings, 'youtube_settings', None) or {}
        
        # Update only provided fields
        if settings.playback_mode is not None:
            youtube_settings['playback_mode'] = settings.playback_mode
        if settings.volume_level is not None:
            youtube_settings['volume_level'] = settings.volume_level
        if settings.requests_command_enabled is not None:
            youtube_settings['requests_command_enabled'] = settings.requests_command_enabled
        if settings.requests_reward_enabled is not None:
            youtube_settings['requests_reward_enabled'] = settings.requests_reward_enabled
        if settings.requests_reward_id is not None:
            youtube_settings['requests_reward_id'] = settings.requests_reward_id
        if settings.requests_reward_platform is not None:
            youtube_settings['requests_reward_platform'] = settings.requests_reward_platform
        
        # Save back using repository
        repo.update_settings(tts_settings, {'youtube_settings': youtube_settings})
        
        logger.info(f"YouTube settings saved for user {user_id}: {youtube_settings}")
        
        return YouTubeSettingsResponse(
            playback_mode=youtube_settings.get('playback_mode', 'browser'),
            volume_level=youtube_settings.get('volume_level', 100),
            requests_command_enabled=youtube_settings.get('requests_command_enabled', True),
            requests_reward_enabled=youtube_settings.get('requests_reward_enabled', False),
            requests_reward_id=youtube_settings.get('requests_reward_id', None),
            requests_reward_platform=youtube_settings.get('requests_reward_platform', 'twitch')
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving YouTube settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка сохранения настроек YouTube")


@youtube_settings_router.get("/obs-url")
async def get_obs_url(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить существующий OBS URL для YouTube виджета
    
    Возвращает obs_token из таблицы users
    """
    try:
        user_id = user.get('id')
        
        # Use UserRepository
        from repositories.user_repository import UserRepository
        repo = UserRepository(db)
        user_record = repo.get_by_id(user_id)
        
        if not user_record:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        return {
            "obs_token": user_record.obs_token,
            "has_token": user_record.obs_token is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting OBS URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка получения OBS URL")

