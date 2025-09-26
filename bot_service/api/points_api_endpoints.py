# bot_service/api/points_api_endpoints.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from core.database import get_db
from services.points_service import PointsService

logger = logging.getLogger('bot_service')

# Создаем роутер для Points API
points_router = APIRouter(prefix="/api/points", tags=["points"])

# Pydantic модели для API
class AddPointsRequest(BaseModel):
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    amount: int
    reason: Optional[str] = "Manual add"

class DeductPointsRequest(BaseModel):
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    amount: int
    reason: Optional[str] = "Manual deduct"

class CreateRewardRequest(BaseModel):
    platform: str
    channel_name: str
    title: str
    description: str
    cost: int
    icon_url: Optional[str] = None
    background_color: Optional[str] = "#3B82F6"
    is_user_input_required: Optional[bool] = False
    max_per_stream: Optional[int] = None
    max_per_user_per_stream: Optional[int] = None
    prompt: Optional[str] = None
    reward_type: Optional[str] = "custom"

class RedeemRewardRequest(BaseModel):
    reward_id: int
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    user_input: Optional[str] = None

class ProcessRewardRequest(BaseModel):
    queue_id: int
    action: str  # approve, reject, fulfill
    moderator_note: Optional[str] = None

# Инициализируем сервис
points_service = PointsService()

def get_current_user(request: Request):
    """Получение текущего пользователя (заглушка)"""
    # TODO: Реализовать получение пользователя из сессии
    return {"id": 1, "is_admin": True, "display_name": "TestUser"}

# === УПРАВЛЕНИЕ БАЛЛАМИ ===

@points_router.get("/balance")
async def get_user_balance(
    viewer_id: str,
    platform: str,
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение баланса пользователя"""
    try:
        balance = points_service.get_user_points(
            user["id"], viewer_id, platform, channel_name, db
        )
        
        return {
            "success": True,
            "balance": balance,
            "viewer_id": viewer_id,
            "platform": platform,
            "channel_name": channel_name
        }
        
    except Exception as e:
        logger.error(f"Error getting user balance: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения баланса")

@points_router.post("/add")
async def add_points(
    request: AddPointsRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавление баллов пользователю"""
    try:
        success = points_service.add_points(
            user["id"],
            request.viewer_id,
            request.viewer_name,
            request.platform,
            request.channel_name,
            request.amount,
            request.reason,
            db
        )
        
        if success:
            new_balance = points_service.get_user_points(
                user["id"], request.viewer_id, request.platform, request.channel_name, db
            )
            
            return {
                "success": True,
                "message": f"Добавлено {request.amount} баллов",
                "new_balance": new_balance
            }
        else:
            raise HTTPException(status_code=500, detail="Ошибка добавления баллов")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding points: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления баллов")

@points_router.post("/deduct")
async def deduct_points(
    request: DeductPointsRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Списание баллов у пользователя"""
    try:
        result = points_service.deduct_points(
            user["id"],
            request.viewer_id,
            request.viewer_name,
            request.platform,
            request.channel_name,
            request.amount,
            request.reason,
            db
        )
        
        if result["success"]:
            new_balance = points_service.get_user_points(
                user["id"], request.viewer_id, request.platform, request.channel_name, db
            )
            
            return {
                "success": True,
                "message": f"Списано {request.amount} баллов",
                "new_balance": new_balance
            }
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deducting points: {e}")
        raise HTTPException(status_code=500, detail="Ошибка списания баллов")

@points_router.get("/leaderboard")
async def get_leaderboard(
    channel_name: str,
    platform: Optional[str] = None,
    limit: Optional[int] = 10,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение топа пользователей по баллам"""
    try:
        leaderboard = points_service.get_channel_leaderboard(
            user["id"], channel_name, platform, limit, db
        )
        
        return {
            "success": True,
            "leaderboard": leaderboard,
            "channel_name": channel_name,
            "platform": platform
        }
        
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения топа")

# === УПРАВЛЕНИЕ НАГРАДАМИ ===

@points_router.post("/rewards/create")
async def create_reward(
    request: CreateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создание новой награды"""
    try:
        result = points_service.create_reward(
            user["id"],
            request.platform,
            request.channel_name,
            request.title,
            request.description,
            request.cost,
            icon_url=request.icon_url,
            background_color=request.background_color,
            is_user_input_required=request.is_user_input_required,
            max_per_stream=request.max_per_stream,
            max_per_user_per_stream=request.max_per_user_per_stream,
            prompt=request.prompt,
            reward_type=request.reward_type
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания награды")

@points_router.get("/rewards")
async def get_rewards(
    platform: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение наград канала"""
    try:
        rewards = points_service.get_channel_rewards(user["id"], platform, db)
        
        return {
            "success": True,
            "rewards": rewards
        }
        
    except Exception as e:
        logger.error(f"Error getting rewards: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения наград")

@points_router.post("/rewards/redeem")
async def redeem_reward(
    request: RedeemRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обмен награды за баллы"""
    try:
        result = points_service.redeem_reward(
            user["id"],
            request.reward_id,
            request.viewer_id,
            request.viewer_name,
            request.platform,
            request.channel_name,
            request.user_input
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error redeeming reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обмена награды")

@points_router.get("/rewards/queue")
async def get_reward_queue(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение очереди наград"""
    try:
        queue = points_service.get_reward_queue(user["id"], status, db)
        
        return {
            "success": True,
            "queue": queue
        }
        
    except Exception as e:
        logger.error(f"Error getting reward queue: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения очереди наград")

@points_router.post("/rewards/process")
async def process_reward(
    request: ProcessRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обработка награды модератором"""
    try:
        result = points_service.process_reward(
            user["id"],
            request.queue_id,
            request.action,
            request.moderator_note
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обработки награды")

# === СТАТИСТИКА ===

@points_router.get("/stats")
async def get_channel_stats(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики канала"""
    try:
        stats = points_service.get_channel_stats(user["id"], channel_name, db)
        
        return {
            "success": True,
            "stats": stats,
            "channel_name": channel_name
        }
        
    except Exception as e:
        logger.error(f"Error getting channel stats: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статистики")
