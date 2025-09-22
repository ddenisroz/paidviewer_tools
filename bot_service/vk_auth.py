"""
VK Live авторизация и гостевой вход
"""
import os
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from bot_service.database import User, VkGuestVerification, get_db
from bot_service.session_manager import session_manager
from bot_service.auth import get_current_user_optional, create_jwt_token
import base64

# Загружаем переменные окружения
load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter()

# VK Live OAuth настройки
VK_CLIENT_ID = os.getenv("VK_CLIENT_ID")
VK_CLIENT_SECRET = os.getenv("VK_CLIENT_SECRET")
VK_REDIRECT_URI = os.getenv("VK_REDIRECT_URI", "http://localhost:8000/auth/vk/callback")

@router.get("/auth/vk")
async def vk_auth():
    """Инициация VK Live авторизации"""
    if not VK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="VK_CLIENT_ID not configured")
    
    # VK Live OAuth URL
    auth_url = (
        f"https://auth.live.vkvideo.ru/app/oauth2/authorize?"
        f"client_id={VK_CLIENT_ID}&"
        f"redirect_uri={VK_REDIRECT_URI}&"
        f"response_type=code&"
        f"v=5.131"
    )
    
    return RedirectResponse(url=auth_url)

@router.get("/auth/vk/callback")
async def vk_callback(code: str, request: Request, db: Session = Depends(get_db)):
    
    # Загружаем переменные окружения
    VK_CLIENT_ID = os.getenv("VK_CLIENT_ID")
    VK_CLIENT_SECRET = os.getenv("VK_CLIENT_SECRET")
    VK_REDIRECT_URI = "http://localhost:8000/auth/vk/callback"

    if not all([VK_CLIENT_ID, VK_CLIENT_SECRET]):
        logger.error(f"VK credentials not configured. VK_CLIENT_ID: {'✓' if VK_CLIENT_ID else '✗'}, VK_CLIENT_SECRET: {'✓' if VK_CLIENT_SECRET else '✗'}")
        raise HTTPException(status_code=500, detail="VK integration is not configured.")
    
    logger.info(f"VK credentials loaded. Client ID: {VK_CLIENT_ID[:8]}..., Redirect URI: {VK_REDIRECT_URI}")
    logger.info(f"Authorization code received: {code[:10]}...")

    try:
        # --- 1. Обмен кода на токен ---
        
        # Готовим Basic Auth заголовок
        credentials = f"{VK_CLIENT_ID}:{VK_CLIENT_SECRET}"
        base64_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {base64_credentials}"
        }
        
        payload = {
            "grant_type": "authorization_code",
            "redirect_uri": VK_REDIRECT_URI,
            "code": code
        }

        async with httpx.AsyncClient() as client:
            logger.info(f"Requesting token with payload: {payload}")
            logger.info(f"Using headers: {headers}")
            
            token_response = await client.post(
                "https://api.live.vkvideo.ru/oauth/server/token",
                data=payload,
                headers=headers
            )
            
            logger.info(f"Token exchange response status: {token_response.status_code}")
            logger.info(f"Token exchange response headers: {dict(token_response.headers)}")
            
            if token_response.status_code != 200:
                error_body = token_response.text
                logger.error(f"VK token exchange failed. Status: {token_response.status_code}, Body: {error_body}")
                raise HTTPException(
                    status_code=token_response.status_code, 
                    detail=f"VK API Error during token exchange: {error_body}"
                )
            
            token_data = token_response.json()
            logger.info(f"Token exchange successful. Token data: {token_data}")
            access_token = token_data["access_token"]
            logger.info(f"Access token obtained: {access_token[:10]}...")
            
            # Пробуем декодировать токен как JWT
            try:
                import jwt
                # Проверим, является ли токен JWT
                header = jwt.get_unverified_header(access_token)
                payload = jwt.decode(access_token, options={"verify_signature": False})
                logger.info(f"JWT token decoded. Header: {header}, Payload: {payload}")
                
                # Если в токене есть информация о пользователе, используем её
                if 'user_id' in payload or 'sub' in payload:
                    user_info = {
                        'id': payload.get('user_id') or payload.get('sub'),
                        'username': payload.get('username', f"vk_user_{payload.get('user_id') or payload.get('sub')}"),
                        'first_name': payload.get('first_name', ''),
                        'last_name': payload.get('last_name', ''),
                        'photo_200': payload.get('photo_200', payload.get('avatar_url', ''))
                    }
                    logger.info(f"User info extracted from JWT: {user_info}")
                    skip_api_call = True
                else:
                    skip_api_call = False
            except Exception as e:
                logger.info(f"Token is not JWT or can't be decoded: {e}")
                skip_api_call = False
            
            # --- 2. Получение информации о пользователе ---
            if not skip_api_call:
                logger.info(f"Attempting to get user info with token: {access_token[:10]}...")
                
                # Пробуем разные возможные эндпоинты для получения информации о пользователе
                user_endpoints = [
                    "https://api.live.vkvideo.ru/v1/user/me",
                    "https://api.live.vkvideo.ru/v1/me", 
                    "https://api.live.vkvideo.ru/v1/user",
                    "https://api.live.vkvideo.ru/user/me",
                    "https://api.live.vkvideo.ru/me"
                ]
                
                user_info = None
                user_info_response = None
                
                for endpoint in user_endpoints:
                    logger.info(f"Trying endpoint: {endpoint}")
                    try:
                        user_info_response = await client.get(
                            endpoint,
                            headers={
                                "Authorization": f"Bearer {access_token}"
                            }
                        )
                        
                        logger.info(f"Response status: {user_info_response.status_code}")
                        logger.info(f"Response headers: {dict(user_info_response.headers)}")
                        
                        if user_info_response.status_code == 200:
                            user_info = user_info_response.json()
                            logger.info(f"Successfully got user info from {endpoint}: {user_info}")
                            break
                        else:
                            logger.warning(f"Endpoint {endpoint} returned {user_info_response.status_code}: {user_info_response.text}")
                            
                    except Exception as e:
                        logger.warning(f"Error with endpoint {endpoint}: {e}")
                        continue
                
                if not user_info:
                    # Если не удалось получить информацию через API, создаем минимальную информацию о пользователе
                    logger.warning("Failed to get user info from VK API. Creating minimal user profile.")
                    # Генерируем ID на основе токена
                    import hashlib
                    user_id = hashlib.md5(access_token.encode()).hexdigest()[:8]
                    user_info = {
                        'id': user_id,
                        'username': f"vk_user_{user_id}",
                        'first_name': 'VK',
                        'last_name': 'User',
                        'photo_200': ''
                    }
                    logger.info(f"Created minimal user info: {user_info}")
            else:
                logger.info("User info already extracted from JWT token")
            
            # --- 3. Создание или обновление пользователя в нашей БД ---
            vk_user_id = f"vk_{user_info['id']}"
            user = db.query(User).filter(User.id == vk_user_id).first()
            
            display_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()

            if not user:
                user = User(
                    id=vk_user_id,
                    username=user_info.get("screen_name", f"vk_user_{user_info['id']}"),
                    display_name=display_name,
                    avatar=user_info.get("avatar_url") or user_info.get("photo_200"),
                    platform="vk"
                )
                db.add(user)
            else:
                user.username = user_info.get("screen_name", user.username)
                user.display_name = display_name
                user.avatar = user_info.get("avatar_url") or user_info.get("photo_200")
                user.last_login = datetime.utcnow()
            
            db.commit()
            
            # --- 4. Управление сессией и токенами ---
            
            # Сохраняем токены
            session_manager.save_user_tokens(
                user_id=vk_user_id,
                platform="vk",
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
            )

            # Создаем JWT токен для фронтенда
            jwt_token = create_jwt_token(user.id)
            
            # Редирект на дашборд с токеном
            response = RedirectResponse(f"http://localhost:5173/dashboard?token={jwt_token}")
            
            # Создаем новую сессию, если ее нет
            session_id = request.cookies.get("session_id")
            if not session_id or not session_manager.get_session(session_id):
                 session_id = session_manager.create_session(
                    user_id=vk_user_id,
                    platform="vk",
                    device_info={
                        "user_agent": request.headers.get("user-agent"),
                        "ip": request.client.host
                    }
                )
            
            response.set_cookie(
                key="session_id",
                value=session_id,
                httponly=True,
                secure=False, # для http://localhost
                samesite="lax",
                max_age=86400 * 7 # 7 дней
            )
            
            return response

    except Exception as e:
        logger.error(f"VK auth error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during VK authentication")

@router.post("/auth/vk/guest/start")
async def start_vk_guest_verification(
    channel_name: str,
    db: Session = Depends(get_db)
):
    """Начать процесс гостевой верификации для VK Live"""
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name is required")
    
    # Генерируем код верификации
    import random
    import string
    verification_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    # Сохраняем или обновляем код верификации
    existing = db.query(VkGuestVerification).filter(
        VkGuestVerification.channel_name == channel_name
    ).first()
    
    if existing:
        existing.verification_code = verification_code
        existing.is_verified = False
        existing.created_at = datetime.utcnow()
        existing.verified_at = None
    else:
        verification = VkGuestVerification(
            channel_name=channel_name,
            verification_code=verification_code
        )
        db.add(verification)
    
    db.commit()
    
    logger.info(f"VK guest verification started for channel {channel_name}, code: {verification_code}")
    
    return {
        "message": f"Код верификации для VK Live: {verification_code}",
        "code": verification_code,
        "channel": channel_name
    }

@router.post("/auth/vk/guest/verify")
async def verify_vk_guest(
    request: Request,
    channel_name: str,
    code: str,
    db: Session = Depends(get_db)
):
    """Верификация гостевого входа для VK Live"""
    if not channel_name or not code:
        raise HTTPException(status_code=400, detail="Channel name and code are required")
    
    # Проверяем код верификации
    verification = db.query(VkGuestVerification).filter(
        VkGuestVerification.channel_name == channel_name,
        VkGuestVerification.verification_code == code.upper(),
        VkGuestVerification.is_verified == False
    ).first()
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Отмечаем как верифицированный
    verification.is_verified = True
    verification.verified_at = datetime.utcnow()
    db.commit()
    
    # Создаем гостевую сессию
    session_id = session_manager.create_guest_session(
        channel_name=channel_name,
        platform="vk"
    )
    
    # Устанавливаем cookie с session_id
    response = Response(content="Verification successful")
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400  # 24 часа
    )
    
    logger.info(f"VK guest verification successful for channel {channel_name}")
    
    return response

@router.get("/auth/vk/status")
async def vk_auth_status(request: Request):
    """Проверить статус VK авторизации"""
    from bot_service.auth import get_session_data, is_guest_session, get_active_platforms
    
    session_data = get_session_data(request)
    if not session_data:
        return {"authenticated": False}
    
    return {
        "authenticated": True,
        "is_guest": is_guest_session(request),
        "platforms": get_active_platforms(request),
        "user": {
            "id": session_data["user_id"],
            "username": session_data["username"],
            "display_name": session_data["display_name"]
        }
    }

@router.post("/auth/vk/logout")
async def vk_logout(request: Request, response: Response):
    """Выход из VK сессии"""
    session_id = request.cookies.get("session_id")
    if session_id:
        session_manager.terminate_session(session_id, "logout")
        response.delete_cookie("session_id")
    
    return {"message": "Logged out successfully"}
