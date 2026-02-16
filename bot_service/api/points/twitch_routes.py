from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
import logging
from typing import Optional

from core.database import get_db
from services.platform_rewards_service import PlatformRewardsService
from auth.auth import get_current_user
from core.security_modern import limiter
# [Modified Import] Relative import or direct from api.points
from api.points.routes import CreateRewardRequest

logger = logging.getLogger('bot_service')

points_twitch_router = APIRouter(tags=["points_twitch"])
platform_service = PlatformRewardsService()

@points_twitch_router.get("/rewards/twitch")
async def get_twitch_rewards(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ РЅР°РіСЂР°РґС‹ Twitch РєР°РЅР°Р»Р°"""
    try:
        rewards = await platform_service.get_rewards(user['id'], 'twitch', db)
        
        return JSONResponse(content={
            "success": True,
            "platform": "twitch",
            "rewards": rewards
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] [TWITCH REWARDS] Error: {e}")
        raise HTTPException(status_code=500, detail=f"РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РЅР°РіСЂР°Рґ Twitch: {str(e)}")

@points_twitch_router.post("/rewards/twitch/create")
@limiter.limit("10/minute")
async def create_twitch_reward(
    request: Request,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЎРѕР·РґР°С‚СЊ РЅР°РіСЂР°РґСѓ РЅР° Twitch"""
    try:
        result = await platform_service.create_reward(
            user['id'], 'twitch', reward_data.dict(), db
        )
        
        return {
            "success": True,
            "platform": "twitch",
            "reward": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Twitch reward: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"РќРµРѕР¶РёРґР°РЅРЅР°СЏ РѕС€РёР±РєР° РїСЂРё СЃРѕР·РґР°РЅРёРё РЅР°РіСЂР°РґС‹ Twitch: {str(e)}")

@points_twitch_router.patch("/rewards/twitch/{reward_id}")
async def update_twitch_reward(
    reward_id: str,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±РЅРѕРІРёС‚СЊ РЅР°РіСЂР°РґСѓ РЅР° Twitch"""
    try:
        result = await platform_service.update_reward(
            user['id'], 'twitch', reward_id, reward_data.dict(), db
        )

        return JSONResponse(content={
            "success": True,
            "platform": "twitch",
            "reward": result
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating Twitch reward: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"РќРµРѕР¶РёРґР°РЅРЅР°СЏ РѕС€РёР±РєР° РїСЂРё РѕР±РЅРѕРІР»РµРЅРёРё РЅР°РіСЂР°РґС‹ Twitch: {str(e)}")

@points_twitch_router.delete("/rewards/twitch/{reward_id}")
async def delete_twitch_reward(
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЈРґР°Р»РёС‚СЊ РЅР°РіСЂР°РґСѓ РЅР° Twitch"""
    try:
        await platform_service.delete_reward(user['id'], 'twitch', reward_id, db)

        return JSONResponse(content={
            "success": True,
            "platform": "twitch",
            "message": "РќР°РіСЂР°РґР° СѓРґР°Р»РµРЅР°"
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting Twitch reward: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"РќРµРѕР¶РёРґР°РЅРЅР°СЏ РѕС€РёР±РєР° РїСЂРё СѓРґР°Р»РµРЅРёРё РЅР°РіСЂР°РґС‹ Twitch: {str(e)}")

@points_twitch_router.get("/platform/rewards")
async def get_platform_rewards(
    platform: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ РЅР°РіСЂР°РґС‹ РЅР°РїСЂСЏРјСѓСЋ СЃ РїР»Р°С‚С„РѕСЂРјС‹ (Twitch РёР»Рё VK Live) - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ СЌРЅРґРїРѕРёРЅС‚"""
    try:
        rewards = await platform_service.get_rewards(user['id'], platform, db)

        return {
            "success": True,
            "platform": platform,
            "rewards": rewards
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform rewards: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РЅР°РіСЂР°Рґ: {str(e)}")

@points_twitch_router.post("/platform/rewards/create")
async def create_platform_reward(
    platform: str,
    reward_data: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЎРѕР·РґР°С‚СЊ РЅР°РіСЂР°РґСѓ РЅР° РїР»Р°С‚С„РѕСЂРјРµ (Twitch РёР»Рё VK Live) - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ СЌРЅРґРїРѕРёРЅС‚"""
    try:
        result = await platform_service.create_reward(
            user['id'], platform, reward_data, db
        )

        return {
            "success": True,
            "platform": platform,
            "reward": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating platform reward: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.delete("/platform/rewards/{reward_id}")
async def delete_platform_reward(
    platform: str,
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЈРґР°Р»РёС‚СЊ РЅР°РіСЂР°РґСѓ РЅР° РїР»Р°С‚С„РѕСЂРјРµ - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ СЌРЅРґРїРѕРёРЅС‚"""
    try:
        await platform_service.delete_reward(user['id'], platform, reward_id, db)

        return {
            "success": True,
            "message": "РќР°РіСЂР°РґР° СѓРґР°Р»РµРЅР°"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting platform reward: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.get("/platform/redemptions")
async def get_platform_redemptions(
    platform: str,
    reward_id: str,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РёСЃРїРѕР»СЊР·РѕРІР°РЅРёР№ РЅР°РіСЂР°РґС‹ СЃ РїР»Р°С‚С„РѕСЂРјС‹"""
    try:
        redemptions = await platform_service.get_redemptions(
            user['id'], platform, reward_id, status, db
        )

        return {
            "success": True,
            "platform": platform,
            "redemptions": redemptions
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform redemptions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.patch("/platform/redemptions/{redemption_id}")
async def update_platform_redemption(
    platform: str,
    reward_id: str,
    redemption_id: str,
    status: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РЅР°РіСЂР°РґС‹ (РѕРґРѕР±СЂРёС‚СЊ/РѕС‚РєР»РѕРЅРёС‚СЊ)"""
    try:
        success = await platform_service.update_redemption_status(
            user['id'], platform, reward_id, redemption_id, status, db
        )

        if not success:
             raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СЃС‚Р°С‚СѓСЃР°")
             
        return {
            "success": True,
            "message": f"РЎС‚Р°С‚СѓСЃ РѕР±РЅРѕРІР»РµРЅ: {status}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating platform redemption: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
