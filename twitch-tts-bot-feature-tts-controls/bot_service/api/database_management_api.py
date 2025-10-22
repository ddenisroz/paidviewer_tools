# api/database_management_api.py
import logging
from datetime import datetime
from core.datetime_utils import utcnow_naive
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from services.database_cleanup_service import DatabaseCleanupService
from auth.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/database", tags=["database-management"])

@router.get("/stats")
async def get_database_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает статистику базы данных"""
    try:
        # Проверяем права доступа (только админы)
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        cleanup_service = DatabaseCleanupService(db)
        stats = cleanup_service.get_database_stats()
        
        return {
            "success": True,
            "data": stats,
            "timestamp": utcnow_naive().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting database stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup")
async def cleanup_database(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очищает старые данные из базы данных"""
    try:
        # Проверяем права доступа (только админы)
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        cleanup_service = DatabaseCleanupService(db)
        cleanup_stats = cleanup_service.cleanup_old_data()
        
        return {
            "success": True,
            "data": cleanup_stats,
            "message": "Database cleanup completed",
            "timestamp": utcnow_naive().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up database: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize")
async def optimize_database(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Оптимизирует базу данных"""
    try:
        # Проверяем права доступа (только админы)
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        cleanup_service = DatabaseCleanupService(db)
        optimization_result = cleanup_service.optimize_database()
        
        return {
            "success": True,
            "data": optimization_result,
            "message": "Database optimization completed",
            "timestamp": utcnow_naive().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error optimizing database: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-stats/{username}")
async def get_user_database_stats(
    username: str,
    platform: str = "twitch",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает статистику сообщений конкретного пользователя"""
    try:
        # Проверяем права доступа (только админы)
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        cleanup_service = DatabaseCleanupService(db)
        message_count = cleanup_service.get_user_message_count(username, platform)
        
        return {
            "success": True,
            "data": {
                "username": username,
                "platform": platform,
                "message_count": message_count
            },
            "timestamp": utcnow_naive().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting user database stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup-user/{username}")
async def cleanup_user_data(
    username: str,
    platform: str = "twitch",
    keep_days: int = 30,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очищает старые данные конкретного пользователя"""
    try:
        # Проверяем права доступа (только админы)
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        cleanup_service = DatabaseCleanupService(db)
        deleted_count = cleanup_service.cleanup_user_data(username, platform, keep_days)
        
        return {
            "success": True,
            "data": {
                "username": username,
                "platform": platform,
                "deleted_messages": deleted_count,
                "keep_days": keep_days
            },
            "message": f"Cleaned {deleted_count} old messages for user {username}",
            "timestamp": utcnow_naive().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up user data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-message-counts")
async def sync_message_counts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Синхронизирует счетчики сообщений пользователей с реальными данными"""
    try:
        # Проверяем права доступа (только админы)
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        cleanup_service = DatabaseCleanupService(db)
        sync_stats = cleanup_service.sync_user_message_counts()
        
        return {
            "success": True,
            "data": sync_stats,
            "message": f"Synced {sync_stats.get('users_updated', 0)} users, fixed {sync_stats.get('total_discrepancies', 0)} discrepancies",
            "timestamp": utcnow_naive().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error syncing message counts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
