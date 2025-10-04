# bot_service/api/voices_api_endpoints.py
from fastapi import APIRouter, Depends, HTTPException, Request, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
import requests
import os

from core.database import get_db

logger = logging.getLogger('bot_service')

# Создаем роутер для Voices API
voices_router = APIRouter(prefix="/api/voices", tags=["voices"])

# Pydantic модели для API
class VoiceSchema(BaseModel):
    id: int
    name: str
    file_path: str
    voice_type: str
    owner_id: Optional[int] = None
    is_public: bool = False
    is_active: bool = True
    reference_text: Optional[str] = None
    created_at: Optional[str] = None

class TranscriptionResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    message: str

@voices_router.get("/", response_model=List[VoiceSchema])
async def get_all_voices(
    request: Request,
    db: Session = Depends(get_db)
):
    """Получить все голоса"""
    try:
        # Получаем голоса из TTS сервиса
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        response = requests.get(f"{tts_service_url}/api/voices")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка получения голосов")
    except Exception as e:
        logger.error(f"Error getting voices: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения голосов")

@voices_router.post("/{voice_id}/transcribe", response_model=TranscriptionResponse)
@voices_router.post("/admin/{voice_id}/transcribe", response_model=TranscriptionResponse)
async def transcribe_voice(
    voice_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Транскрибировать голос (универсальный эндпоинт)"""
    try:
        # Отправляем запрос на транскрибацию в TTS сервис
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        response = requests.post(f"{tts_service_url}/api/voices/{voice_id}/transcribe")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка транскрибации")
    except Exception as e:
        logger.error(f"Error transcribing voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка транскрибации")

@voices_router.post("/user/{voice_id}/transcribe", response_model=TranscriptionResponse)
async def transcribe_user_voice(
    voice_id: int,
    user_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Транскрибировать пользовательский голос"""
    try:
        # Отправляем запрос на транскрибацию в TTS сервис
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        response = requests.post(f"{tts_service_url}/api/user/voices/{voice_id}/transcribe?user_id={user_id}")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка транскрибации")
    except Exception as e:
        logger.error(f"Error transcribing user voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка транскрибации")

@voices_router.delete("/{voice_id}")
async def delete_voice(
    voice_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Удалить голос"""
    try:
        # Отправляем запрос на удаление в TTS сервис
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        response = requests.delete(f"{tts_service_url}/api/voices/{voice_id}")
        
        if response.status_code == 200:
            return {"success": True, "message": "Голос удален"}
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка удаления голоса")
    except Exception as e:
        logger.error(f"Error deleting voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления голоса")

@voices_router.put("/{voice_id}/rename")
async def rename_voice(
    voice_id: int,
    new_name: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Переименовать голос"""
    try:
        # Отправляем запрос на переименование в TTS сервис
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        response = requests.put(f"{tts_service_url}/api/voices/{voice_id}/rename", 
                               data={"new_name": new_name})
        
        if response.status_code == 200:
            return {"success": True, "message": "Голос переименован"}
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка переименования голоса")
    except Exception as e:
        logger.error(f"Error renaming voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка переименования голоса")

@voices_router.put("/user/{voice_id}/rename")
async def rename_user_voice(
    voice_id: int,
    user_id: int,
    new_name: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Переименовать пользовательский голос"""
    try:
        # Отправляем запрос на переименование в TTS сервис
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        response = requests.put(f"{tts_service_url}/api/user/voices/{voice_id}/rename", 
                               data={"new_name": new_name, "user_id": user_id})
        
        if response.status_code == 200:
            return {"success": True, "message": "Голос переименован"}
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка переименования голоса")
    except Exception as e:
        logger.error(f"Error renaming user voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка переименования голоса")

@voices_router.post("/test")
async def test_voices_endpoint(
    voice_name: str = Form(...),
    test_text: str = Form(...),  # Исправляем: test_text вместо text
    user_id: int = Form(None),
    cfg_strength: float = Form(None),
    speed_preset: str = Form(None),
    request: Request = None
):
    """Тестовый endpoint для проверки работы API"""
    # ДИАГНОСТИКА: Логируем ВСЕ что получили
    logger.info(f"=" * 80)
    logger.info(f"🎬 TEST VOICE ENDPOINT CALLED")
    logger.info(f"  voice_name: {voice_name} (type: {type(voice_name)})")
    logger.info(f"  test_text: {test_text[:50]}...")
    logger.info(f"  user_id: {user_id} (type: {type(user_id)})")
    logger.info(f"  cfg_strength: {cfg_strength} (type: {type(cfg_strength)})")
    logger.info(f"  speed_preset: {speed_preset} (type: {type(speed_preset)})")
    logger.info(f"=" * 80)
    
    try:
        # Отправляем запрос в TTS сервис
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        
        # Подготавливаем данные для отправки
        logger.info(f"🎯 Received parameters: cfg_strength={cfg_strength}, speed_preset={speed_preset}")
        
        # Формируем данные для отправки (все как строки для form-data)
        fields = {
            "voice_name": voice_name,
            "test_text": test_text,
        }
        
        # Добавляем опциональные параметры
        if user_id is not None:
            fields["user_id"] = str(user_id)
        if cfg_strength is not None:
            fields["cfg_strength"] = str(cfg_strength)
            logger.info(f"  ✅ Adding cfg_strength: {cfg_strength}")
        if speed_preset is not None:
            fields["speed_preset"] = speed_preset
            logger.info(f"  ✅ Adding speed_preset: {speed_preset}")
        
        logger.info(f"🚀 Testing voice with fields: {fields}")
        
        # Отправляем как form-data
        response = requests.post(f"{tts_service_url}/api/voices/test", data=fields)
        
        logger.info(f"TTS service response: {response.status_code}")
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"TTS service error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Ошибка тестирования голоса: {response.text}")
    except Exception as e:
        logger.error(f"Error testing voice {voice_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка тестирования голоса")

@voices_router.put("/{voice_id}/settings")
async def update_voice_settings(
    voice_id: int,
    settings: dict,
    request: Request = None
):
    """Обновить настройки голоса"""
    try:
        # Отправляем запрос в TTS сервис
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        
        logger.info(f"Updating voice {voice_id} settings: {settings}")
        
        response = requests.put(f"{tts_service_url}/api/voices/{voice_id}/settings", json=settings)
        
        logger.info(f"TTS service response: {response.status_code}")
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"TTS service error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Ошибка обновления настроек голоса: {response.text}")
    except Exception as e:
        logger.error(f"Error updating voice {voice_id} settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления настроек голоса")
