# bot_service/api/tts_api_endpoints.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field, validator
import logging
import re

from core.database import get_db
from services.tts_service import TTSService
from auth.auth import get_current_user

logger = logging.getLogger('bot_service')

# Создаем роутер для TTS API
tts_router = APIRouter(prefix="/api/tts", tags=["tts"])

# 🔒 БЕЗОПАСНОСТЬ: Санитизация
def sanitize_word(word: str) -> str:
    """Удаляет HTML теги и потенциально опасные символы"""
    if not word:
        return word
    # Удаляем HTML теги
    clean_word = re.sub(r'<[^>]+>', '', word)
    # Удаляем потенциально опасные символы
    clean_word = re.sub(r'[<>]', '', clean_word)
    return clean_word.strip().lower()

# Pydantic модели для API
class FilteredWord(BaseModel):
    id: Optional[int] = None
    word: str
    platform: str  # 'all', 'twitch', 'vk'
    created_at: Optional[str] = None

class AddWordRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100, description="Word to filter (1-100 chars)")
    platform: str = Field('all', pattern="^(twitch|vk|all)$", description="Platform")
    
    @validator('word')
    def sanitize_word_field(cls, v):
        """🔒 Санитизация слова перед сохранением"""
        return sanitize_word(v) if v else v

@tts_router.get("/filtered-words")
async def get_filtered_words(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список отфильтрованных слов пользователя"""
    try:
        tts_service = TTSService(db)
        words = await tts_service.get_filtered_words(current_user['id'])
        return {"words": words}
    except Exception as e:
        logger.error(f"Error getting filtered words: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения списка слов")

@tts_router.post("/filtered-words")
async def add_filtered_word(
    request: AddWordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить слово в фильтр"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.add_filtered_word(
            current_user['id'], 
            request.word, 
            request.platform
        )
        
        if success:
            return {"message": f"Слово '{request.word}' добавлено в фильтр"}
        else:
            raise HTTPException(status_code=400, detail="Слово уже существует в фильтре")
            
    except Exception as e:
        logger.error(f"Error adding filtered word: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления слова")

@tts_router.delete("/filtered-words/{word_id}")
async def delete_filtered_word(
    word_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить слово из фильтра"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.remove_filtered_word(current_user['id'], word_id)
        
        if success:
            return {"message": "Слово удалено из фильтра"}
        else:
            raise HTTPException(status_code=404, detail="Слово не найдено")
            
    except Exception as e:
        logger.error(f"Error deleting filtered word: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления слова")

@tts_router.post("/filtered-words/check")
async def check_word_filter(
    text: str,
    platform: str = "all",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Проверить, содержит ли текст отфильтрованные слова"""
    try:
        tts_service = TTSService(db)
        is_filtered = await tts_service.check_text_filter(text, current_user['id'], platform)
        return {"is_filtered": is_filtered}
    except Exception as e:
        logger.error(f"Error checking word filter: {e}")
        raise HTTPException(status_code=500, detail="Ошибка проверки фильтрации")