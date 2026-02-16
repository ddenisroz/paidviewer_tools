# bot_service/api/youtube/settings_routes.py
"""
API endpoints for YouTube integration settings.

Clean Architecture: endpoints delegate to repositories/services.
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth.auth import get_current_user
from core.database import get_db
from repositories.tts_settings_repository import TTSSettingsRepository

logger = logging.getLogger('bot_service')

youtube_settings_router = APIRouter(prefix="/api/tts", tags=["youtube-settings"])


class YouTubeSettingsResponse(BaseModel):
    """Response model for YouTube settings."""

    playback_mode: Literal['browser', 'obs'] = Field(default='browser', description='Playback mode')
    volume_level: int = Field(default=100, ge=0, le=100, description='Volume level (0-100)')
    requests_command_enabled: bool = Field(default=True, description='Allow !sr command')

    # Legacy single-platform reward settings (kept for backward compatibility)
    requests_reward_enabled: bool = Field(default=False, description='Allow reward-based requests')
    requests_reward_id: Optional[str] = Field(None, description='Legacy reward identifier')
    requests_reward_platform: Literal['twitch', 'vk'] = Field(default='twitch', description='Legacy reward platform')

    # New per-platform reward settings
    requests_reward_twitch_enabled: bool = Field(default=False, description='Allow Twitch reward requests')
    requests_reward_twitch_id: Optional[str] = Field(None, description='Twitch reward ID')
    requests_reward_vk_enabled: bool = Field(default=False, description='Allow VK reward requests')
    requests_reward_vk_id: Optional[str] = Field(None, description='VK reward title')


class YouTubeSettingsUpdate(BaseModel):
    """Request model for updating YouTube settings."""

    playback_mode: Optional[Literal['browser', 'obs']] = Field(None, description='Playback mode')
    volume_level: Optional[int] = Field(None, ge=0, le=100, description='Volume level (0-100)')
    requests_command_enabled: Optional[bool] = Field(None, description='Allow !sr command')

    # Legacy single-platform reward settings (accepted for compatibility)
    requests_reward_enabled: Optional[bool] = Field(None, description='Allow reward-based requests')
    requests_reward_id: Optional[str] = Field(None, description='Legacy reward identifier')
    requests_reward_platform: Optional[Literal['twitch', 'vk']] = Field(None, description='Legacy reward platform')

    # New per-platform reward settings
    requests_reward_twitch_enabled: Optional[bool] = Field(None, description='Allow Twitch reward requests')
    requests_reward_twitch_id: Optional[str] = Field(None, description='Twitch reward ID')
    requests_reward_vk_enabled: Optional[bool] = Field(None, description='Allow VK reward requests')
    requests_reward_vk_id: Optional[str] = Field(None, description='VK reward title')


def _clean_optional_str(value: object) -> Optional[str]:
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    return None


def _normalize_reward_settings(youtube_settings: dict) -> dict:
    """Normalize legacy and per-platform reward settings into one coherent structure."""

    legacy_enabled = bool(youtube_settings.get('requests_reward_enabled', False))
    legacy_platform = 'vk' if youtube_settings.get('requests_reward_platform') == 'vk' else 'twitch'
    legacy_reward_id = _clean_optional_str(youtube_settings.get('requests_reward_id'))

    twitch_enabled_raw = youtube_settings.get('requests_reward_twitch_enabled')
    vk_enabled_raw = youtube_settings.get('requests_reward_vk_enabled')
    twitch_id_raw = youtube_settings.get('requests_reward_twitch_id')
    vk_id_raw = youtube_settings.get('requests_reward_vk_id')

    has_new_enabled = twitch_enabled_raw is not None or vk_enabled_raw is not None
    has_new_ids = twitch_id_raw is not None or vk_id_raw is not None

    if has_new_enabled:
        twitch_enabled = bool(twitch_enabled_raw)
        vk_enabled = bool(vk_enabled_raw)
    else:
        twitch_enabled = legacy_enabled and legacy_platform == 'twitch'
        vk_enabled = legacy_enabled and legacy_platform == 'vk'

    twitch_id = _clean_optional_str(twitch_id_raw)
    vk_id = _clean_optional_str(vk_id_raw)

    if not has_new_ids and legacy_reward_id:
        if legacy_platform == 'twitch':
            twitch_id = legacy_reward_id
        else:
            vk_id = legacy_reward_id

    legacy_enabled_out = twitch_enabled or vk_enabled
    if twitch_enabled and vk_enabled:
        legacy_platform_out = 'twitch' if twitch_id else ('vk' if vk_id else 'twitch')
    elif vk_enabled:
        legacy_platform_out = 'vk'
    else:
        legacy_platform_out = 'twitch'

    legacy_reward_id_out = vk_id if legacy_platform_out == 'vk' else twitch_id

    return {
        'requests_reward_enabled': legacy_enabled_out,
        'requests_reward_id': legacy_reward_id_out,
        'requests_reward_platform': legacy_platform_out,
        'requests_reward_twitch_enabled': twitch_enabled,
        'requests_reward_twitch_id': twitch_id,
        'requests_reward_vk_enabled': vk_enabled,
        'requests_reward_vk_id': vk_id,
    }


def _get_youtube_settings_from_tts(tts_settings) -> dict:
    """Extract and normalize YouTube settings from TTS settings object."""

    youtube_settings = getattr(tts_settings, 'youtube_settings', None) or {}
    reward_settings = _normalize_reward_settings(youtube_settings)

    return {
        'playback_mode': youtube_settings.get('playback_mode', 'browser'),
        'volume_level': youtube_settings.get('volume_level', 100),
        'requests_command_enabled': youtube_settings.get('requests_command_enabled', True),
        **reward_settings,
    }


@youtube_settings_router.get('/youtube-settings', response_model=YouTubeSettingsResponse)
async def get_youtube_settings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get YouTube settings for current user."""

    try:
        user_id = user.get('id')

        repo = TTSSettingsRepository(db)
        tts_settings = repo.get_or_create(user_id=user_id)
        settings = _get_youtube_settings_from_tts(tts_settings)
        return YouTubeSettingsResponse(**settings)

    except Exception as e:
        logger.error(f'Error getting YouTube settings: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Ошибка получения настроек YouTube')


@youtube_settings_router.post('/youtube-settings', response_model=YouTubeSettingsResponse)
async def save_youtube_settings(
    settings: YouTubeSettingsUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save YouTube settings for current user."""

    try:
        user_id = user.get('id')

        repo = TTSSettingsRepository(db)
        tts_settings = repo.get_or_create(user_id=user_id)

        youtube_settings = getattr(tts_settings, 'youtube_settings', None) or {}

        if settings.playback_mode is not None:
            youtube_settings['playback_mode'] = settings.playback_mode
        if settings.volume_level is not None:
            youtube_settings['volume_level'] = settings.volume_level
        if settings.requests_command_enabled is not None:
            youtube_settings['requests_command_enabled'] = settings.requests_command_enabled

        # Legacy fields (accepted)
        if settings.requests_reward_enabled is not None:
            youtube_settings['requests_reward_enabled'] = settings.requests_reward_enabled
        if settings.requests_reward_id is not None:
            youtube_settings['requests_reward_id'] = settings.requests_reward_id
        if settings.requests_reward_platform is not None:
            youtube_settings['requests_reward_platform'] = settings.requests_reward_platform

        # New per-platform fields
        if settings.requests_reward_twitch_enabled is not None:
            youtube_settings['requests_reward_twitch_enabled'] = settings.requests_reward_twitch_enabled
        if settings.requests_reward_twitch_id is not None:
            youtube_settings['requests_reward_twitch_id'] = settings.requests_reward_twitch_id
        if settings.requests_reward_vk_enabled is not None:
            youtube_settings['requests_reward_vk_enabled'] = settings.requests_reward_vk_enabled
        if settings.requests_reward_vk_id is not None:
            youtube_settings['requests_reward_vk_id'] = settings.requests_reward_vk_id

        youtube_settings.update(_normalize_reward_settings(youtube_settings))

        repo.update_settings(tts_settings, {'youtube_settings': youtube_settings})
        logger.info(f'YouTube settings saved for user {user_id}: {youtube_settings}')

        return YouTubeSettingsResponse(
            playback_mode=youtube_settings.get('playback_mode', 'browser'),
            volume_level=youtube_settings.get('volume_level', 100),
            requests_command_enabled=youtube_settings.get('requests_command_enabled', True),
            requests_reward_enabled=youtube_settings.get('requests_reward_enabled', False),
            requests_reward_id=youtube_settings.get('requests_reward_id', None),
            requests_reward_platform=youtube_settings.get('requests_reward_platform', 'twitch'),
            requests_reward_twitch_enabled=youtube_settings.get('requests_reward_twitch_enabled', False),
            requests_reward_twitch_id=youtube_settings.get('requests_reward_twitch_id', None),
            requests_reward_vk_enabled=youtube_settings.get('requests_reward_vk_enabled', False),
            requests_reward_vk_id=youtube_settings.get('requests_reward_vk_id', None),
        )

    except Exception as e:
        db.rollback()
        logger.error(f'Error saving YouTube settings: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Ошибка сохранения настроек YouTube')


@youtube_settings_router.get('/obs-url')
async def get_obs_url(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get OBS URL token for current user."""

    try:
        user_id = user.get('id')

        from repositories.user_repository import UserRepository

        repo = UserRepository(db)
        user_record = repo.get_by_id(user_id)

        if not user_record:
            raise HTTPException(status_code=404, detail='Пользователь не найден')

        return {
            'obs_token': user_record.obs_token,
            'has_token': user_record.obs_token is not None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error getting OBS URL: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Ошибка получения OBS URL')
