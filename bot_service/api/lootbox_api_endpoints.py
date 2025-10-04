# api/lootbox_api_endpoints.py
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from pydantic import BaseModel

from core.database import get_db
from services.lootbox_service import LootboxService
from auth.auth import get_current_user

logger = logging.getLogger(__name__)

lootbox_router = APIRouter()

# === PYDANTIC МОДЕЛИ ===

class LootboxCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # free, paid
    price: float = 0.0

class LootboxRewardCreate(BaseModel):
    lootbox_id: int
    name: str
    description: Optional[str] = None
    type: str
    value: str  # JSON string
    weight: int = 1

class AchievementCreate(BaseModel):
    channel_name: str
    name: str
    description: str
    type: str
    requirement_value: int
    reward_type: str
    reward_value: int = 1

class LootboxOpenRequest(BaseModel):
    lootbox_id: int

# === ЭНДПОИНТЫ ===

@lootbox_router.get("/progression/{channel_name}")
async def get_user_progression(
    channel_name: str,
    db: Session = Depends(get_db)
):
    """Получить прогрессию пользователя в канале"""
    try:
        lootbox_service = LootboxService(db)
        # Для публичного доступа возвращаем общую статистику канала
        progression = lootbox_service.get_channel_progression(channel_name)
        
        if not progression:
            return {"message": "No progression found", "progression": None}
        
        return {"success": True, "progression": progression}
    except Exception as e:
        logger.error(f"Error getting user progression: {e}")
        raise HTTPException(status_code=500, detail="Error getting progression")

@lootbox_router.get("/lootboxes/{channel_name}")
async def get_channel_lootboxes(
    channel_name: str,
    db: Session = Depends(get_db)
):
    """Получить лутбоксы канала"""
    try:
        lootbox_service = LootboxService(db)
        lootboxes = lootbox_service.get_channel_lootboxes(channel_name)
        
        return {"success": True, "lootboxes": lootboxes}
    except Exception as e:
        logger.error(f"Error getting channel lootboxes: {e}")
        raise HTTPException(status_code=500, detail="Error getting lootboxes")

@lootbox_router.post("/open")
async def open_lootbox(
    request: LootboxOpenRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Открыть лутбокс"""
    try:
        lootbox_service = LootboxService(db)
        
        # Получаем канал пользователя
        channel_name = user.get("display_name", user.get("username", ""))
        if not channel_name:
            raise HTTPException(status_code=400, detail="Channel name not found")
        
        result = lootbox_service.open_lootbox(user["id"], channel_name, request.lootbox_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Lootbox not found or inactive")
        
        return {"success": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error opening lootbox: {e}")
        raise HTTPException(status_code=500, detail="Error opening lootbox")

@lootbox_router.get("/recent/{channel_name}")
async def get_recent_openings(
    channel_name: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Получить последние открытия лутбоксов в канале"""
    try:
        lootbox_service = LootboxService(db)
        openings = lootbox_service.get_recent_openings(channel_name, limit)
        
        return {"success": True, "openings": openings}
    except Exception as e:
        logger.error(f"Error getting recent openings: {e}")
        raise HTTPException(status_code=500, detail="Error getting recent openings")

# === АДМИН ЭНДПОИНТЫ ===

@lootbox_router.post("/admin/lootbox")
async def create_lootbox(
    request: LootboxCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать лутбокс (только для админов)"""
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from core.database import Lootbox
        
        lootbox = Lootbox(
            channel_name=user.get("display_name", user.get("username", "")),
            name=request.name,
            description=request.description,
            type=request.type,
            price=request.price
        )
        
        db.add(lootbox)
        db.commit()
        db.refresh(lootbox)
        
        return {"success": True, "lootbox_id": lootbox.id}
    except Exception as e:
        logger.error(f"Error creating lootbox: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error creating lootbox")

@lootbox_router.post("/admin/lootbox/reward")
async def create_lootbox_reward(
    request: LootboxRewardCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать награду для лутбокса (только для админов)"""
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from core.database import LootboxReward
        
        reward = LootboxReward(
            lootbox_id=request.lootbox_id,
            name=request.name,
            description=request.description,
            type=request.type,
            value=request.value,
            weight=request.weight
        )
        
        db.add(reward)
        db.commit()
        db.refresh(reward)
        
        return {"success": True, "reward_id": reward.id}
    except Exception as e:
        logger.error(f"Error creating lootbox reward: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error creating lootbox reward")

@lootbox_router.post("/admin/achievement")
async def create_achievement(
    request: AchievementCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать достижение (только для админов)"""
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from core.database import Achievement
        
        achievement = Achievement(
            channel_name=request.channel_name,
            name=request.name,
            description=request.description,
            type=request.type,
            requirement_value=request.requirement_value,
            reward_type=request.reward_type,
            reward_value=request.reward_value
        )
        
        db.add(achievement)
        db.commit()
        db.refresh(achievement)
        
        return {"success": True, "achievement_id": achievement.id}
    except Exception as e:
        logger.error(f"Error creating achievement: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error creating achievement")

@lootbox_router.get("/admin/achievements/{channel_name}")
async def get_channel_achievements(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить достижения канала (только для админов)"""
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from core.database import Achievement
        
        achievements = db.query(Achievement).filter(
            Achievement.channel_name == channel_name
        ).all()
        
        result = [
            {
                "id": achievement.id,
                "name": achievement.name,
                "description": achievement.description,
                "type": achievement.type,
                "requirement_value": achievement.requirement_value,
                "reward_type": achievement.reward_type,
                "reward_value": achievement.reward_value,
                "is_active": achievement.is_active,
                "created_at": achievement.created_at.isoformat()
            }
            for achievement in achievements
        ]
        
        return {"success": True, "achievements": result}
    except Exception as e:
        logger.error(f"Error getting channel achievements: {e}")
        raise HTTPException(status_code=500, detail="Error getting achievements")
