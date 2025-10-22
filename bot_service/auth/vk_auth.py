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
from core.database import User, get_db
from core.session_manager import session_manager
from auth.auth import create_jwt_token, get_current_user_optional
from constants import DEFAULT_BACKEND_URL, DEFAULT_FRONTEND_URL
# Импорт функции отключения ботов будет сделан локально
import base64
import secrets

# Загружаем переменные окружения
load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter()

# VK Live OAuth настройки
VK_CLIENT_ID = os.getenv("VK_CLIENT_ID")
VK_CLIENT_SECRET = os.getenv("VK_CLIENT_SECRET")
BACKEND_URL = os.getenv("BACKEND_URL")
if not BACKEND_URL:
    raise ValueError("BACKEND_URL environment variable is required")

FRONTEND_URL = os.getenv("FRONTEND_URL")
if not FRONTEND_URL:
    raise ValueError("FRONTEND_URL environment variable is required")

VK_AUTH_BASE_URL = os.getenv("VK_AUTH_BASE_URL", "https://auth.live.vkvideo.ru/app/oauth2/authorize")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

@router.get("/auth/vk")
async def vk_auth():
    """Инициация VK Live авторизации"""
    if not VK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="VK_CLIENT_ID not configured")
    
    state = secrets.token_urlsafe(16)
    auth_url = (
        f"{VK_AUTH_BASE_URL}?"
        f"client_id={VK_CLIENT_ID}&"
        f"redirect_uri={BACKEND_URL}/auth/vk/callback&"
        f"response_type=code&"
        f"scope=channel:stream:settings&"
        f"state={state}"
    )
    
    logger.info(f"VK Live auth URL generated: {auth_url}")  # Логируем для отладки
    
    return RedirectResponse(url=auth_url)

@router.get("/auth/vk/login")
async def login_vk():
    """API endpoint для VK login (для совместимости с фронтендом)"""
    if not VK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="VK_CLIENT_ID not configured")
    
    state = secrets.token_urlsafe(16)
    redirect_uri = f"{BACKEND_URL}/auth/vk/callback"
    
    auth_url = (
        f"{VK_AUTH_BASE_URL}?"
        f"client_id={VK_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=channel:stream:settings&"
        f"state={state}"
    )
    
    logger.info(f"VK Live API login URL generated: {auth_url}")
    return {"auth_url": auth_url}

@router.get("/auth/vk/callback")
async def vk_callback(request: Request, db: Session = Depends(get_db), code: str = None, error: str = None, error_description: str = None, current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    
    # Логируем все параметры запроса для отладки
    logger.info(f"VK callback received. Query params: {dict(request.query_params)}")
    
    # --- ИСПРАВЛЕНО: Обработка отмены авторизации ---
    if error:
        logger.warning(f"VK OAuth cancelled by user or failed: {error} - {error_description}")
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?auth_error=cancelled")
    
    # Проверяем наличие кода авторизации
    if not code:
        logger.error("No authorization code received from VK")
        raise HTTPException(status_code=400, detail="No authorization code received from VK. Please try again.")
    
    # Загружаем переменные окружения
    VK_CLIENT_ID = os.getenv("VK_CLIENT_ID")
    VK_CLIENT_SECRET = os.getenv("VK_CLIENT_SECRET")
    from constants import DEFAULT_BACKEND_URL
    backend_url = os.getenv("BACKEND_URL")
    if not backend_url:
        raise ValueError("BACKEND_URL environment variable is required")
    VK_REDIRECT_URI = f"{backend_url}/auth/vk/callback"

    if not all([VK_CLIENT_ID, VK_CLIENT_SECRET]):
        logger.error(f"VK credentials not configured. VK_CLIENT_ID: {'✓' if VK_CLIENT_ID else '✗'}, VK_CLIENT_SECRET: {'✓' if VK_CLIENT_SECRET else '✗'}")
        raise HTTPException(status_code=500, detail="VK integration is not configured.")
    
    logger.info(f"VK credentials loaded. Client ID: {VK_CLIENT_ID[:8]}..., Redirect URI: {VK_REDIRECT_URI}")
    logger.info(f"Authorization code received: {code[:10]}...")

    try:
        # --- 1. Обмен кода на токен ---
        
        # Готовим Basic Auth заголовок для VK Live API
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

        async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
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
            access_token = token_data["access_token"]
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            from core.datetime_utils import utcnow_naive
            expires_at = utcnow_naive() + timedelta(seconds=expires_in)
            scopes = token_data.get("scope", "").split(",")

            # --- 2. Получение информации о пользователе ---
            logger.info(f"Attempting to get user info with token...")
            
            user_info = None
            async with httpx.AsyncClient(trust_env=False, timeout=30.0) as client:
                # Пробуем основной API endpoint
                endpoint = "https://api.live.vkvideo.ru/v1/current_user"
                try:
                    logger.info(f"Trying production API: {endpoint}")
                    user_info_response = await client.get(
                        endpoint,
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    logger.info(f"User info response status: {user_info_response.status_code}")
                    logger.info(f"User info response: {user_info_response.text[:500]}")  # Логируем первые 500 символов
                    
                    if user_info_response.status_code == 200:
                        data = user_info_response.json()
                        if isinstance(data, dict) and "data" in data and "user" in data["data"]:
                            user_info = data["data"]["user"]
                            user_info['channel_url'] = data["data"].get("channel", {}).get("url")
                            logger.info(f"Successfully got user info: user_id={user_info.get('id')}")
                    else:
                        logger.error(f"Failed to get user info, status: {user_info_response.status_code}")
                        # Пробуем dev API
                        dev_endpoint = "https://apidev.live.vkvideo.ru/v1/current_user"
                        logger.info(f"Trying dev API: {dev_endpoint}")
                        dev_response = await client.get(
                            dev_endpoint,
                            headers={"Authorization": f"Bearer {access_token}"}
                        )
                        if dev_response.status_code == 200:
                            data = dev_response.json()
                            if isinstance(data, dict) and "data" in data and "user" in data["data"]:
                                user_info = data["data"]["user"]
                                user_info['channel_url'] = data["data"].get("channel", {}).get("url")
                                logger.info(f"Successfully got user info from dev API")
                except Exception as e:
                    logger.error(f"Error getting user info: {e}", exc_info=True)

            if not user_info:
                logger.error("Could not fetch user info from VK Live API")
                raise HTTPException(status_code=500, detail="Could not fetch user info from VK Live API. Please try again later.")
            
            platform_user_id = str(user_info.get("id"))
            avatar_url = user_info.get("avatar_url")

            # --- 3. Используем общий OAuth handler ---
            from auth.oauth_handler import oauth_handler, OAuthUserData
            from constants import Platform
            
            # Создаем объект с данными пользователя
            # Извлекаем VK username из channel URL для подключения бота
            # VK Live API возвращает channel.url: "https://live.vkvideo.ru/yourchy"
            vk_username = None
            channel_url = user_info.get('channel_url')
            
            if channel_url:
                # Извлекаем ник канала из URL
                try:
                    # URL формат: https://live.vkvideo.ru/yourchy
                    vk_username = channel_url.rstrip('/').split('/')[-1]
                    logger.info(f"✅ Extracted channel name from URL: {vk_username} (from {channel_url})")
                except Exception as e:
                    logger.error(f"❌ Failed to extract channel name from URL {channel_url}: {e}")
            
            # Fallback на user.nick если не удалось извлечь из URL
            if not vk_username:
                vk_username = (
                    user_info.get("nick") or
                    user_info.get("login") or 
                    user_info.get("username") or 
                    user_info.get("screen_name") or
                    None
                )
                if vk_username:
                    logger.info(f"⚠️ Using user.nick as fallback: {vk_username}")
            
            if vk_username:
                # Проверяем что это не ID (если вдруг API вернет ID)
                if vk_username.isdigit():
                    logger.warning(f"⚠️ VK username is numeric ({vk_username}), using fallback")
                    vk_username = f"vk{platform_user_id}"
            else:
                # VK Live API не вернул username, используем ID как fallback
                vk_username = f"vk{platform_user_id}"
                logger.warning(f"⚠️ VK API returned user_info without channel URL or nick: {user_info}")
                logger.warning(f"⚠️ Available keys: {list(user_info.keys())}")
                logger.info(f"✅ Using fallback VK username: {vk_username}")
            
            oauth_user_data = OAuthUserData(
                platform_user_id=platform_user_id,
                avatar_url=avatar_url,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                scopes=scopes,
                username=vk_username  # Теперь передаем реальный username
            )
            
            # Используем общий OAuth handler с автоподключением бота
            oauth_result = await oauth_handler.handle_oauth_callback(
                request=request,
                db=db,
                platform=Platform.VK,
                user_data=oauth_user_data,
                current_user=current_user,
                auto_connect_bot=True  # Включаем автоподключение бота
            )
            
            # Создаем ответ с редиректом
            return oauth_handler.create_oauth_response(oauth_result)

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
        from core.datetime_utils import utcnow_naive
        existing.created_at = utcnow_naive()
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
    from core.datetime_utils import utcnow_naive
    verification.verified_at = utcnow_naive()
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
        path="/",  # Явно указываем путь
        secure=True,
        samesite="lax",
        max_age=86400 * 30  # 30 дней (как в oauth_handler)
    )
    
    logger.info(f"VK guest verification successful for channel {channel_name}")
    
    return response

@router.get("/auth/vk/status")
async def vk_auth_status(user: dict = Depends(get_current_user_optional)):
    """Проверить статус VK авторизации на основе общей сессии."""
    if not user:
        return {"authenticated": False, "integrations": {}}
    
    return {
        "authenticated": True,
        "user_id": user.get("id"),
        "integrations": user.get("integrations", {})
    }

@router.post("/auth/vk/logout")
async def vk_logout(request: Request, response: Response):
    """Выход из сессии (теперь это общий logout)."""
    session_id = request.cookies.get("session_id")
    if session_id:
        # Получаем данные пользователя перед завершением сессии
        user_data = session_manager.validate_session(session_id)
        if user_data:
            user_id = user_data.get('user_id') or user_data.get('id')
            
            # Отключаем ботов от каналов пользователя
            # Импортируем глобальные переменные ботов из main
            import sys
            import os
            sys.path.append(os.path.dirname(os.path.dirname(__file__)))
            from main import bot_instance, vk_live_bot_instance
            # Отключение ботов пользователя будет реализовано в отдельном модуле
            await _disconnect_user_bots(user_data)
            logger.info(f"Disconnected bots for user {user_id} on VK logout")
            
            # Удаляем все токены интеграций пользователя
            if user_id and user_id != -1:  # Не гостевой пользователь
                session_manager.clear_user_tokens(user_id)
                logger.info(f"🗑️ Cleared all integration tokens for user {user_id}")
        else:
            logger.warning(f"Could not get user data for session {session_id} during VK logout")
        
        session_manager.terminate_session(session_id, "logout")
        response.delete_cookie("session_id")
    
    return {"message": "Logged out successfully"}
