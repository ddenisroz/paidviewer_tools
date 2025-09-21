# bot_service/auth.py
import os
import jwt
import time
import logging
from typing import Optional
from fastapi import Request, HTTPException, Depends, status
from sqlalchemy.orm import Session
from bot_service.database import User, get_db

logger = logging.getLogger(__name__)

async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Получить текущего пользователя из сессии или JWT токена"""
    # Сначала проверяем заголовок Authorization (для JWT)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            SECRET_KEY = os.getenv("SECRET_KEY")
            if not SECRET_KEY:
                raise HTTPException(status_code=500, detail="SECRET_KEY not configured")
            
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            
            logger.info(f"User authenticated via JWT: {user.username}")
            return user
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    # Если JWT не найден, проверяем сессию
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    logger.info(f"User authenticated via session: {user.username}")
    return user

async def get_admin_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Получить текущего пользователя и проверить админские права"""
    user = await get_current_user(request, db)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def create_jwt_token(user_id: str) -> str:
    """Создать JWT токен для пользователя"""
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="SECRET_KEY not configured")
    
    payload = {
        "sub": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400  # 24 часа
    }
    
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
