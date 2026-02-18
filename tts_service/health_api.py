# tts_service/health_api.py
"""API для проверки здоровья TTS Service"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from tts_service.database import get_db
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.background_tasks import background_task_manager
from monitoring import tts_monitor
import logging

logger = logging.getLogger(__name__)

health_router = APIRouter(tags=["health"])

@health_router.get("/health")
async def health_check():
    """Базовая проверка здоровья"""
    # [OK] Проверяем готовность движка
    try:
        tts_engine_loaded = tts_engine_manager.is_ready()
    except Exception:
        logger.exception("Error checking TTS engine readiness")
        # Fallback: проверяем базовую инициализацию
        tts_engine_loaded = getattr(tts_engine_manager, 'is_initialized', False) and tts_engine_manager.tts_engine is not None
    
    return {
        "status": "healthy",
        "service": "tts_service",
        "version": "1.0.0",
        "tts_engine_loaded": tts_engine_loaded
    }

# Создаем отдельный роутер для /api/health
api_health_router = APIRouter(tags=["health"])

@api_health_router.get("/health")
async def api_health_check_alias():
    """Алиас для /health для совместимости с bot_service"""
    return await health_check()

@health_router.get("/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Детальная проверка здоровья"""
    try:
        # Проверяем базу данных
        db_status = "healthy"
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.exception("Database health check failed")
            db_status = "error"
        
        # Проверяем TTS движок
        tts_status = "healthy" if tts_engine_manager.is_initialized() else "not_initialized"
        
        # Проверяем файловый менеджер
        file_status = "healthy" if file_manager.is_initialized() else "not_initialized"
        
        # Проверяем фоновые задачи
        bg_status = "running" if background_task_manager.is_running() else "stopped"
        
        # Получаем метрики мониторинга
        metrics = tts_monitor.get_metrics()
        
        return {
            "status": "healthy",
            "components": {
                "database": db_status,
                "tts_engine": tts_status,
                "file_manager": file_status,
                "background_tasks": bg_status
            },
            "metrics": metrics
        }
    except Exception:
        logger.exception("Health check error")
        raise HTTPException(status_code=500, detail="Internal server error")

@health_router.get("/metrics")
async def get_metrics():
    """Получить метрики системы"""
    try:
        metrics = tts_monitor.get_metrics()
        return {
            "status": "success",
            "metrics": metrics
        }
    except Exception:
        logger.exception("Metrics error")
        raise HTTPException(status_code=500, detail="Internal server error")

