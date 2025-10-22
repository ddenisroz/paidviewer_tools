"""
Twitch OAuth авторизация
"""
import os
import httpx
import logging
from datetime import timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import get_db
from core.datetime_utils import utcnow_naive
from auth.auth import get_current_user_optional
from auth.oauth_handler import oauth_handler, OAuthUserData
from constants import Platform, DEFAULT_FRONTEND_URL, HTTP_STATUS

logger = logging.getLogger(__name__)

router = APIRouter()

# Twitch OAuth настройки
TWITCH_CLIENT_ID = os.getenv("TWITCH_CLIENT_ID")
TWITCH_CLIENT_SECRET = os.getenv("TWITCH_CLIENT_SECRET")
BACKEND_URL = os.getenv("BACKEND_URL")
if not BACKEND_URL:
    raise ValueError("BACKEND_URL environment variable is required")

FRONTEND_URL = os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_URL)


@router.get("/auth/twitch/login")
async def login_twitch():
    """Инициировать Twitch OAuth"""
    try:
        if not TWITCH_CLIENT_ID:
            logger.error("TWITCH_CLIENT_ID not configured")
            raise HTTPException(status_code=500, detail="Twitch integration is not configured")
        
        # Параметры для авторизации
        scopes = "user:read:email channel:read:stream_key channel:manage:broadcast"
        redirect_uri = f"{BACKEND_URL}/auth/twitch/callback"
        
        auth_url = (
            f"https://id.twitch.tv/oauth2/authorize"
            f"?client_id={TWITCH_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope={scopes}"
        )
        
        logger.info(f"Twitch OAuth login URL generated: {auth_url}")
        return {"auth_url": auth_url}
    
    except Exception as e:
        logger.error(f"Error generating Twitch login URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/twitch/callback")
async def twitch_callback(
    request: Request,
    db: Session = Depends(get_db),
    code: str = None,
    error: str = None,
    error_description: str = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Обработка Twitch OAuth callback"""
    
    logger.info(f"Twitch callback received. Query params: {dict(request.query_params)}")
    
    # Обработка отмены авторизации
    if error:
        logger.warning(f"Twitch OAuth cancelled: {error} - {error_description}")
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?auth_error=cancelled")
    
    # Проверяем наличие кода авторизации
    if not code:
        logger.error("No authorization code received from Twitch")
        raise HTTPException(status_code=400, detail="No authorization code received from Twitch")
    
    if not all([TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET]):
        logger.error("Twitch credentials not configured")
        raise HTTPException(status_code=500, detail="Twitch integration is not configured")
    
    logger.info(f"Authorization code received: {code[:10]}...")
    
    try:
        # 1. Обмен кода на токен
        redirect_uri = f"{BACKEND_URL}/auth/twitch/callback"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            token_response = await client.post(
                "https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": TWITCH_CLIENT_ID,
                    "client_secret": TWITCH_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            
            logger.info(f"Twitch token response status: {token_response.status_code}")
            
            if token_response.status_code != 200:
                error_body = token_response.text
                logger.error(f"Twitch token exchange failed. Status: {token_response.status_code}, Body: {error_body}")
                raise HTTPException(
                    status_code=token_response.status_code,
                    detail=f"Twitch API error: {error_body}"
                )
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            
            expires_at = utcnow_naive() + timedelta(seconds=expires_in)
            scopes = token_data.get("scope", [])
            
            logger.info(f"Token exchange successful. Scopes: {scopes}")
            
            # 2. Получаем информацию о пользователе
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Client-ID": TWITCH_CLIENT_ID
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                user_response = await client.get(
                    "https://api.twitch.tv/helix/users",
                    headers=headers
                )
                
                logger.info(f"Twitch user response status: {user_response.status_code}")
                
                if user_response.status_code != 200:
                    error_body = user_response.text
                    logger.error(f"Failed to get Twitch user info. Status: {user_response.status_code}, Body: {error_body}")
                    raise HTTPException(
                        status_code=user_response.status_code,
                        detail=f"Failed to get user info from Twitch"
                    )
                
                user_data_response = user_response.json()
                user_info = user_data_response.get("data", [{}])[0]
                
                platform_user_id = user_info.get("id")
                username = user_info.get("login")
                avatar_url = user_info.get("profile_image_url")
                
                if not platform_user_id:
                    logger.error("No user ID in Twitch response")
                    raise HTTPException(status_code=400, detail="No user ID in Twitch response")
                
                logger.info(f"Twitch user: {username} ({platform_user_id})")
                
                # 3. Используем общий OAuth handler
                oauth_user_data = OAuthUserData(
                    platform_user_id=platform_user_id,
                    avatar_url=avatar_url,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_at=expires_at,
                    scopes=scopes,
                    username=username
                )
                
                # Используем общий OAuth handler с автоподключением бота
                oauth_result = await oauth_handler.handle_oauth_callback(
                    request=request,
                    db=db,
                    platform=Platform.TWITCH,
                    user_data=oauth_user_data,
                    current_user=current_user,
                    auto_connect_bot=True  # Включаем автоподключение бота
                )
                
                # Создаем ответ с редиректом
                return oauth_handler.create_oauth_response(oauth_result)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Twitch auth error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during Twitch authentication")
