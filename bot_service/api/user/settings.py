# bot_service/api/user/settings.py
"""User-specific settings endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db, UserSettings, TTSUserSettings, AudioSettings
from auth.auth import get_current_user
from core.permissions import require_permission, Permission, require_ownership_or_admin
from typing import Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user/settings", tags=["user-settings"])


class UserSettingsUpdateRequest(BaseModel):
    """Request model for updating user settings"""
    chat_enabled: Optional[bool] = None
    chat_max_messages: Optional[int] = None
    chat_show_timestamps: Optional[bool] = None
    chat_show_platform: Optional[bool] = None
    obs_width: Optional[int] = None
    obs_height: Optional[int] = None
    obs_font_size: Optional[int] = None
    obs_background_color: Optional[str] = None
    obs_text_color: Optional[str] = None


class TTSSettingsUpdateRequest(BaseModel):
    """Request model for updating TTS settings"""
    engine: Optional[str] = None
    voice: Optional[str] = None
    listening_mode: Optional[str] = None
    enabled_platforms: Optional[list] = None
    tts_mode: Optional[str] = None


class AudioSettingsUpdateRequest(BaseModel):
    """Request model for updating audio settings"""
    website_volume: Optional[int] = None
    obs_volume: Optional[int] = None


@router.get("/me")
@require_permission(Permission.MANAGE_OWN_SETTINGS)
async def get_my_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's settings.
    
    Requires: MANAGE_OWN_SETTINGS permission
    """
    try:
        user_id = current_user.get('id')

        # Get user settings
        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == user_id).first()
        audio_settings = db.query(AudioSettings).filter(AudioSettings.user_id == user_id).first()

        return {
            "success": True,
            "settings": {
                'chat_enabled': settings.chat_enabled if settings else True,
                'chat_max_messages': settings.chat_max_messages if settings else 50,
                'chat_show_timestamps': settings.chat_show_timestamps if settings else True,
                'chat_show_platform': settings.chat_show_platform if settings else True,
                'obs_width': settings.obs_width if settings else 400,
                'obs_height': settings.obs_height if settings else 300,
                'obs_font_size': settings.obs_font_size if settings else 14,
                'obs_background_color': settings.obs_background_color if settings else '#000000',
                'obs_text_color': settings.obs_text_color if settings else '#ffffff',
            } if settings else {},
            "tts_settings": {
                'engine': tts_settings.engine if tts_settings else 'gtts',
                'voice': tts_settings.voice if tts_settings else 'female_1',
                'listening_mode': tts_settings.listening_mode if tts_settings else 'website',
                'enabled_platforms': tts_settings.enabled_platforms if tts_settings else ['twitch', 'vk'],
                'tts_mode': tts_settings.tts_mode if tts_settings else 'all_messages',
            } if tts_settings else {},
            "audio_settings": {
                'website_volume': audio_settings.website_volume if audio_settings else 50,
                'obs_volume': audio_settings.obs_volume if audio_settings else 50,
            } if audio_settings else {}
        }
    except Exception as e:
        logger.error(f"Error getting user settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/me")
@require_permission(Permission.MANAGE_OWN_SETTINGS)
async def update_my_settings(
    request: UserSettingsUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's settings.
    
    Requires: MANAGE_OWN_SETTINGS permission
    """
    try:
        user_id = current_user.get('id')

        # Get or create settings
        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        if not settings:
            settings = UserSettings(user_id=user_id)
            db.add(settings)

        # Update fields if provided
        if request.chat_enabled is not None:
            settings.chat_enabled = request.chat_enabled
        if request.chat_max_messages is not None:
            settings.chat_max_messages = request.chat_max_messages
        if request.chat_show_timestamps is not None:
            settings.chat_show_timestamps = request.chat_show_timestamps
        if request.chat_show_platform is not None:
            settings.chat_show_platform = request.chat_show_platform
        if request.obs_width is not None:
            settings.obs_width = request.obs_width
        if request.obs_height is not None:
            settings.obs_height = request.obs_height
        if request.obs_font_size is not None:
            settings.obs_font_size = request.obs_font_size
        if request.obs_background_color is not None:
            settings.obs_background_color = request.obs_background_color
        if request.obs_text_color is not None:
            settings.obs_text_color = request.obs_text_color

        db.commit()

        logger.info(f"User {user_id} updated their settings")

        return {
            "success": True,
            "message": "Settings updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating user settings: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/me/tts")
@require_permission(Permission.MANAGE_OWN_SETTINGS)
async def update_my_tts_settings(
    request: TTSSettingsUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's TTS settings.
    
    Requires: MANAGE_OWN_SETTINGS permission
    """
    try:
        user_id = current_user.get('id')

        # Get or create TTS settings
        tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == user_id).first()
        if not tts_settings:
            tts_settings = TTSUserSettings(user_id=user_id)
            db.add(tts_settings)

        # Update fields if provided
        if request.engine is not None:
            valid_engines = ['gtts', 'f5tts']
            if request.engine not in valid_engines:
                raise HTTPException(status_code=400, detail=f"Invalid engine. Must be one of: {valid_engines}")
            tts_settings.engine = request.engine

        if request.voice is not None:
            tts_settings.voice = request.voice

        if request.listening_mode is not None:
            valid_modes = ['website', 'obs']
            if request.listening_mode not in valid_modes:
                raise HTTPException(status_code=400, detail=f"Invalid listening mode. Must be one of: {valid_modes}")
            tts_settings.listening_mode = request.listening_mode

        if request.enabled_platforms is not None:
            tts_settings.enabled_platforms = request.enabled_platforms

        if request.tts_mode is not None:
            valid_modes = ['all_messages', 'channel_points']
            if request.tts_mode not in valid_modes:
                raise HTTPException(status_code=400, detail=f"Invalid TTS mode. Must be one of: {valid_modes}")
            tts_settings.tts_mode = request.tts_mode

        db.commit()

        logger.info(f"User {user_id} updated their TTS settings")

        return {
            "success": True,
            "message": "TTS settings updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating TTS settings: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/me/audio")
@require_permission(Permission.MANAGE_OWN_SETTINGS)
async def update_my_audio_settings(
    request: AudioSettingsUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's audio settings.
    
    Requires: MANAGE_OWN_SETTINGS permission
    """
    try:
        user_id = current_user.get('id')

        # Get or create audio settings
        audio_settings = db.query(AudioSettings).filter(AudioSettings.user_id == user_id).first()
        if not audio_settings:
            audio_settings = AudioSettings(user_id=user_id)
            db.add(audio_settings)

        # Update fields if provided
        if request.website_volume is not None:
            if not 0 <= request.website_volume <= 100:
                raise HTTPException(status_code=400, detail="Volume must be between 0 and 100")
            audio_settings.website_volume = request.website_volume

        if request.obs_volume is not None:
            if not 0 <= request.obs_volume <= 100:
                raise HTTPException(status_code=400, detail="Volume must be between 0 and 100")
            audio_settings.obs_volume = request.obs_volume

        db.commit()

        logger.info(f"User {user_id} updated their audio settings")

        return {
            "success": True,
            "message": "Audio settings updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating audio settings: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
@require_ownership_or_admin(resource_user_id_param="user_id")
async def get_user_settings(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get settings for a specific user.
    
    Requires: Ownership of the resource or admin role
    """
    try:
        # Get user settings
        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == user_id).first()
        audio_settings = db.query(AudioSettings).filter(AudioSettings.user_id == user_id).first()

        return {
            "success": True,
            "settings": {
                'chat_enabled': settings.chat_enabled if settings else True,
                'chat_max_messages': settings.chat_max_messages if settings else 50,
                'channel_name': settings.channel_name if settings else None,
                'vk_channel_name': settings.vk_channel_name if settings else None,
            } if settings else {},
            "tts_settings": {
                'engine': tts_settings.engine if tts_settings else 'gtts',
                'voice': tts_settings.voice if tts_settings else 'female_1',
                'listening_mode': tts_settings.listening_mode if tts_settings else 'website',
            } if tts_settings else {},
            "audio_settings": {
                'website_volume': audio_settings.website_volume if audio_settings else 50,
                'obs_volume': audio_settings.obs_volume if audio_settings else 50,
            } if audio_settings else {}
        }
    except Exception as e:
        logger.error(f"Error getting user settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
