# bot_service/services/tts_service.py
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
import logging
from datetime import datetime

from core.database import FilteredWord

logger = logging.getLogger(__name__)

class TTSService:
    def __init__(self, db: Session):
        self.db = db

    async def get_filtered_words(self, user_id: int) -> List[dict]:
        """Получить список отфильтрованных слов для пользователя"""
        try:
            words = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.user_id == user_id,
                    FilteredWord.is_active == True
                )
            ).all()
            
            return [
                {
                    'id': word.id,
                    'word': word.word,
                    'platform': word.platform,
                    'created_at': word.created_at.isoformat() if word.created_at else None
                }
                for word in words
            ]
        except Exception as e:
            logger.error(f"Error getting filtered words: {e}")
            return []

    async def add_filtered_word(self, user_id: int, word: str, platform: str = 'all') -> bool:
        """Добавить слово в фильтр"""
        try:
            # Проверяем, не существует ли уже такое слово
            existing = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.user_id == user_id,
                    FilteredWord.word == word.lower(),
                    FilteredWord.platform == platform
                )
            ).first()
            
            if existing:
                logger.warning(f"Word '{word}' already exists in filter for user {user_id}")
                return False
            
            filtered_word = FilteredWord(
                user_id=user_id,
                word=word.lower(),
                platform=platform
            )
            
            self.db.add(filtered_word)
            self.db.commit()
            
            logger.info(f"Added word '{word}' to filter for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding filtered word: {e}")
            self.db.rollback()
            return False

    async def remove_filtered_word(self, user_id: int, word_id: int) -> bool:
        """Удалить слово из фильтра"""
        try:
            word = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.id == word_id,
                    FilteredWord.user_id == user_id
                )
            ).first()
            
            if not word:
                logger.warning(f"Word with ID {word_id} not found for user {user_id}")
                return False
            
            self.db.delete(word)
            self.db.commit()
            
            logger.info(f"Removed word '{word.word}' from filter for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error removing filtered word: {e}")
            self.db.rollback()
            return False

    async def check_text_filter(self, text: str, user_id: int, platform: str = "all") -> bool:
        """Проверить, содержит ли текст отфильтрованные слова"""
        try:
            text_lower = text.lower()
            
            # Получаем все активные фильтры для пользователя
            filters = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.user_id == user_id,
                    FilteredWord.is_active == True,
                    FilteredWord.platform.in_(['all', platform])
                )
            ).all()
            
            # Проверяем каждое слово
            for filter_word in filters:
                if filter_word.word.lower() in text_lower:
                    logger.info(f"Text filtered: '{text}' contains blocked word '{filter_word.word}'")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking text filter: {e}")
            return False