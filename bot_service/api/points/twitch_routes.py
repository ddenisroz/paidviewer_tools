from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
import logging
from typing import Optional

from core.database import get_db
from services.platform_rewards_service import get_platform_rewards_service
from auth.auth import get_current_user
from core.security_modern import limiter
# [Modified Import] Relative import or direct from api.points
from api.points.routes import CreateRewardRequest

logger = logging.getLogger('bot_service')

points_twitch_router = APIRouter(tags=["points_twitch"])

@points_twitch_router.get("/rewards/twitch")
async def get_twitch_rewards(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить награды Twitch канала"""
    try:
        rewards = await get_platform_rewards_service().get_rewards(user['id'], 'twitch', db)
        
        return JSONResponse(content={
            "success": True,
            "platform": "twitch",
            "rewards": rewards
        })

    except HTTPException:
        raise
    except Exception:
        logger.exception("[ERROR] [TWITCH REWARDS] Error")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.post("/rewards/twitch/create")
@limiter.limit("10/minute")
async def create_twitch_reward(
    request: Request,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать награду на Twitch"""
    try:
        result = await get_platform_rewards_service().create_reward(
            user['id'], 'twitch', reward_data.dict(), db
        )
        
        return {
            "success": True,
            "platform": "twitch",
            "reward": result
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error creating Twitch reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.patch("/rewards/twitch/{reward_id}")
async def update_twitch_reward(
    reward_id: str,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить награду на Twitch"""
    try:
        result = await get_platform_rewards_service().update_reward(
            user['id'], 'twitch', reward_id, reward_data.dict(), db
        )

        return JSONResponse(content={
            "success": True,
            "platform": "twitch",
            "reward": result
        })

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating Twitch reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.delete("/rewards/twitch/{reward_id}")
async def delete_twitch_reward(
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить награду на Twitch"""
    try:
        await get_platform_rewards_service().delete_reward(user['id'], 'twitch', reward_id, db)

        return JSONResponse(content={
            "success": True,
            "platform": "twitch",
            "message": "Награда удалена"
        })

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error deleting Twitch reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.get("/platform/rewards")
async def get_platform_rewards(
    platform: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить награды напрямую с платформы (Twitch или VK Live) - универсальный эндпоинт"""
    try:
        rewards = await get_platform_rewards_service().get_rewards(user['id'], platform, db)

        return {
            "success": True,
            "platform": platform,
            "rewards": rewards
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting platform rewards")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.post("/platform/rewards/create")
async def create_platform_reward(
    platform: str,
    reward_data: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать награду на платформе (Twitch или VK Live) - универсальный эндпоинт"""
    try:
        result = await get_platform_rewards_service().create_reward(
            user['id'], platform, reward_data, db
        )

        return {
            "success": True,
            "platform": platform,
            "reward": result
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error creating platform reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.delete("/platform/rewards/{reward_id}")
async def delete_platform_reward(
    platform: str,
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить награду на платформе - универсальный эндпоинт"""
    try:
        await get_platform_rewards_service().delete_reward(user['id'], platform, reward_id, db)

        return {
            "success": True,
            "message": "Награда удалена"
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error deleting platform reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_twitch_router.get("/platform/redemptions")
async def get_platform_redemptions(
    platform: str,
    reward_id: str,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список использований награды с платформы"""
    try:
        redemptions = await get_platform_rewards_service().get_redemptions(
            user['id'], platform, reward_id, status, db
        )

        return {
            "success": True,
            "platform": platform,
            "redemptions": redemptions
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting platform redemptions")
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
    """Обновить статус использования награды (одобрить/отклонить)"""
    try:
        success = await get_platform_rewards_service().update_redemption_status(
            user['id'], platform, reward_id, redemption_id, status, db
        )

        if not success:
             raise HTTPException(status_code=500, detail="Ошибка обновления статуса")
             
        return {
            "success": True,
            "message": f"Статус обновлен: {status}"
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating platform redemption")
        raise HTTPException(status_code=500, detail="Internal server error")
