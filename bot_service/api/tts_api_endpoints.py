# bot_service/api/tts_api_endpoints.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from core.database import get_db
from services.tts_service import TTSService

logger = logging.getLogger('bot_service')

# Создаем роутер для TTS API
tts_router = APIRouter(prefix="/api/tts", tags=["tts"])

# Pydantic модели для API
class FilteredWord(BaseModel):
    id: Optional[int] = None
    word: str
    platform: str  # 'all', 'twitch', 'vk'
    created_at: Optional[str] = None

class FilteredWordsRequest(BaseModel):
    words: List[FilteredWord]

class FilteredWordsResponse(BaseModel):
    words: List[FilteredWord]

@tts_router.get("/filtered-words", response_model=FilteredWordsResponse)
async def get_filtered_words(
    request: Request,
    db: Session = Depends(get_db)
):
    """Получить список отфильтрованных слов"""
    try:
        tts_service = TTSService(db)
        words = await tts_service.get_filtered_words()
        return FilteredWordsResponse(words=words)
    except Exception as e:
        logger.error(f"Error getting filtered words: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения списка слов")

@tts_router.post("/filtered-words")
async def save_filtered_words(
    request: FilteredWordsRequest,
    db: Session = Depends(get_db)
):
    """Сохранить список отфильтрованных слов"""
    try:
        tts_service = TTSService(db)
        await tts_service.save_filtered_words(request.words)
        return {"success": True, "message": "Список слов сохранен"}
    except Exception as e:
        logger.error(f"Error saving filtered words: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сохранения списка слов")

@tts_router.delete("/filtered-words/{word_id}")
async def delete_filtered_word(
    word_id: int,
    db: Session = Depends(get_db)
):
    """Удалить слово из списка фильтрации"""
    try:
        tts_service = TTSService(db)
        await tts_service.delete_filtered_word(word_id)
        return {"success": True, "message": "Слово удалено"}
    except Exception as e:
        logger.error(f"Error deleting filtered word: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления слова")

@tts_router.post("/filtered-words/check")
async def check_word_filter(
    text: str,
    platform: str = "all",
    db: Session = Depends(get_db)
):
    """Проверить, содержит ли текст отфильтрованные слова"""
    try:
        tts_service = TTSService(db)
        is_filtered = await tts_service.check_text_filter(text, platform)
        return {"is_filtered": is_filtered}
    except Exception as e:
        logger.error(f"Error checking word filter: {e}")
        raise HTTPException(status_code=500, detail="Ошибка проверки фильтрации")

