"""API для системных логов и истории действий администраторов"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from typing import Optional
from datetime import timedelta

from core.database import get_db, SystemLog, User
from core.datetime_utils import utcnow_naive
from auth.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["system-logs"])


class SystemLogService:
    """Сервис для работы с системными логами"""

    @staticmethod
    def log_action(
        db: Session,
        admin_id: int,
        action_type: str,
        description: str = None,
        target_user_id: int = None,
        target_resource: str = None,
        old_value: dict = None,
        new_value: dict = None,
        ip_address: str = None,
        user_agent: str = None,
        details: dict = None,
        status: str = "success",
        error_message: str = None
    ) -> SystemLog:
        """Логирует действие администратора"""
        try:
            log_entry = SystemLog(
                admin_id=admin_id,
                action_type=action_type,
                description=description,
                target_user_id=target_user_id,
                target_resource=target_resource,
                old_value=old_value,
                new_value=new_value,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details,
                status=status,
                error_message=error_message,
                timestamp=utcnow_naive()
            )
            db.add(log_entry)
            db.commit()
            return log_entry
        except Exception as e:
            logger.error(f"Error logging action: {e}")
            db.rollback()
            return None


@router.get("/logs")
async def get_system_logs(
    action_type: Optional[str] = None,
    admin_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    status: Optional[str] = None,
    days: int = 30,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить логи действий администраторов с фильтрацией"""
    try:
        # Проверяем права доступа - только админы
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")

        # Строим фильтры
        filters = []

        # Временной диапазон
        cutoff_date = utcnow_naive() - timedelta(days=days)
        filters.append(SystemLog.timestamp >= cutoff_date)

        if action_type:
            filters.append(SystemLog.action_type == action_type)

        if admin_id:
            filters.append(SystemLog.admin_id == admin_id)

        if target_user_id:
            filters.append(SystemLog.target_user_id == target_user_id)

        if status:
            filters.append(SystemLog.status == status)

        # Получаем логи
        logs = db.query(SystemLog).filter(and_(*filters)) if filters else db.query(SystemLog)
        total_count = logs.count()
        logs = logs.order_by(desc(SystemLog.timestamp)).limit(limit).offset(offset).all()

        # Форматируем результаты
        formatted_logs = []
        for log in logs:
            admin_user = db.query(User).filter(User.id == log.admin_id).first()
            target_user = db.query(User).filter(User.id == log.target_user_id).first() if log.target_user_id else None

            formatted_logs.append({
                "id": log.id,
                "admin_id": log.admin_id,
                "admin_name": admin_user.twitch_username or admin_user.vk_username or f"User {log.admin_id}" if admin_user else f"Unknown {log.admin_id}",
                "action_type": log.action_type,
                "description": log.description,
                "target_user_id": log.target_user_id,
                "target_user_name": target_user.twitch_username or target_user.vk_username or f"User {log.target_user_id}" if target_user else None,
                "target_resource": log.target_resource,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "ip_address": log.ip_address,
                "status": log.status,
                "error_message": log.error_message,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None
            })

        return {
            "success": True,
            "data": formatted_logs,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "pages": (total_count + limit - 1) // limit
            },
            "timestamp": utcnow_naive().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting system logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/stats")
async def get_logs_statistics(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику по логам (количество действий по типам)"""
    try:
        # Проверяем права доступа - только админы
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")

        cutoff_date = utcnow_naive() - timedelta(days=days)

        # Считаем логи по типам действий
        from sqlalchemy import func, case
        action_stats = db.query(
            SystemLog.action_type,
            func.count(SystemLog.id).label('count'),
            func.sum(case((SystemLog.status == 'success', 1), else_=0)).label('success_count'),
            func.sum(case((SystemLog.status == 'failed', 1), else_=0)).label('failed_count')
        ).filter(SystemLog.timestamp >= cutoff_date).group_by(SystemLog.action_type).all()

        # Считаем логи по админам
        admin_stats = db.query(
            SystemLog.admin_id,
            func.count(SystemLog.id).label('count')
        ).filter(SystemLog.timestamp >= cutoff_date).group_by(SystemLog.admin_id).order_by(desc(func.count(SystemLog.id))).limit(10).all()

        # Форматируем результаты
        action_data = []
        for action_type, count, success, failed in action_stats:
            action_data.append({
                "action_type": action_type,
                "total": count,
                "success": success,
                "failed": failed,
                "success_rate": round((success / count * 100), 2) if count > 0 else 0
            })

        admin_data = []
        for admin_id, count in admin_stats:
            admin_user = db.query(User).filter(User.id == admin_id).first()
            admin_data.append({
                "admin_id": admin_id,
                "admin_name": admin_user.twitch_username or admin_user.vk_username or f"User {admin_id}" if admin_user else f"Unknown {admin_id}",
                "action_count": count
            })

        return {
            "success": True,
            "data": {
                "actions_by_type": action_data,
                "top_admins": admin_data,
                "total_logs": db.query(SystemLog).filter(SystemLog.timestamp >= cutoff_date).count(),
                "days": days
            },
            "timestamp": utcnow_naive().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting logs statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/actions")
async def get_available_actions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список доступных типов действий"""
    try:
        # Проверяем права доступа - только админы
        if not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Admin access required")

        from sqlalchemy import distinct

        # Получаем все уникальные типы действий
        action_types = db.query(distinct(SystemLog.action_type)).all()

        return {
            "success": True,
            "data": [action[0] for action in action_types if action[0]],
            "timestamp": utcnow_naive().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available actions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
