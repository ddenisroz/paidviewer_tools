from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from core.database import get_db, User
from auth.auth import get_current_user
from integrations.drops_integration import get_user_drops_stats

router = APIRouter(prefix="/api/drops/stats", tags=["drops-stats"])

@router.get("/")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику дропов пользователя"""
    user_id = str(current_user.id)
    
    try:
        stats = get_user_drops_stats(user_id)
        return {
            "user_id": user_id,
            "username": current_user.username,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")

@router.get("/leaderboard")
async def get_leaderboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить таблицу лидеров (заглушка)"""
    # Здесь можно добавить логику для получения лидеров
    return {
        "message": "Leaderboard feature coming soon",
        "leaderboard": []
    }
