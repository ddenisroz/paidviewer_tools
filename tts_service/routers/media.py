from fastapi import APIRouter, HTTPException, Depends
import logging
import os
from pathlib import Path
from sqlalchemy.orm import Session
from tts_service.database import get_db
from tts_service.config import config
from tts_service.database import Voice as VoiceModel

router = APIRouter(tags=["media"])
logger = logging.getLogger(__name__)

@router.get("/audio/{voice_name}")
async def get_audio_file(voice_name: str):
    """Получить аудио файл голоса (для предпрослушивания)"""
    try:
        # Проверяем существование файла в voices
        # Это для старой логики, где voice_name мог быть именем файла
        voice_path = config.voices_path / f"{voice_name}.wav"
        if not voice_path.exists():
            # Пробуем найти как mp3
            voice_path = config.voices_path / f"{voice_name}.mp3"
            
        if not voice_path.exists():
             raise HTTPException(status_code=404, detail="Audio file not found")
             
        from fastapi.responses import FileResponse
        return FileResponse(voice_path)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving audio file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/audio/{voice_name}")
async def delete_audio_file(voice_name: str):
    """Удалить аудио файл (для тестовых файлов)"""
    # Ограничить использование только для админов или тестов
    try:
        voice_path = config.audio_path / voice_name
        if voice_path.exists():
            os.remove(voice_path)
            return {"status": "success", "message": "File deleted"}
        return {"status": "error", "message": "File not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/voices/global")
async def get_global_voices(db: Session = Depends(get_db)):
    """Получить глобальные голоса (доступные всем)"""
    try:
        voices = db.query(VoiceModel).filter(
            VoiceModel.is_global.is_(True),
            VoiceModel.is_active.is_(True)
        ).all()
        
        return [
            {
                "id": voice.id,
                "name": voice.name,
                "voice_type": voice.voice_type,
                "is_global": voice.is_global,
                "is_active": voice.is_active,
                "cfg_strength": voice.cfg_strength,
                "speed_preset": voice.speed_preset,
                "reference_text": voice.reference_text,
                "created_at": voice.created_at.isoformat() if voice.created_at else None
            }
            for voice in voices
        ]
    except Exception as e:
        logger.error(f"Error getting global voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/voices/{voice_id}")
async def get_voice_by_id(voice_id: int, db: Session = Depends(get_db)):
    """Получить информацию о голосе по ID"""
    try:
        voice = db.query(VoiceModel).filter(VoiceModel.id == voice_id).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        return {
            "id": voice.id,
            "name": voice.name,
            "voice_type": voice.voice_type,
            "owner_id": voice.owner_id,
            "is_global": voice.is_global,
            "is_active": voice.is_active,
            "cfg_strength": voice.cfg_strength,
            "speed_preset": voice.speed_preset,
            "reference_text": voice.reference_text,
            "created_at": voice.created_at.isoformat() if voice.created_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/voices")
async def get_all_voices(db: Session = Depends(get_db)):
    """Получить все голоса (для админки)"""
    try:
        voices = db.query(VoiceModel).all()
        return [
            {
                "id": voice.id,
                "name": voice.name,
                "voice_type": voice.voice_type,
                "owner_id": voice.owner_id,
                "is_global": voice.is_global,
                "is_active": voice.is_active,
                "cfg_strength": voice.cfg_strength,
                "speed_preset": voice.speed_preset,
                "created_at": voice.created_at.isoformat() if voice.created_at else None
            }
            for voice in voices
        ]
    except Exception as e:
        logger.error(f"Error getting all voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))
