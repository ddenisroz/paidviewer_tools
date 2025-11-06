# tts_service/tts_control_api.py
"""TTS Control API endpoints"""
from fastapi import APIRouter, Request
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tts-control"])

# Простое хранилище состояний TTS (в реальном проекте должно быть в базе данных)
_tts_states = {}

@router.post("/tts/enable")
async def enable_tts(request: Request):
    """Включить TTS"""
    try:
        # Получаем user_id из сессии (если есть)
        user_id = 1  # Заглушка для тестирования
        session_id = request.cookies.get('session_id')
        if session_id:
            # Здесь должна быть логика получения user_id из сессии
            user_id = 1
        
        # Сохраняем состояние TTS
        _tts_states[user_id] = {"enabled": True}
        
        logger.info(f"TTS enabled for user {user_id}")
        return {"success": True, "message": "TTS включен"}
    except Exception as e:
        logger.error(f"Error enabling TTS: {e}")
        return {"success": False, "error": str(e)}

@router.post("/tts/disable")
async def disable_tts(request: Request):
    """Отключить TTS"""
    try:
        # Получаем user_id из сессии (если есть)
        user_id = 1  # Заглушка для тестирования
        session_id = request.cookies.get('session_id')
        if session_id:
            # Здесь должна быть логика получения user_id из сессии
            user_id = 1
        
        # Сохраняем состояние TTS
        _tts_states[user_id] = {"enabled": False}
        
        logger.info(f"TTS disabled for user {user_id}")
        return {"success": True, "message": "TTS отключен"}
    except Exception as e:
        logger.error(f"Error disabling TTS: {e}")
        return {"success": False, "error": str(e)}

@router.get("/tts/status")
async def get_tts_status(request: Request):
    """Получить статус TTS"""
    try:
        # Получаем user_id из сессии (если есть)
        user_id = 1  # Заглушка для тестирования
        session_id = request.cookies.get('session_id')
        if session_id:
            # Здесь должна быть логика получения user_id из сессии
            user_id = 1
        
        # Получаем состояние TTS
        tts_state = _tts_states.get(user_id, {"enabled": False})
        
        return {
            "success": True,
            "enabled": tts_state.get("enabled", False),
            "status": tts_state
        }
    except Exception as e:
        logger.error(f"Error getting TTS status: {e}")
        return {"success": False, "error": str(e)}
