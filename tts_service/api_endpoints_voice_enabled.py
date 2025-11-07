# tts_service/api_endpoints_voice_enabled.py
"""API endpoints для управления включенными голосами пользователя"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from tts_service.database import get_db, Voice as VoiceModel, UserVoiceEnabled

logger = logging.getLogger(__name__)

voice_enabled_router = APIRouter(prefix="/user/voices/enabled", tags=["voice-enabled"])


@voice_enabled_router.get("/{user_id}")
async def get_user_enabled_voices(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Получить список ID включенных голосов для пользователя"""
    try:
        # Получаем все записи enabled для пользователя
        enabled_records = db.query(UserVoiceEnabled).filter(
            UserVoiceEnabled.user_id == user_id,
            UserVoiceEnabled.is_enabled == True
        ).all()
        
        # Если нет записей, возвращаем все доступные голоса как включенные по умолчанию
        if not enabled_records:
            all_voices = db.query(VoiceModel).filter(
                VoiceModel.is_active == True
            ).all()
            
            enabled_voice_ids = [v.id for v in all_voices]
            logger.info(f"No enabled voices found for user {user_id}, returning all {len(enabled_voice_ids)} voices as enabled by default")
        else:
            enabled_voice_ids = [record.voice_id for record in enabled_records]
            logger.info(f"Found {len(enabled_voice_ids)} enabled voices for user {user_id}")
        
        return {
            "success": True,
            "enabled_voice_ids": enabled_voice_ids
        }
        
    except Exception as e:
        logger.error(f"Error getting enabled voices for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@voice_enabled_router.post("/{user_id}")
async def update_user_enabled_voices(
    user_id: int,
    voice_ids: List[int],
    db: Session = Depends(get_db)
):
    """Обновить список включенных голосов для пользователя"""
    try:
        # Получаем все доступные голоса
        all_voices = db.query(VoiceModel).filter(
            VoiceModel.is_active == True
        ).all()
        
        all_voice_ids = {v.id for v in all_voices}
        provided_voice_ids = set(voice_ids)
        
        # Проверяем что все переданные ID существуют
        invalid_ids = provided_voice_ids - all_voice_ids
        if invalid_ids:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid voice IDs: {invalid_ids}"
            )
        
        # Удаляем все существующие записи для пользователя
        db.query(UserVoiceEnabled).filter(
            UserVoiceEnabled.user_id == user_id
        ).delete()
        
        # Создаем новые записи для включенных голосов
        for voice_id in all_voice_ids:
            is_enabled = voice_id in provided_voice_ids
            
            record = UserVoiceEnabled(
                user_id=user_id,
                voice_id=voice_id,
                is_enabled=is_enabled
            )
            db.add(record)
        
        db.commit()
        
        logger.info(f"✅ Updated enabled voices for user {user_id}: {len(voice_ids)} enabled out of {len(all_voice_ids)} total")
        
        return {
            "success": True,
            "message": f"Enabled voices updated: {len(voice_ids)} voices enabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating enabled voices for user {user_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@voice_enabled_router.put("/{user_id}/{voice_id}")
async def toggle_voice_enabled(
    user_id: int,
    voice_id: int,
    is_enabled: bool,
    db: Session = Depends(get_db)
):
    """Включить/выключить конкретный голос для пользователя"""
    try:
        # Проверяем что голос существует
        voice = db.query(VoiceModel).filter(
            VoiceModel.id == voice_id,
            VoiceModel.is_active == True
        ).first()
        
        if not voice:
            raise HTTPException(status_code=404, detail="Voice not found")
        
        # Ищем существующую запись
        record = db.query(UserVoiceEnabled).filter(
            UserVoiceEnabled.user_id == user_id,
            UserVoiceEnabled.voice_id == voice_id
        ).first()
        
        if record:
            # Обновляем существующую
            record.is_enabled = is_enabled
        else:
            # Создаем новую
            record = UserVoiceEnabled(
                user_id=user_id,
                voice_id=voice_id,
                is_enabled=is_enabled
            )
            db.add(record)
        
        db.commit()
        
        status_text = "enabled" if is_enabled else "disabled"
        logger.info(f"✅ Voice {voice_id} {status_text} for user {user_id}")
        
        return {
            "success": True,
            "message": f"Voice {status_text} successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling voice {voice_id} for user {user_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

