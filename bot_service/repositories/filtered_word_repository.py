# repositories/filtered_word_repository.py
"""
Repository for Filtered Words.
Follows Clean Architecture - abstracts all database access for FilteredWord.
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from repositories.base_repository import BaseRepository
from models.tts import FilteredWord


class FilteredWordRepository(BaseRepository[FilteredWord]):
    """Repository for FilteredWord CRUD operations."""
    
    def __init__(self, db: Session):
        super().__init__(FilteredWord, db)
    
    def get_by_user_id(self, user_id: int) -> List[FilteredWord]:
        """Get all filtered words for a user."""
        return self.db.query(FilteredWord).filter(
            FilteredWord.user_id == user_id,
            FilteredWord.is_active
        ).all()
    
    def get_by_session_id(self, session_id: str) -> List[FilteredWord]:
        """Get all filtered words for a session (guest)."""
        return self.db.query(FilteredWord).filter(
            FilteredWord.session_id == session_id,
            FilteredWord.is_active
        ).all()
    
    def get_words_list(
        self,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get filtered words as list of dicts."""
        if user_id:
            words = self.get_by_user_id(user_id)
        elif session_id:
            words = self.get_by_session_id(session_id)
        else:
            return []
        
        return [
            {
                "id": w.id,
                "word": w.word,
                "platform": w.platform,
                "created_at": w.created_at.isoformat() if w.created_at else None
            }
            for w in words
        ]
    
    def add_word(
        self,
        word: str,
        platform: str = "all",
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> Optional[FilteredWord]:
        """Add a new filtered word. Returns None if word already exists."""
        # Check for existing word
        query = self.db.query(FilteredWord).filter(
            FilteredWord.word == word.lower(),
            FilteredWord.platform == platform,
            FilteredWord.is_active
        )
        
        if user_id:
            query = query.filter(FilteredWord.user_id == user_id)
        elif session_id:
            query = query.filter(FilteredWord.session_id == session_id)
        else:
            return None
        
        if query.first():
            return None  # Word already exists
        
        new_word = FilteredWord(
            user_id=user_id,
            session_id=session_id,
            word=word.lower(),
            platform=platform
        )
        self.db.add(new_word)
        self.db.commit()
        self.db.refresh(new_word)
        return new_word
    
    def remove_word(
        self,
        word_id: int,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> bool:
        """Remove a filtered word. Returns True if successful."""
        query = self.db.query(FilteredWord).filter(FilteredWord.id == word_id)
        
        if user_id:
            query = query.filter(FilteredWord.user_id == user_id)
        elif session_id:
            query = query.filter(FilteredWord.session_id == session_id)
        else:
            return False
        
        word = query.first()
        if not word:
            return False
        
        word.is_active = False  # Soft delete
        self.db.commit()
        return True
