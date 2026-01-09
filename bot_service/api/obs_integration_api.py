# bot_service/api/obs_integration_api.py
"""OBS Integration API - manages OBS tokens for users.

Clean Architecture: uses UserRepository for data access.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db, User
from auth.auth import get_current_user, create_jwt_token
from core.security_modern import limiter
from core.config import settings
from repositories.user_repository import UserRepository
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["obs-integration"])


def get_or_create_obs_token(db: Session, user_id: int, regenerate: bool = False) -> str:
    """Get existing or create new OBS token for user."""
    user_repo = UserRepository(db)
    user_record = user_repo.get_by_id(user_id)

    
    if user_record and user_record.obs_token and not regenerate:
        return user_record.obs_token
    
    obs_token = create_jwt_token(user_id)
    
    if user_record:
        user_repo.update_obs_token(user_id, obs_token)
    else:
        user_repo.create_with_obs_token(user_id, obs_token)
    
    return obs_token


@router.get("/tts/obs-url")
@limiter.limit("60/minute")
async def get_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить существующий OBS URL"""
    try:
        user_repo = UserRepository(db)
        user_record = user_repo.get_by_id(user['id'])
        return {"obs_token": user_record.obs_token if user_record else None}
    except Exception as e:
        logger.error(f"Error getting OBS URL: {e}")
        return {"obs_token": None}



@router.post("/tts/generate-obs-url")
@limiter.limit("60/minute")
async def generate_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для OBS WebSocket"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'])
        return {"obs_token": obs_token}
    except Exception as e:
        logger.error(f"Error generating OBS URL: {e}")
        db.rollback()
        return {"obs_token": create_jwt_token(user['id'])}


@router.post("/youtube/generate-obs-url")
@limiter.limit("60/minute")
async def generate_youtube_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для YouTube OBS WebSocket"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'])
        frontend_url = settings.frontend_url
        return {"youtube_obs_url": f"{frontend_url}/youtube-obs/{obs_token}", "obs_token": obs_token}
    except Exception as e:
        logger.error(f"Error generating YouTube OBS URL: {e}")
        db.rollback()
        obs_token = create_jwt_token(user['id'])
        return {"youtube_obs_url": f"{settings.frontend_url}/youtube-obs/{obs_token}", "obs_token": obs_token}


@router.post("/tts/regenerate-obs-url")
@limiter.limit("60/minute")
async def regenerate_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Перегенерировать OBS URL"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'], regenerate=True)
        return {"obs_token": obs_token}
    except Exception as e:
        logger.error(f"Error regenerating OBS URL: {e}")
        db.rollback()
        return {"obs_token": create_jwt_token(user['id'])}


@router.post("/youtube/regenerate-obs-url")
async def regenerate_youtube_obs_url(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Перегенерировать URL для YouTube OBS WebSocket"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'], regenerate=True)
        frontend_url = settings.frontend_url
        return {"youtube_obs_url": f"{frontend_url}/youtube-obs/{obs_token}", "obs_token": obs_token}
    except Exception as e:
        logger.error(f"Error regenerating YouTube OBS URL: {e}")
        db.rollback()
        obs_token = create_jwt_token(user['id'])
        return {"youtube_obs_url": f"{settings.frontend_url}/youtube-obs/{obs_token}", "obs_token": obs_token}
