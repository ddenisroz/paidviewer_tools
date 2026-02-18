from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
import logging

from core.database import get_db
from services.platform_rewards_service import PlatformRewardsService
from auth.auth import get_current_user
from core.security_modern import limiter
# [Modified Import] Relative import or direct from api.points
from api.points.routes import CreateRewardRequest, ToggleRewardRequest, ProcessVKDemandsRequest

logger = logging.getLogger('bot_service')

points_vk_router = APIRouter(tags=["points_vk"])
platform_service = PlatformRewardsService()

@points_vk_router.get("/rewards/vk")
async def get_vk_rewards(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить награды VK канала"""
    try:
        rewards = await platform_service.get_rewards(user['id'], 'vk', db)

        return JSONResponse(content={
            "success": True,
            "platform": "vk",
            "rewards": rewards
        })

    except HTTPException:
        raise
    except Exception:
        logger.exception("[ERROR] [VK REWARDS] Error")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_vk_router.post("/rewards/vk/create")
@limiter.limit("10/minute")
async def create_vk_reward(
    request: Request,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать награду на VK Live"""
    try:
        result = await platform_service.create_reward(
            user['id'], 'vk', reward_data.dict(), db
        )

        return {
            "success": True,
            "platform": "vk",
            "reward": result
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error creating VK reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_vk_router.patch("/rewards/vk/{reward_id}")
async def update_vk_reward(
    reward_id: str,
    reward_data: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить награду на VK Live"""
    try:
        result = await platform_service.update_reward(
            user['id'], 'vk', reward_id, reward_data.dict(), db
        )

        return JSONResponse(content={
            "success": True,
            "platform": "vk",
            "reward": result
        })

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating VK reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_vk_router.delete("/rewards/vk/{reward_id}")
@limiter.limit("20/minute")
async def delete_vk_reward(
    request: Request,
    reward_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить награду на VK Live"""
    try:
        await platform_service.delete_reward(user['id'], 'vk', reward_id, db)

        return JSONResponse(content={
            "success": True,
            "platform": "vk",
            "message": "Награда удалена"
        })

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error deleting VK reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_vk_router.patch("/rewards/vk/{reward_id}/toggle")
async def toggle_vk_reward(
    reward_id: str,
    request: ToggleRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Включить/выключить награду на VK Live"""
    try:
        success = await platform_service.toggle_reward(
            user['id'], 'vk', reward_id, request.is_enabled, db
        )

        if success:
            return JSONResponse(content={
                "success": True,
                "platform": "vk",
                "is_enabled": request.is_enabled,
                "message": f"Награда {'включена' if request.is_enabled else 'выключена'}"
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка переключения награды на VK Live API")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error toggling VK reward")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_vk_router.get("/rewards/vk/demands")
async def get_vk_reward_demands(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список запросов наград VK Live"""
    try:
        demands = await platform_service.get_demands(user['id'], 'vk', db)

        return JSONResponse(content={
            "success": True,
            "platform": "vk",
            "demands": demands
        })

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting VK reward demands")
        raise HTTPException(status_code=500, detail="Internal server error")

@points_vk_router.post("/rewards/vk/demands/process")
async def process_vk_reward_demands(
    request_data: ProcessVKDemandsRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обработать запросы наград VK Live (принять/отклонить)"""
    try:
        result = await platform_service.process_demands(
            user['id'], 'vk', request_data.demand_ids, request_data.action, db
        )

        if result:
            return JSONResponse(content={
                "success": True,
                "platform": "vk",
                "action": request_data.action,
                "processed_count": len(request_data.demand_ids),
                "message": f"Запросы {'приняты' if request_data.action == 'accept' else 'отклонены'}"
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка обработки запросов наград")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error processing VK reward demands")
        raise HTTPException(status_code=500, detail="Internal server error")
