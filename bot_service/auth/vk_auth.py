"""
VK Live авторизация и гостевой вход
"""
import httpx
import logging
from datetime import timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from core.database import get_db
from core.session_manager import session_manager
from core.config import settings
from auth.auth import get_current_user_optional
import base64
import secrets
from core.security_modern import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

# VK Live OAuth настройки из централизованной конфигурации
VK_CLIENT_ID = settings.vk_client_id
VK_CLIENT_SECRET = settings.vk_client_secret
BACKEND_URL = settings.backend_url
FRONTEND_URL = settings.frontend_url
VK_AUTH_BASE_URL = settings.vk_auth_base_url
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm

@router.get("/auth/vk")
@limiter.limit("10/minute")
async def vk_auth(request: Request):
    """Инициация VK Live авторизации с полной авторизацией"""
    if not VK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="VK_CLIENT_ID not configured")

    from constants import OAUTH_SCOPES

    scopes = OAUTH_SCOPES["vk"]
    logger.info(f"VK OAuth requested with scopes: {scopes}")

    # Генерируем state для защиты от CSRF
    state = secrets.token_urlsafe(16)

    auth_url = (
        f"{VK_AUTH_BASE_URL}?"
        f"client_id={VK_CLIENT_ID}&"
        f"redirect_uri={BACKEND_URL}/auth/vk/callback&"
        f"response_type=code&"
        f"scope={scopes}&"
        f"state={state}"
    )

    logger.info("VK Live auth URL generated")

    return RedirectResponse(url=auth_url)

@router.get("/auth/vk/login")
@limiter.limit("10/minute")
async def login_vk(request: Request):
    """API endpoint для VK login (для совместимости с фронтендом)"""
    if not VK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="VK_CLIENT_ID not configured")

    from constants import OAUTH_SCOPES

    scopes = OAUTH_SCOPES["vk"]
    logger.info(f"VK OAuth requested with scopes: {scopes}")

    redirect_uri = f"{BACKEND_URL}/auth/vk/callback"

    # Генерируем state для защиты от CSRF
    state = secrets.token_urlsafe(16)

    auth_url = (
        f"{VK_AUTH_BASE_URL}?"
        f"client_id={VK_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scopes}&"
        f"state={state}"
    )

    logger.info("VK Live API login URL generated")
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=auth_url)

@router.get("/auth/vk/callback")
@limiter.limit("20/minute")
async def vk_callback(request: Request, db: Session = Depends(get_db), code: str = None, state: str = None, error: str = None, error_description: str = None, current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):

    logger.info("=" * 80)
    logger.info("[VK] CALLBACK FUNCTION CALLED!")
    logger.info(f"[VK] callback URL: {request.url}")
    logger.info(f"[VK] callback cookies: {list(request.cookies.keys())}")
    logger.info("=" * 80)

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

    # Используем настройки из централизованной конфигурации
    VK_REDIRECT_URI = f"{BACKEND_URL}/auth/vk/callback"

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

            # ДИАГНОСТИКА: Логируем весь ответ от VK
            logger.info(f"[VK TOKEN] Full response: {token_data}")

            access_token = token_data["access_token"]
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            from core.datetime_utils import utcnow_naive
            expires_at = utcnow_naive() + timedelta(seconds=expires_in)

            # Получаем scopes из ответа
            scope_string = token_data.get("scope", "")
            logger.info(f"[VK SCOPES] Raw scope string from API: '{scope_string}'")

            # Если scope пустой, используем scopes из запроса
            if not scope_string or scope_string == "":
                logger.warning("[VK SCOPES] VK API returned empty scope! Using requested scopes as fallback")
                from constants import OAUTH_SCOPES
                scopes = OAUTH_SCOPES["vk"].split(",")
                logger.info(f"[VK SCOPES] Using fallback scopes: {scopes}")
            else:
                scopes = scope_string.split(",")
                logger.info(f"[VK SCOPES] Parsed scopes: {scopes}")

            # Логируем реальное время жизни токена
            logger.info(f"[VK AUTH] Token expires_in: {expires_in} seconds ({expires_in / 3600:.1f} hours)")

            # --- 2. Получение информации о пользователе ---
            logger.info("Attempting to get user info with token...")

            user_info = None
            ssl_verify = settings.is_production
            async with httpx.AsyncClient(trust_env=False, timeout=30.0, verify=ssl_verify) as client:
                # Используем dev API (только он доступен)
                endpoint = "https://apidev.live.vkvideo.ru/v1/current_user"
                try:
                    logger.info(f"Fetching VK user info from dev API: {endpoint}")
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
                    logger.info(f"[OK] Extracted channel name from URL: {vk_username} (from {channel_url})")
                except Exception as e:
                    logger.error(f"[ERROR] Failed to extract channel name from URL {channel_url}: {e}")

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
                    logger.info(f"[WARN] Using user.nick as fallback: {vk_username}")

            if vk_username:
                # Проверяем что это не ID (если вдруг API вернет ID)
                if vk_username.isdigit():
                    logger.warning(f"[WARN] VK username is numeric ({vk_username}), using fallback")
                    vk_username = f"vk{platform_user_id}"
            else:
                # VK Live API не вернул username, используем ID как fallback
                vk_username = f"vk{platform_user_id}"
                logger.warning(f"[WARN] VK API returned user_info without channel URL or nick: {user_info}")
                logger.warning(f"[WARN] Available keys: {list(user_info.keys())}")
                logger.info(f"[OK] Using fallback VK username: {vk_username}")

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
                auto_connect_bot=True
            )

            # Создаем ответ с редиректом
            return oauth_handler.create_oauth_response(oauth_result)

    except Exception as e:
        logger.error(f"VK auth error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during VK authentication")

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
            try:
                from startup.bot_registry import get_bot_registry
                registry = get_bot_registry()
                bot_instance = registry.twitch_bot
                vk_live_bot_instance = registry.vk_bot

                # Отключаем Twitch бота
                twitch_username = user_data.get('twitch_username')
                if twitch_username and bot_instance:
                    try:
                        await bot_instance.part_channels([twitch_username])
                        logger.info(f"[OK] Twitch bot disconnected from {twitch_username}")
                    except Exception as e:
                        logger.error(f"[ERROR] Error disconnecting Twitch bot: {e}")

                # Отключаем VK Live бота
                vk_channel = user_data.get('vk_channel_name')
                if vk_channel and vk_live_bot_instance:
                    try:
                        await vk_live_bot_instance.disconnect_from_channel(vk_channel)
                        logger.info(f"[OK] VK Live bot disconnected from {vk_channel}")
                    except Exception as e:
                        logger.error(f"[ERROR] Error disconnecting VK Live bot: {e}")

                logger.info(f"Disconnected bots for user {user_id} on VK logout")
            except Exception as e:
                logger.error(f"[ERROR] Error disconnecting bots during logout: {e}")

            # Удаляем все токены интеграций пользователя
            if user_id and user_id != -1:  # Не гостевой пользователь
                session_manager.clear_user_tokens(user_id)
                logger.info(f"[DELETE] Cleared all integration tokens for user {user_id}")
        else:
            logger.warning(f"Could not get user data for session {session_id} during VK logout")

        session_manager.terminate_session(session_id, "logout")
        response.delete_cookie("session_id")

    return {"message": "Logged out successfully"}
