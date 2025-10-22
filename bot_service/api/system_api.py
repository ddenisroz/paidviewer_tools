# bot_service/api/system_api.py
"""Основные системные API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.database import get_db, User
from auth.auth import get_current_user
from datetime import datetime, timedelta
# from monitoring.modern_monitor import modern_monitor  # Удалено - используем enhanced_logger
import logging
import secrets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/health")
async def health_check():
    """Проверка здоровья системы"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@router.get("/status")
async def system_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус системы"""
    try:
        # Базовая статистика
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        
        return {
            "success": True,
            "status": {
                "total_users": total_users,
                "active_users": active_users,
                "uptime": "unknown",  # Можно добавить реальное время работы
                "version": "1.0.0"
            }
        }
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return {"success": False, "error": str(e)}

@router.get("/metrics")
async def get_metrics():
    """Получить метрики Prometheus"""
    try:
        # Используем enhanced_logger вместо modern_monitor
        from utils.enhanced_logger import get_system_metrics
        metrics_summary = get_system_metrics()
        return {
            "success": True,
            "metrics": metrics_summary
        }
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        return {"success": False, "error": str(e)}

@router.get("/metrics/prometheus")
async def get_prometheus_metrics():
    """Получить метрики в формате Prometheus"""
    try:
        # Возвращаем URL для Prometheus
        return {
            "success": True,
            "prometheus_url": "http://localhost:8000/api/metrics",
            "note": "Access Prometheus metrics at the provided URL"
        }
    except Exception as e:
        logger.error(f"Error getting Prometheus URL: {e}")
        return {"success": False, "error": str(e)}

@router.get("/info")
async def system_info():
    """Получить информацию о системе"""
    return {
        "name": "TTS Bot Service",
        "version": "1.0.0",
        "description": "Text-to-Speech Bot Service with Multi-Platform Support",
        "features": [
            "Twitch Integration",
            "VK Live Integration", 
            "TTS Synthesis",
            "WebSocket Support",
            "Admin Panel"
        ]
    }

@router.post("/generate-api-key")
async def generate_api_key(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сгенерировать новый API ключ для пользователя"""
    try:
        # Проверяем права доступа
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Генерируем новый API ключ
        api_key = secrets.token_urlsafe(32)
        
        # Обновляем API ключ пользователя в БД
        user_obj = db.query(User).filter(User.id == user['id']).first()
        if user_obj:
            user_obj.api_key = api_key
            db.commit()
            
            logger.info(f"New API key generated for user {user['id']}")
            return {
                "success": True,
                "api_key": api_key,
                "message": "API key generated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        logger.error(f"Error generating API key: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}

@router.get("/logs")
async def get_system_logs(
    lines: int = 100,
    user: dict = Depends(get_current_user)
):
    """Получить системные логи"""
    try:
        # Проверяем права доступа
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # В реальной системе здесь бы читались логи из файла
        # Пока возвращаем заглушку
        return {
            "success": True,
            "logs": [
                f"System log entry {i}: {datetime.utcnow().isoformat()}" 
                for i in range(min(lines, 50))
            ],
            "total_lines": min(lines, 50)
        }
    except Exception as e:
        logger.error(f"Error getting system logs: {e}")
        return {"success": False, "error": str(e)}

@router.post("/restart")
async def restart_system(
    user: dict = Depends(get_current_user)
):
    """Перезапустить систему (заглушка)"""
    try:
        # Проверяем права доступа
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # В реальной системе здесь бы был перезапуск
        logger.warning(f"System restart requested by user {user['id']}")
        return {
            "success": True,
            "message": "Restart command sent (not implemented in development)"
        }
    except Exception as e:
        logger.error(f"Error restarting system: {e}")
        return {"success": False, "error": str(e)}
