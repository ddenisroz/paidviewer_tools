# bot_service/api/database_management_api.py
"""Эндпоинты обслуживания и гигиены базы данных."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth.auth import get_current_user
from core.database import get_db
from core.datetime_utils import utcnow_naive
from services.database_cleanup_service import DatabaseCleanupService


class CleanupRequest(BaseModel):
    cleanup_type: Literal["all", "logs", "cache", "backup", "restore"] = "all"


class HygieneCleanupRequest(BaseModel):
    clean_orphan_users: bool = True
    clean_inactive_sessions: bool = True
    inactive_session_days: int = Field(default=7, ge=1, le=365)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/database", tags=["database-management"])


def _require_admin(current_user: dict) -> None:
    if not (current_user.get("role") == "admin" or current_user.get("is_admin")):
        raise HTTPException(status_code=403, detail="Доступ запрещён")


@router.get("/stats")
async def get_database_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated database statistics."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        stats = cleanup_service.get_database_stats()

        return {
            "success": True,
            "data": stats,
            "timestamp": utcnow_naive().isoformat(),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting database stats")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/backups")
async def list_backups(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List available database backups."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        result = cleanup_service.list_backups()

        return {
            "success": True,
            "data": result,
            "timestamp": utcnow_naive().isoformat(),
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error listing backups")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/cleanup")
async def cleanup_database(
    request: CleanupRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run selected cleanup operation."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        cleanup_type = request.cleanup_type

        result: dict = {
            "success": True,
            "data": {},
            "message": "Очистка завершена",
            "timestamp": utcnow_naive().isoformat(),
        }

        if cleanup_type in ["logs", "all"]:
            log_stats = cleanup_service.cleanup_old_data()
            result["data"]["logs"] = log_stats
            logger.info("Cleaned up logs: %s", log_stats)

        if cleanup_type in ["cache", "all"]:
            cache_cleanup = cleanup_service.cleanup_cache()
            result["data"]["cache"] = cache_cleanup
            logger.info("Cleaned up cache: %s", cache_cleanup)

        if cleanup_type == "backup":
            backup_result = cleanup_service.create_backup()
            result["data"]["backup"] = backup_result
            result["message"] = "Резервная копия создана"
            logger.info("Backup created: %s", backup_result)

        if cleanup_type == "restore":
            restore_result = cleanup_service.restore_from_backup()
            result["data"]["restore"] = restore_result
            result["message"] = "База восстановлена из резервной копии"
            logger.info("Restored from backup: %s", restore_result)

        return result

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error cleaning up database")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/hygiene/preview")
async def preview_database_hygiene(
    inactive_session_days: int = 7,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Preview orphan user-owned rows and inactive sessions eligible for cleanup."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        return {
            "success": True,
            "data": {
                "orphan_user_records": cleanup_service.preview_orphan_user_records(),
                "inactive_sessions": cleanup_service.preview_inactive_session_cleanup(inactive_session_days),
            },
            "timestamp": utcnow_naive().isoformat(),
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error previewing database hygiene")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/hygiene/cleanup")
async def cleanup_database_hygiene(
    request: HygieneCleanupRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run orphan row cleanup and/or inactive session retention cleanup."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        result: dict = {
            "success": True,
            "data": {},
            "message": "Гигиена базы данных выполнена",
            "timestamp": utcnow_naive().isoformat(),
        }

        if request.clean_orphan_users:
            orphan_result = cleanup_service.cleanup_orphan_user_records()
            result["data"]["orphan_user_records"] = orphan_result

        if request.clean_inactive_sessions:
            session_result = cleanup_service.cleanup_inactive_sessions(request.inactive_session_days)
            result["data"]["inactive_sessions"] = session_result

        return result
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error cleaning database hygiene")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.delete("/backups/{filename}")
async def delete_backup(
    filename: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete backup by filename."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        result = cleanup_service.delete_backup(filename)

        if not result.get("success"):
            raise HTTPException(status_code=400, detail="Не удалось удалить резервную копию")

        return {
            "success": True,
            "data": result,
            "message": f"Резервная копия {filename} удалена",
            "timestamp": utcnow_naive().isoformat(),
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error deleting backup")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/backups/{filename}/restore")
async def restore_backup(
    filename: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore database from selected backup file."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        result = cleanup_service.restore_from_backup_file(filename)

        if not result.get("success"):
            raise HTTPException(status_code=400, detail="Не удалось восстановить резервную копию")

        return {
            "success": True,
            "data": result,
            "message": result.get("message", f"База восстановлена из {filename}"),
            "timestamp": utcnow_naive().isoformat(),
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error restoring backup")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/optimize")
async def optimize_database(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run database optimization routine."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        optimization_result = cleanup_service.optimize_database()

        return {
            "success": True,
            "data": optimization_result,
            "message": "Оптимизация базы данных завершена",
            "timestamp": utcnow_naive().isoformat(),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error optimizing database")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/user-stats/{username}")
async def get_user_database_stats(
    username: str,
    platform: str = "twitch",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get message count stats for a specific user."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        message_count = cleanup_service.get_user_message_count(username, platform)

        return {
            "success": True,
            "data": {
                "username": username,
                "platform": platform,
                "message_count": message_count,
            },
            "timestamp": utcnow_naive().isoformat(),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting user database stats")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/cleanup-user/{username}")
async def cleanup_user_data(
    username: str,
    platform: str = "twitch",
    keep_days: int = 30,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cleanup old messages for specific user and platform."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        deleted_count = cleanup_service.cleanup_user_data(username, platform, keep_days)

        return {
            "success": True,
            "data": {
                "username": username,
                "platform": platform,
                "deleted_messages": deleted_count,
                "keep_days": keep_days,
            },
            "message": f"Cleaned {deleted_count} old messages for user {username}",
            "timestamp": utcnow_naive().isoformat(),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error cleaning up user data")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/sync-message-counts")
async def sync_message_counts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sync persisted per-user message counters with actual chat data."""
    try:
        _require_admin(current_user)

        cleanup_service = DatabaseCleanupService(db)
        sync_stats = cleanup_service.sync_user_message_counts()

        return {
            "success": True,
            "data": sync_stats,
            "message": (
                f"Synced {sync_stats.get('users_updated', 0)} users, "
                f"fixed {sync_stats.get('total_discrepancies', 0)} discrepancies"
            ),
            "timestamp": utcnow_naive().isoformat(),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error syncing message counts")
        raise HTTPException(status_code=500, detail="Internal server error")
