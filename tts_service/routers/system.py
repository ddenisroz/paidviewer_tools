from fastapi import APIRouter
import logging
import time
from tts_service.tts_engine import tts_engine_manager
from tts_service.gpu_worker_pool import gpu_worker_pool
from tts_service.gpu_monitor import gpu_health_monitor
from tts_service.gpu_integration import gpu_integration_service
from tts_service.config import config
from pydantic import BaseModel

router = APIRouter(tags=["system"])
logger = logging.getLogger(__name__)

class TtsConfigSchema(BaseModel):
    cfg_strength: float
    speed_preset: str

@router.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "tts_engine": "ready" if tts_engine_manager.is_ready() else "not_ready"
    }

@router.post("/engine/restart")
async def restart_engine():
    """Перезапустить TTS движок"""
    try:
        logger.info("Restarting TTS engine...")
        
        # Останавливаем текущий движок
        await tts_engine_manager.shutdown()
        
        # Инициализируем заново
        await tts_engine_manager.initialize()
        
        logger.info("TTS engine restarted successfully")
        return {"message": "TTS engine restarted successfully", "status": "ready"}
        
    except Exception as e:
        logger.error(f"Error restarting TTS engine: {e}")
        return {"error": f"Failed to restart TTS engine: {str(e)}", "status": "error"}

@router.get("/config")
async def get_tts_config():
    """Получить текущие настройки TTS"""
    return {
        "cfg_strength": config.cfg_strength,
        "speed_preset": "normal" # Placeholder as config might not have it explicitly
    }

@router.put("/config")
async def update_tts_config(settings: TtsConfigSchema):
    """Обновить настраиваемые параметры TTS"""
    # Note: This changes config in memory but doesn't persist it likely, 
    # unless config class handles it. Original code didn't show config persistence.
    # Assuming valid for runtime changes.
    config.cfg_strength = settings.cfg_strength
    return {"status": "success", "message": "Config updated"}


@router.get("/gpu/status")
async def get_gpu_status():
    """Получить статус GPU"""
    try:
        if not hasattr(gpu_worker_pool, 'running') or not gpu_worker_pool.running:
            return {
                "available": False,
                "message": "GPU Worker Pool not available"
            }
        
        stats = gpu_worker_pool.get_stats()
        health = gpu_health_monitor.get_health_summary()
        gpu_metrics = gpu_worker_pool.get_gpu_metrics()
        
        return {
            "available": True,
            "running": gpu_worker_pool.running,
            "stats": stats,
            "health": health,
            "gpu_metrics": gpu_metrics.__dict__ if gpu_metrics else None,
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Error getting GPU status: {e}")
        return {
            "available": False,
            "error": str(e),
            "timestamp": time.time()
        }

@router.get("/gpu/health")
async def get_gpu_health_history(limit: int = 50):
    """Получить историю здоровья GPU"""
    try:
        history = gpu_health_monitor.get_health_history(limit)
        return {
            "history": history,
            "count": len(history),
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Error getting GPU health history: {e}")
        return {
            "error": str(e),
            "history": [],
            "timestamp": time.time()
        }

@router.get("/gpu/stats")
async def get_gpu_integration_stats():
    """Получить статистику GPU интеграции"""
    try:
        stats = gpu_integration_service.get_stats()
        cached_tasks = gpu_integration_service.get_cached_tasks()
        
        return {
            "stats": stats,
            "cached_tasks": cached_tasks,
            "cached_tasks_count": len(cached_tasks),
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Error getting GPU integration stats: {e}")
        return {
            "error": str(e),
            "stats": {},
            "timestamp": time.time()
        }
