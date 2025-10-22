# tts_service/admin_api.py
"""API для администрирования TTS Service"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from tts_service.database import get_db, Voice as VoiceModel
from tts_service.tts_engine import tts_engine_manager
from tts_service.file_manager import file_manager
from tts_service.background_tasks import background_task_manager
from tts_service.stats_service import stats_service
from monitoring import tts_monitor
import logging

logger = logging.getLogger(__name__)

admin_router = APIRouter(tags=["admin"])

@admin_router.get("/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    """Получить статистику для админки"""
    try:
        # Получаем общую статистику
        stats = stats_service.get_system_overview()
        
        # Получаем статистику голосов
        voices = db.query(VoiceModel).all()
        voice_stats = {
            "total_voices": len(voices),
            "voices": [
                {
                    "id": voice.id,
                    "name": voice.name,
                    "description": voice.description,
                    "is_active": voice.is_active,
                    "created_at": voice.created_at.isoformat() if voice.created_at else None
                }
                for voice in voices
            ]
        }
        
        # Получаем метрики мониторинга
        metrics = tts_monitor.get_metrics()
        
        return {
            "status": "success",
            "stats": stats,
            "voices": voice_stats,
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.get("/voices")
async def get_voices(db: Session = Depends(get_db)):
    """Получить список голосов"""
    try:
        voices = db.query(VoiceModel).all()
        return {
            "status": "success",
            "voices": [
                {
                    "id": voice.id,
                    "name": voice.name,
                    "description": voice.description,
                    "is_active": voice.is_active,
                    "created_at": voice.created_at.isoformat() if voice.created_at else None
                }
                for voice in voices
            ]
        }
    except Exception as e:
        logger.error(f"Get voices error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.post("/voices/{voice_id}/toggle")
async def toggle_voice(voice_id: int, db: Session = Depends(get_db)):
    """Включить/выключить голос"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        voice.is_active = not voice.is_active
        db.commit()
        
        return {
            "status": "success",
            "message": f"Voice {voice.name} {'enabled' if voice.is_active else 'disabled'}",
            "voice": {
                "id": voice.id,
                "name": voice.name,
                "is_active": voice.is_active
            }
        }
    except Exception as e:
        logger.error(f"Toggle voice error: {e}")
        db.rollback()
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.get("/system/status")
async def get_system_status():
    """Получить статус системы"""
    try:
        return {
            "status": "success",
            "system": {
                "tts_engine": tts_engine_manager.is_initialized(),
                "file_manager": file_manager.is_initialized(),
                "background_tasks": background_task_manager.is_running(),
                "monitoring": tts_monitor.is_running()
            }
        }
    except Exception as e:
        logger.error(f"System status error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@admin_router.post("/system/restart")
async def restart_system():
    """Перезапустить систему (заглушка)"""
    try:
        logger.warning("System restart requested")
        return {
            "status": "success",
            "message": "Restart command sent (not implemented in development)"
        }
    except Exception as e:
        logger.error(f"System restart error: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
