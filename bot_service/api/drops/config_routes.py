"""Drops configuration and widget-settings API."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from core.database import get_db
from auth.auth import get_current_user_optional
from utils.cache import get_cached, invalidate_cache
logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/drops', tags=['drops'])
DROP_CONFIG_CACHE_TTL = 60

def _build_config_response(config) -> dict:
    streak_reset_on_skip = getattr(config, 'streak_reset_on_skip', True)
    widget_token_val = getattr(config, 'widget_token', None)
    streak_enabled_twitch = getattr(config, 'streak_enabled_twitch', False)
    streak_enabled_vk = getattr(config, 'streak_enabled_vk', False)
    return {'success': True, 'data': {'id': config.id, 'channel_name': config.channel_name, 'platform': config.platform, 'streak_days_common': config.streak_days_common, 'streak_days_rare': config.streak_days_rare, 'streak_days_epic': config.streak_days_epic, 'streak_days_legendary': config.streak_days_legendary, 'streak_messages_required': config.streak_messages_required, 'streak_reset_on_skip': streak_reset_on_skip, 'streak_enabled_twitch': streak_enabled_twitch, 'streak_enabled_vk': streak_enabled_vk, 'donation_enabled': config.donation_enabled, 'donation_amount_common': config.donation_amount_common, 'donation_amount_rare': config.donation_amount_rare, 'donation_amount_epic': config.donation_amount_epic, 'donation_amount_legendary': config.donation_amount_legendary, 'mythical_enabled': config.mythical_enabled, 'mythical_min_interval_hours': config.mythical_min_interval_hours, 'mythical_max_interval_hours': config.mythical_max_interval_hours, 'mythical_window_duration_minutes': config.mythical_window_duration_minutes, 'mythical_donation_amount': config.mythical_donation_amount, 'mythical_last_appeared': config.mythical_last_appeared, 'widget_spinning_duration_ms': config.widget_spinning_duration_ms, 'widget_opening_duration_ms': config.widget_opening_duration_ms, 'widget_result_duration_ms': config.widget_result_duration_ms, 'widget_closing_duration_ms': config.widget_closing_duration_ms, 'widget_token': widget_token_val, 'created_at': config.created_at, 'updated_at': config.updated_at}}

class DropsConfigCreate(BaseModel):
    """Base payload for creating a drops configuration."""
    channel_name: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(..., pattern='^(twitch|vk)$')
    streak_enabled: bool = True
    streak_days_common: int = Field(1, ge=1, le=365)
    streak_days_rare: int = Field(3, ge=1, le=365)
    streak_days_epic: int = Field(7, ge=1, le=365)
    streak_days_legendary: int = Field(14, ge=1, le=365)
    streak_messages_required: int = Field(5, ge=1, le=100)
    donation_enabled: bool = True
    donation_amount_common: float = Field(50.0, ge=0.01, le=1000000)
    donation_amount_rare: float = Field(100.0, ge=0.01, le=1000000)
    donation_amount_epic: float = Field(500.0, ge=0.01, le=1000000)
    donation_amount_legendary: float = Field(1000.0, ge=0.01, le=1000000)
    mythical_enabled: bool = True
    mythical_min_interval_hours: int = Field(2, ge=0, le=24)
    mythical_max_interval_hours: int = Field(8, ge=0, le=24)
    mythical_window_duration_minutes: int = Field(5, ge=1, le=60)
    mythical_donation_amount: float = Field(2000.0, ge=0.01, le=1000000)

class DropsConfigUpdate(BaseModel):
    """Payload for updating an existing drops configuration."""
    streak_days_common: Optional[int] = Field(None, ge=1, le=365)
    streak_days_rare: Optional[int] = Field(None, ge=1, le=365)
    streak_days_epic: Optional[int] = Field(None, ge=1, le=365)
    streak_days_legendary: Optional[int] = Field(None, ge=1, le=365)
    streak_messages_required: Optional[int] = Field(None, ge=1, le=100)
    streak_reset_on_skip: Optional[bool] = None
    streak_enabled_twitch: Optional[bool] = None
    streak_enabled_vk: Optional[bool] = None
    streak_enabled: Optional[bool] = None
    donation_enabled: Optional[bool] = None
    donation_amount_common: Optional[float] = Field(None, ge=0.01, le=1000000)
    donation_amount_rare: Optional[float] = Field(None, ge=0.01, le=1000000)
    donation_amount_epic: Optional[float] = Field(None, ge=0.01, le=1000000)
    donation_amount_legendary: Optional[float] = Field(None, ge=0.01, le=1000000)
    mythical_enabled: Optional[bool] = None
    mythical_min_interval_hours: Optional[int] = Field(None, ge=0, le=24)
    mythical_max_interval_hours: Optional[int] = Field(None, ge=0, le=24)
    mythical_window_duration_minutes: Optional[int] = Field(None, ge=1, le=60)
    mythical_donation_amount: Optional[float] = Field(None, ge=0.01, le=1000000)
    widget_spinning_duration_ms: Optional[int] = Field(None, ge=500, le=5000)
    widget_opening_duration_ms: Optional[int] = Field(None, ge=500, le=3000)
    widget_result_duration_ms: Optional[int] = Field(None, ge=2000, le=15000)
    widget_closing_duration_ms: Optional[int] = Field(None, ge=200, le=2000)

def get_user_id(current_user: dict) -> int:
    """Extract the current user ID from the auth payload."""
    if not current_user:
        return None
    user_id = current_user.get('id')
    if not user_id or user_id <= 0:
        return None
    return user_id

@router.get('/config/{channel_name}')
async def get_drops_config(channel_name: str, platform: Optional[str]=None, widget_token: Optional[str]=None, current_user: dict=Depends(get_current_user_optional), db: Session=Depends(get_db)):
    """Get the drops configuration for a channel in dashboard or widget mode."""
    try:
        user_id = None
        if current_user and current_user.get('id'):
            user_id = get_user_id(current_user)
        elif widget_token:
            from repositories.drops_reward_repository import DropsRewardRepository
            drops_repo = DropsRewardRepository(db)
            config = drops_repo.get_config_by_token(widget_token)
            if config and config.channel_name == channel_name:
                user_id = config.user_id
            else:
                raise HTTPException(status_code=403, detail='Widget token does not match the requested channel.')
        else:
            raise HTTPException(status_code=401, detail='Authentication required.')
        from services.drops.drops_service import DropsService
        drops_service = DropsService(db)
        cache_key = f"drops_config:{user_id}:{channel_name}:{platform or 'global'}"
        if widget_token:
            cache_key = f'{cache_key}:token:{widget_token}'

        def _load_config():
            config = drops_service.get_user_config(
                user_id=user_id,
                channel_name=channel_name,
                platform=platform,
            )
            if not config:
                config = drops_service.create_or_update_user_config(
                    user_id=user_id,
                    channel_name=channel_name,
                    platform=platform,
                    config_data={},
                )
            return _build_config_response(config)
        return get_cached(cache_key, _load_config, ttl=DROP_CONFIG_CACHE_TTL)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting drops config')
        raise HTTPException(status_code=500, detail='Internal server error.')

@router.put('/config/{channel_name}')
async def update_drops_config(channel_name: str, config_data: DropsConfigUpdate, platform: Optional[str]=None, current_user: dict=Depends(get_current_user_optional), db: Session=Depends(get_db)):
    """Update the drops configuration for the current user."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail='Authentication required.')
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(status_code=401, detail='Authentication required.')
        from services.drops.drops_service import DropsService
        drops_service = DropsService(db)
        config = drops_service.get_user_config(
            user_id=user_id,
            channel_name=channel_name,
            platform=platform,
        )
        if not config:
            config = drops_service.create_or_update_user_config(
                user_id=user_id,
                channel_name=channel_name,
                platform=platform,
                config_data={},
            )
        update_data = config_data.dict(exclude_unset=True)
        config = drops_service.create_or_update_user_config(
            user_id=user_id,
            channel_name=channel_name,
            platform=platform,
            config_data=update_data,
        )
        try:
            from services.memory_websocket_manager import get_memory_websocket_manager
            if user_id and user_id != -1:
                cache_invalidation_event = {'type': 'cache_invalidate', 'cache_key': f'drops_config_{channel_name}_{platform}', 'reason': 'drops_config_updated'}
                await get_memory_websocket_manager().send_to_user(user_id, cache_invalidation_event)
                logger.debug(f'[REFRESH] [DROPS CONFIG] Sent cache invalidation to user {user_id}')
        except Exception as ws_error:
            logger.warning(f'Failed to send WebSocket notification for drops config: {ws_error}')
        invalidate_cache(f'drops_config:{user_id}:{channel_name}:')
        streak_reset_on_skip = getattr(config, 'streak_reset_on_skip', True)
        widget_token = getattr(config, 'widget_token', None)
        streak_enabled_twitch = getattr(config, 'streak_enabled_twitch', False)
        streak_enabled_vk = getattr(config, 'streak_enabled_vk', False)
        return {'success': True, 'message': 'Drops configuration updated.', 'data': {'id': config.id, 'channel_name': config.channel_name, 'platform': config.platform, 'streak_days_common': config.streak_days_common, 'streak_days_rare': config.streak_days_rare, 'streak_days_epic': config.streak_days_epic, 'streak_days_legendary': config.streak_days_legendary, 'streak_messages_required': config.streak_messages_required, 'streak_reset_on_skip': streak_reset_on_skip, 'streak_enabled_twitch': streak_enabled_twitch, 'streak_enabled_vk': streak_enabled_vk, 'donation_enabled': config.donation_enabled, 'donation_amount_common': config.donation_amount_common, 'donation_amount_rare': config.donation_amount_rare, 'donation_amount_epic': config.donation_amount_epic, 'donation_amount_legendary': config.donation_amount_legendary, 'mythical_enabled': config.mythical_enabled, 'mythical_min_interval_hours': config.mythical_min_interval_hours, 'mythical_max_interval_hours': config.mythical_max_interval_hours, 'mythical_window_duration_minutes': config.mythical_window_duration_minutes, 'mythical_donation_amount': config.mythical_donation_amount, 'mythical_last_appeared': config.mythical_last_appeared, 'widget_spinning_duration_ms': config.widget_spinning_duration_ms, 'widget_opening_duration_ms': config.widget_opening_duration_ms, 'widget_result_duration_ms': config.widget_result_duration_ms, 'widget_closing_duration_ms': config.widget_closing_duration_ms, 'widget_token': widget_token, 'created_at': config.created_at, 'updated_at': config.updated_at}}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error updating drops config')
        raise HTTPException(status_code=500, detail='Internal server error.')
