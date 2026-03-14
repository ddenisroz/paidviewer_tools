# bot_service/repositories/user_token_repository.py
"""
Repository for user-token operations.
"""

import logging
from typing import Optional, List
from datetime import datetime

from sqlalchemy.orm import Session

from core.database import UserToken
from repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class UserTokenRepository(BaseRepository[UserToken]):
    """
    Repository for UserToken.
    
    Usage:
        repo = UserTokenRepository(db)
        token = repo.get_by_user_and_platform(user_id, "twitch")
    """
    
    def __init__(self, db: Session):
        super().__init__(UserToken, db)
    
    def get_by_user_and_platform(
        self, 
        user_id: int, 
        platform: str
    ) -> Optional[UserToken]:
        """Get a user token for the selected platform."""
        return self.db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == platform
        ).first()

    def get_active_token(self, user_id: int, platform: str) -> Optional[UserToken]:
        """Get an active user token for the selected platform."""
        return self.db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == platform,
            UserToken.is_active.is_(True)
        ).first()
    
    def get_all_by_user(self, user_id: int) -> List[UserToken]:
        """Get all tokens for a user."""
        return self.db.query(UserToken).filter(
            UserToken.user_id == user_id
        ).all()
    
    def get_valid_tokens(self, user_id: int) -> List[UserToken]:
        """Get only valid, non-expired user tokens."""
        now = datetime.utcnow()
        return self.db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.access_token.isnot(None),
            (UserToken.expires_at.is_(None)) | (UserToken.expires_at > now)
        ).all()
    
    def upsert(
        self,
        user_id: int,
        platform: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        platform_user_id: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        scopes: Optional[List[str]] = None,
        avatar_url: Optional[str] = None,
    ) -> UserToken:
        """Create or update a token."""
        token = self.get_by_user_and_platform(user_id, platform)
        
        if token:
            token.access_token = access_token
            if refresh_token:
                token.refresh_token = refresh_token
            if platform_user_id:
                token.platform_user_id = platform_user_id
            if expires_at:
                token.expires_at = expires_at
            if scopes is not None:
                token.scopes = scopes
            if avatar_url:
                token.avatar_url = avatar_url
        else:
            token = UserToken(
                user_id=user_id,
                platform=platform,
                access_token=access_token,
                refresh_token=refresh_token,
                platform_user_id=platform_user_id,
                expires_at=expires_at,
                scopes=scopes or [],
                avatar_url=avatar_url,
            )
            self.db.add(token)
        
        self.db.commit()
        self.db.refresh(token)
        
        logger.info(f"[TOKEN] Upserted {platform} token for user {user_id}")
        return token
    
    def delete_by_user_and_platform(
        self, 
        user_id: int, 
        platform: str
    ) -> bool:
        """Delete a user token for the selected platform."""
        result = self.db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.platform == platform
        ).delete()
        self.db.commit()
        
        if result:
            logger.info(f"[TOKEN] Deleted {platform} token for user {user_id}")
        return result > 0
    
    def delete_all_by_user(self, user_id: int) -> int:
        """Delete all user tokens and return the deleted row count."""
        result = self.db.query(UserToken).filter(
            UserToken.user_id == user_id
        ).delete()
        self.db.commit()
        
        logger.info(f"[TOKEN] Deleted {result} tokens for user {user_id}")
        return result
    
    def get_first_by_platform(self, platform: str) -> Optional[UserToken]:
        """Get the first available token for a platform as a fallback."""
        return self.db.query(UserToken).filter(
            UserToken.platform == platform,
            UserToken.access_token.isnot(None)
        ).first()
    
    def get_active_by_user(self, user_id: int) -> List[UserToken]:
        """Get all active tokens for a user."""
        return self.db.query(UserToken).filter(
            UserToken.user_id == user_id,
            UserToken.is_active == True
        ).all()

    def get_expiring_tokens(self, platform: str, threshold: datetime) -> List[UserToken]:
        """Get active tokens that expire before the specified time."""
        return self.db.query(UserToken).filter(
            UserToken.platform == platform,
            UserToken.is_active == True,
            UserToken.expires_at <= threshold
        ).all()

    def get_active_token_by_session(self, session_id: str, platform: str) -> Optional[UserToken]:
        """Get an active token by session_id."""
        return self.db.query(UserToken).filter(
            UserToken.session_id == session_id,
            UserToken.platform == platform,
            UserToken.is_active.is_(True)
        ).first()


