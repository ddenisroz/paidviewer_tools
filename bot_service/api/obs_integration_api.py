# bot_service/api/obs_integration_api.py
"""OBS Integration API - manages OBS tokens for users.

Clean Architecture: uses UserRepository for data access.
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
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

    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_record and user_record.obs_token and not regenerate:
        return user_record.obs_token
    
    obs_token = create_jwt_token(user_id)
    
    user_repo.update_obs_token(user_id, obs_token)
    
    return obs_token


@router.get("/tts/obs-url")
@limiter.limit("60/minute")
async def get_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить существующий OBS URL"""
    try:
        user_repo = UserRepository(db)
        user_record = user_repo.get_by_id(user['id'])
        return {"obs_token": user_record.obs_token if user_record else None}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting OBS URL")
        raise HTTPException(status_code=500, detail="Internal server error")



@router.post("/tts/generate-obs-url")
@limiter.limit("60/minute")
async def generate_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для OBS WebSocket"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'])
        return {"obs_token": obs_token}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error generating OBS URL")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/youtube/generate-obs-url")
@limiter.limit("60/minute")
async def generate_youtube_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для YouTube OBS WebSocket"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'])
        frontend_url = settings.frontend_url
        return {"youtube_obs_url": f"{frontend_url}/youtube-obs/{obs_token}", "obs_token": obs_token}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error generating YouTube OBS URL")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/tts/regenerate-obs-url")
@limiter.limit("60/minute")
async def regenerate_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Перегенерировать OBS URL"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'], regenerate=True)
        return {"obs_token": obs_token}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error regenerating OBS URL")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/youtube/regenerate-obs-url")
@limiter.limit("60/minute")
async def regenerate_youtube_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Перегенерировать URL для YouTube OBS WebSocket"""
    try:
        obs_token = get_or_create_obs_token(db, user['id'], regenerate=True)
        frontend_url = settings.frontend_url
        return {"youtube_obs_url": f"{frontend_url}/youtube-obs/{obs_token}", "obs_token": obs_token}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error regenerating YouTube OBS URL")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
