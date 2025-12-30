# bot_service/api/auth_api.py
"""Authentication API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import logging

from core.database import get_db, User
from core.security_modern import limiter
from starlette.requests import Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/check-username")
@limiter.limit("30/minute")
async def check_username_availability(
    request: Request,
    username: str = Query(..., min_length=3, max_length=25),
    db: Session = Depends(get_db)
):
    """
    Проверить доступность никнейма
    
    Args:
        username: Никнейм для проверки
        db: Database session
        
    Returns:
        {"available": bool, "username": str}
    """
    try:
        # Нормализуем никнейм
        username_normalized = username.strip().lower()

        # Проверяем зарезервированные имена
        reserved_names = ['admin', 'root', 'system', 'bot', 'moderator', 'mod', 'guest']
        if username_normalized in reserved_names:
            return {
                "available": False,
                "username": username,
                "reason": "reserved"
            }

        # Проверяем существование в базе
        existing_user = db.query(User).filter(
            User.username.ilike(username)  # Case-insensitive поиск
        ).first()

        if existing_user:
            return {
                "available": False,
                "username": username,
                "reason": "taken"
            }

        return {
            "available": True,
            "username": username
        }

    except Exception as e:
        logger.error(f"Error checking username availability: {e}")
        raise HTTPException(status_code=500, detail="Error checking username availability")
