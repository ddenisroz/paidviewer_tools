# bot_service/auth/vk_bot_oauth.py
"""
OAuth авторизация для VK Live бота с поддержкой refresh_token.
"""

import logging
import secrets
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import settings
from services.vk_bot_oauth_service import vk_bot_oauth_service
from core.security_modern import limiter
from auth.auth import get_admin_user, get_session_data

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/auth/vk/bot/login")
@limiter.limit("5/minute")
async def login_vk_bot(request: Request):
    """
    Инициировать OAuth авторизацию для VK Live бота.
    
    Требует права администратора.
    Перенаправляет на VK для авторизации бота.
    """
    try:
        session_data = get_session_data(request)
        if not session_data:
            raise HTTPException(
                status_code=401,
                detail="Unauthorized. Please login first at frontend"
            )
        
        user_id = session_data.get('user_id')
        is_admin = session_data.get('is_admin', False)
        
        if not is_admin:
            raise HTTPException(
                status_code=403,
                detail="Admin rights required. Please contact administrator."
            )
        
        # Генерируем state для защиты от CSRF
        state = secrets.token_urlsafe(16)
        
        auth_url = vk_bot_oauth_service.get_authorization_url(state)
        
        logger.info(f"[VK BOT OAUTH] Admin {user_id} initiated bot OAuth")
        
        response = RedirectResponse(url=auth_url)
        response.set_cookie(
            key="vk_bot_oauth_state",
            value=state,
            max_age=600,  # 10 минут
            httponly=True,
            secure=settings.environment == "production"
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating VK bot OAuth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/vk/bot/callback")
@limiter.limit("10/minute")
async def vk_bot_callback(
    request: Request,
    db: Session = Depends(get_db),
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None
):
    """
    Обработка OAuth callback для VK Live бота.
    """
    logger.info(f"[VK BOT OAUTH] Callback received. Query params: {dict(request.query_params)}")
    
    if error:
        logger.warning(f"[VK BOT OAUTH] OAuth cancelled: {error} - {error_description}")
        return RedirectResponse(url=f"{settings.frontend_url}/admin/settings?bot_auth_error=cancelled")
    
    if not code:
        logger.error("[VK BOT OAUTH] No authorization code received")
        raise HTTPException(status_code=400, detail="No authorization code received")
    
    saved_state = request.cookies.get("vk_bot_oauth_state")
    if not saved_state or saved_state != state:
        logger.error("[VK BOT OAUTH] Invalid state parameter")
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    try:
        # 1. Обмен кода на токены
        logger.info("[VK BOT OAUTH] Exchanging code for tokens...")
        token_data = await vk_bot_oauth_service.exchange_code_for_token(code)
        
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        
        # VK API returns raw string scope, convert to list
        scope_str = token_data.get("scope", "")
        scopes = scope_str.split(" ") if scope_str else []
        
        logger.info(f"[VK BOT OAUTH] Token exchange successful. Expires in: {expires_in}s")
        
        # 2. Получаем информацию о боте
        logger.info("[VK BOT OAUTH] Getting bot user info...")
        bot_info = await vk_bot_oauth_service.get_bot_user_info(access_token)
        
        bot_user_id = bot_info.get('id')
        bot_login = bot_info.get('login')
        
        logger.info(f"[VK BOT OAUTH] Bot: {bot_login} (ID: {bot_user_id})")
        
        # 3. Сохраняем токены в базу данных
        logger.info("[VK BOT OAUTH] Saving bot tokens to database...")
        success = await vk_bot_oauth_service.save_bot_token(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            scopes=scopes,
            bot_user_id=bot_user_id,
            bot_login=bot_login,
            db=db
        )
        
        if not success:
            raise Exception("Failed to save VK bot tokens")
        
        logger.info("[OK] [VK BOT OAUTH] Bot tokens saved successfully")
        
        # 4. Перезапускаем бота
        logger.info("[VK BOT OAUTH] Restarting VK bot with new token...")
        from startup.bot_registry import get_bot_registry
        from startup.bot_initializer import initialize_vk_bot
        
        registry = get_bot_registry()
        
        if registry.is_vk_running():
            await registry.stop_vk()
            logger.info("[VK BOT OAUTH] Old bot stopped")
            
        await initialize_vk_bot()
        logger.info("[OK] [VK BOT OAUTH] Bot restarted with new token")
        
        # Редирект на админ панель
        response = RedirectResponse(
            url=f"{settings.frontend_url}/admin/settings?bot_auth_success=true"
        )
        response.delete_cookie("vk_bot_oauth_state")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] [VK BOT OAUTH] Error during bot OAuth: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during bot authentication")


@router.get("/api/admin/bot/vk/token-status")
@limiter.limit("10/minute")
async def get_vk_bot_token_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Получить статус токена VK бота.
    """
    try:
        # 1. Ищем в БД
        bot_token = await vk_bot_oauth_service.get_bot_token(db)
        
        if bot_token:
            from core.datetime_utils import utcnow_naive
            
            expires_at = bot_token.get('expires_at')
            days_left = None
            needs_refresh = False
            
            if expires_at:
                days_left = (expires_at - utcnow_naive()).days
                needs_refresh = days_left < 7
            
            return {
                "success": True,
                "configured": True,
                "type": "oauth",
                "bot_login": bot_token.get('bot_login'),
                "bot_user_id": bot_token.get('bot_user_id'),
                "expires_at": expires_at.isoformat() if expires_at else None,
                "days_left": days_left,
                "needs_refresh": needs_refresh,
                "has_refresh_token": bool(bot_token.get('refresh_token'))
            }

        # 2. Legacy .env
        if settings.vk_live_user_token:
             # Простая проверка
             return {
                "success": True,
                "configured": True,
                "type": "legacy",
                "message": "Using .env token (might be expired or limited)"
             }

        return {
            "success": False,
            "configured": False,
            "message": "Bot token not configured."
        }
        
    except Exception as e:
        logger.error(f"Error getting VK bot token status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
