# api/tts/channel_points_routes.py
"""
TTS Channel Points Mode API endpoints.

Clean Architecture: endpoints delegate to services/repositories.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user
from services.tts.tts_core import UpdateTtsModeRequest, CreateTtsRewardRequest
from repositories.tts_settings_repository import TTSSettingsRepository
from repositories.user_token_repository import UserTokenRepository

logger = logging.getLogger('bot_service.tts.channel_points')

channel_points_router = APIRouter(prefix="/api/tts", tags=["tts-channel-points"])


# ============================================================================
# TTS MODE SETTINGS
# ============================================================================

@channel_points_router.get("/mode-settings")
async def get_tts_mode_settings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘ РЎР‚Р ВµР В¶Р С‘Р СР В° TTS (Р Р†РЎРѓР Вµ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘РЎРЏ / Р В·Р В° Р В±Р В°Р В»Р В»РЎвЂ№)"""
    try:
        repo = TTSSettingsRepository(db)
        settings = repo.get_or_create(user_id=user['id'])
        
        tts_reward_ids = settings.tts_reward_ids or {}
        token_repo = UserTokenRepository(db)
        active_tokens = token_repo.get_active_by_user(user['id'])
        tokens = {t.platform: t for t in active_tokens}
        
        platforms = {}
        for platform in ['twitch', 'vk']:
            if platform in tokens:
                platforms[platform] = {
                    'connected': True,
                    'reward_id': tts_reward_ids.get(platform),
                    'reward_configured': platform in tts_reward_ids
                }
        
        return {
            "success": True,
            "tts_mode": settings.tts_mode,
            "tts_reward_ids": tts_reward_ids,
            "platforms": platforms
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting TTS mode settings")
        raise HTTPException(status_code=500, detail="Internal server error")


@channel_points_router.post("/mode-settings")
async def update_tts_mode_settings(
    request: UpdateTtsModeRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р С›Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ РЎР‚Р ВµР В¶Р С‘Р С TTS"""
    try:
        if request.tts_mode not in ['all_messages', 'channel_points']:
            raise HTTPException(status_code=400, detail="Invalid TTS mode")
        
        repo = TTSSettingsRepository(db)
        settings = repo.get_or_create(user_id=user['id'])
        repo.update_settings(settings, {'tts_mode': request.tts_mode})
        
        logger.info(f"TTS mode updated for user {user['id']}: {request.tts_mode}")
        return {"success": True, "tts_mode": request.tts_mode}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating TTS mode")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# TTS REWARDS MANAGEMENT
# ============================================================================

@channel_points_router.post("/rewards/create")
async def create_tts_reward(
    request: CreateTtsRewardRequest,
    starlette_request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р РЋР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р Р…Р В°Р С–РЎР‚Р В°Р Т‘РЎС“ TTS Р Т‘Р В»РЎРЏ Р С—Р В»Р В°РЎвЂљРЎвЂћР С•РЎР‚Р СРЎвЂ№"""
    try:
        from platforms.registry import platform_registry
        
        if request.platform not in ['twitch', 'vk']:
            raise HTTPException(status_code=400, detail="Invalid platform")
        
        # Validate platform connection
        token_repo = UserTokenRepository(db)
        active_tokens = token_repo.get_active_by_user(user['id'])
        tokens = {t.platform: t for t in active_tokens}
        if request.platform not in tokens:
            raise HTTPException(status_code=404, detail=f"Token for {request.platform} not found")
        
        platform = platform_registry.get(request.platform)
        if not platform:
            raise HTTPException(status_code=500, detail=f"Platform {request.platform} not initialized")
        
        reward_id = None
        if request.platform == 'twitch':
            reward_data = {
                "title": request.title,
                "cost": request.cost,
                "is_user_input_required": True,
                "prompt": "Р вЂ™Р Р†Р ВµР Т‘Р С‘РЎвЂљР Вµ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ Р Т‘Р В»РЎРЏ Р С•Р В·Р Р†РЎС“РЎвЂЎР С”Р С‘ TTS",
                "global_cooldown_seconds": request.cooldown
            }
            reward_id = await platform.create_reward(user['id'], reward_data)
        elif request.platform == 'vk':
            reward_data = {"title": request.title, "cost": request.cost}
            reward_id = await platform.create_reward(user['id'], reward_data)
        
        if not reward_id:
            raise HTTPException(status_code=500, detail="Failed to create reward")
        
        # Save reward ID
        repo = TTSSettingsRepository(db)
        settings = repo.get_or_create(user_id=user['id'])
        tts_reward_ids = settings.tts_reward_ids or {}
        tts_reward_ids[request.platform] = str(reward_id)
        repo.update_settings(settings, {'tts_reward_ids': tts_reward_ids})
        
        logger.info(f"Created TTS reward for user {user['id']} on {request.platform}: {reward_id}")
        return {"success": True, "reward_id": reward_id, "platform": request.platform}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error creating TTS reward")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@channel_points_router.delete("/rewards/{platform}")
async def delete_tts_reward(
    platform: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ TTS Р Р…Р В°Р С–РЎР‚Р В°Р Т‘РЎС“ Р Т‘Р В»РЎРЏ Р С—Р В»Р В°РЎвЂљРЎвЂћР С•РЎР‚Р СРЎвЂ№"""
    try:
        from platforms.registry import platform_registry
        
        if platform not in ['twitch', 'vk']:
            raise HTTPException(status_code=400, detail="Invalid platform")
        
        repo = TTSSettingsRepository(db)
        settings = repo.get_by_user_id(user['id'])
        
        if not settings or not settings.tts_reward_ids:
            raise HTTPException(status_code=404, detail="No rewards configured")
        
        tts_reward_ids = settings.tts_reward_ids or {}
        if platform not in tts_reward_ids:
            raise HTTPException(status_code=404, detail=f"No reward for {platform}")
        
        reward_id = tts_reward_ids[platform]
        
        # Delete on platform
        platform_impl = platform_registry.get(platform)
        if platform_impl:
            await platform_impl.delete_reward(user['id'], reward_id)
        
        del tts_reward_ids[platform]
        repo.update_settings(settings, {'tts_reward_ids': tts_reward_ids})
        
        logger.info(f"Deleted TTS reward for user {user['id']} on {platform}")
        return {"success": True, "platform": platform}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error deleting TTS reward")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


