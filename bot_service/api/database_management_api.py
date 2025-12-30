# api/database_management_api.py
import logging
from core.datetime_utils import utcnow_naive
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from services.database_cleanup_service import DatabaseCleanupService
from auth.auth import get_current_user

class CleanupRequest(BaseModel):
    cleanup_type: str = "all"

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
        if not current_user.get("is_admin"):
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

@router.get("/backups")
async def list_backups(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех резервных копий"""
    try:
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Access denied")

        cleanup_service = DatabaseCleanupService(db)
        result = cleanup_service.list_backups()

        return {
            "success": True,
            "data": result,
            "timestamp": utcnow_naive().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing backups: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup")
async def cleanup_database(
    request: CleanupRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очищает старые данные из базы данных"""
    try:
        # Проверяем права доступа (только админы)
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Access denied")

        cleanup_service = DatabaseCleanupService(db)
        cleanup_type = request.cleanup_type

        result = {
            "success": True,
            "data": {},
            "message": "Cleanup completed",
            "timestamp": utcnow_naive().isoformat()
        }

        # Выполняем очистку в зависимости от типа
        if cleanup_type in ["logs", "all"]:
            # Очистка логов старше 30 дней
            log_stats = cleanup_service.cleanup_old_data()
            result["data"]["logs"] = log_stats
            logger.info(f"Cleaned up logs: {log_stats}")

        if cleanup_type in ["cache", "all"]:
            # Очистка кеша
            cache_cleanup = cleanup_service.cleanup_cache()
            result["data"]["cache"] = cache_cleanup
            logger.info(f"Cleaned up cache: {cache_cleanup}")

        if cleanup_type == "backup":
            # Создание резервной копии
            backup_result = cleanup_service.create_backup()
            result["data"]["backup"] = backup_result
            result["message"] = "Backup created successfully"
            logger.info(f"Backup created: {backup_result}")

        if cleanup_type == "restore":
            # Восстановление из резервной копии
            restore_result = cleanup_service.restore_from_backup()
            result["data"]["restore"] = restore_result
            result["message"] = "Restored from backup successfully"
            logger.info(f"Restored from backup: {restore_result}")

        return result

    except Exception as e:
        logger.error(f"Error cleaning up database: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/backups/{filename}")
async def delete_backup(
    filename: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить конкретную резервную копию"""
    try:
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Access denied")

        cleanup_service = DatabaseCleanupService(db)
        result = cleanup_service.delete_backup(filename)

        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error', 'Failed to delete backup'))

        return {
            "success": True,
            "data": result,
            "message": f"Backup {filename} deleted successfully",
            "timestamp": utcnow_naive().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting backup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backups/{filename}/restore")
async def restore_backup(
    filename: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Восстановить БД из конкретной резервной копии"""
    try:
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Access denied")

        cleanup_service = DatabaseCleanupService(db)
        result = cleanup_service.restore_from_backup_file(filename)

        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error', 'Failed to restore backup'))

        return {
            "success": True,
            "data": result,
            "message": result.get('message', f"Database restored from {filename}"),
            "timestamp": utcnow_naive().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring backup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize")
async def optimize_database(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Оптимизирует базу данных"""
    try:
        # Проверяем права доступа (только админы)
        if not current_user.get("is_admin"):
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
        if not current_user.get("is_admin"):
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
        if not current_user.get("is_admin"):
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
        if not current_user.get("is_admin"):
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
