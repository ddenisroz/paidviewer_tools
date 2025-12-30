# bot_service/api/obs_integration_api.py
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from core.database import get_db, User
from auth.auth import get_current_user, create_jwt_token
from core.security_modern import limiter
from core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["obs-integration"])

@router.get("/tts/obs-url")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def get_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить существующий OBS URL"""
    try:
        user_record = db.query(User).filter(User.id == user['id']).first()
        if user_record and user_record.obs_token:
            return {"obs_token": user_record.obs_token}
        return {"obs_token": None}
    except Exception as e:
        logger.error(f"Error getting OBS URL: {e}")
        return {"obs_token": None}

@router.post("/tts/generate-obs-url")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def generate_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для OBS WebSocket"""
    try:
        # Проверяем, есть ли уже сохраненный токен
        user_record = db.query(User).filter(User.id == user['id']).first()

        if user_record and user_record.obs_token:
            # Возвращаем существующий токен
            return {"obs_token": user_record.obs_token}
        else:
            # Создаем новый токен и сохраняем в базе данных
            obs_token = create_jwt_token(user['id'])

            if user_record:
                user_record.obs_token = obs_token
            else:
                # Создаем новую запись пользователя (на случай, если её нет)
                user_record = User(
                    id=user['id'],
                    obs_token=obs_token
                )
                db.add(user_record)

            db.commit()
            return {"obs_token": obs_token}

    except Exception as e:
        logger.error(f"Error generating OBS URL: {e}")
        db.rollback()
        # Fallback: создаем временный токен без сохранения
        obs_token = create_jwt_token(user['id'])
        return {"obs_token": obs_token}

@router.post("/youtube/generate-obs-url")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def generate_youtube_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Генерировать URL для YouTube OBS WebSocket"""
    try:
        user_record = db.query(User).filter(User.id == user['id']).first()

        if user_record and user_record.obs_token:
            obs_token = user_record.obs_token
        else:
            obs_token = create_jwt_token(user['id'])
            if user_record:
                user_record.obs_token = obs_token
            else:
                user_record = User(
                    id=user['id'],
                    obs_token=obs_token
                )
                db.add(user_record)
            db.commit()

        frontend_url = settings.frontend_url
        youtube_obs_url = f"{frontend_url}/youtube-obs/{obs_token}"
        return {"youtube_obs_url": youtube_obs_url, "obs_token": obs_token}

    except Exception as e:
        logger.error(f"Error generating YouTube OBS URL: {e}")
        db.rollback()
        obs_token = create_jwt_token(user['id'])
        frontend_url = settings.frontend_url
        youtube_obs_url = f"{frontend_url}/youtube-obs/{obs_token}"
        return {"youtube_obs_url": youtube_obs_url, "obs_token": obs_token}

@router.post("/tts/regenerate-obs-url")
@limiter.limit("60/minute")  # [OK] RATE LIMITING: 60 запросов в минуту
async def regenerate_obs_url(request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Перегенерировать OBS URL (создать новый токен)"""
    try:
        obs_token = create_jwt_token(user['id'])

        user_record = db.query(User).filter(User.id == user['id']).first()
        if user_record:
            user_record.obs_token = obs_token
        else:
            user_record = User(
                id=user['id'],
                obs_token=obs_token
            )
            db.add(user_record)

        db.commit()
        return {"obs_token": obs_token}

    except Exception as e:
        logger.error(f"Error regenerating OBS URL: {e}")
        db.rollback()
        obs_token = create_jwt_token(user['id'])
        return {"obs_token": obs_token}

@router.post("/youtube/regenerate-obs-url")
async def regenerate_youtube_obs_url(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Перегенерировать URL для YouTube OBS WebSocket"""
    try:
        # Создаем новый токен
        obs_token = create_jwt_token(user['id'])

        user_record = db.query(User).filter(User.id == user['id']).first()
        if user_record:
            user_record.obs_token = obs_token
        else:
            user_record = User(
                id=user['id'],
                obs_token=obs_token
            )
            db.add(user_record)

        db.commit()

        frontend_url = settings.frontend_url
        youtube_obs_url = f"{frontend_url}/youtube-obs/{obs_token}"
        return {"youtube_obs_url": youtube_obs_url, "obs_token": obs_token}

    except Exception as e:
        logger.error(f"Error regenerating YouTube OBS URL: {e}")
        db.rollback()
        obs_token = create_jwt_token(user['id'])
        frontend_url = settings.frontend_url
        youtube_obs_url = f"{frontend_url}/youtube-obs/{obs_token}"
        return {"youtube_obs_url": youtube_obs_url, "obs_token": obs_token}
