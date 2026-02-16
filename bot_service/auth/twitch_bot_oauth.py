"""
OAuth authorization for Twitch bot with refresh token support.

Uses full OAuth2 flow instead of legacy TMI token flow.
"""

import logging
import secrets
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from auth.auth import get_admin_user, get_session_data
from core.config import settings
from core.database import get_db
from core.security_modern import limiter
from services.twitch_bot_oauth_service import twitch_bot_oauth_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/auth/twitch/bot/login")
@limiter.limit("5/minute")
async def login_twitch_bot(request: Request):
    """Start Twitch bot OAuth authorization flow."""
    try:
        session_data = get_session_data(request)
        if not session_data:
            raise HTTPException(
                status_code=401,
                detail="Unauthorized. Please login first at http://localhost:5173",
            )

        user_id = session_data.get("user_id")
        is_admin = session_data.get("is_admin", False)

        if not is_admin:
            raise HTTPException(
                status_code=403,
                detail="Admin rights required. Please contact administrator.",
            )

        state = secrets.token_urlsafe(16)
        auth_url = twitch_bot_oauth_service.get_authorization_url(state)

        logger.info(f"[BOT OAUTH] Admin {user_id} initiated bot OAuth")

        response = RedirectResponse(url=auth_url)
        response.set_cookie(
            key="bot_oauth_state",
            value=state,
            max_age=600,  # 10 minutes
            httponly=True,
            secure=settings.environment == "production",
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating bot OAuth URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to start OAuth flow")


@router.get("/auth/twitch/bot/callback")
@limiter.limit("10/minute")
async def twitch_bot_callback(
    request: Request,
    db: Session = Depends(get_db),
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
):
    """Handle Twitch bot OAuth callback."""
    logger.info(f"[BOT OAUTH] Callback received. Query params: {dict(request.query_params)}")

    if error:
        logger.warning(f"[BOT OAUTH] OAuth cancelled: {error} - {error_description}")
        return RedirectResponse(url=f"{settings.frontend_url}/admin/settings?bot_auth_error=cancelled")

    if not code:
        logger.error("[BOT OAUTH] No authorization code received")
        raise HTTPException(status_code=400, detail="No authorization code received")

    saved_state = request.cookies.get("bot_oauth_state")
    if not saved_state or saved_state != state:
        logger.error("[BOT OAUTH] Invalid state parameter")
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    try:
        logger.info("[BOT OAUTH] Exchanging code for tokens...")
        token_data = await twitch_bot_oauth_service.exchange_code_for_token(code)

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        scopes = token_data.get("scope", [])

        logger.info(f"[BOT OAUTH] Token exchange successful. Expires in: {expires_in}s")

        logger.info("[BOT OAUTH] Getting bot user info...")
        bot_info = await twitch_bot_oauth_service.get_bot_user_info(access_token)
        bot_user_id = bot_info.get("id")
        bot_login = bot_info.get("login")

        logger.info(f"[BOT OAUTH] Bot: {bot_login} (ID: {bot_user_id})")

        logger.info("[BOT OAUTH] Saving bot tokens to database...")
        success = await twitch_bot_oauth_service.save_bot_token(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            scopes=scopes,
            bot_user_id=bot_user_id,
            bot_login=bot_login,
            db=db,
        )
        if not success:
            raise Exception("Failed to save bot tokens")

        logger.info("[OK] [BOT OAUTH] Bot tokens saved successfully")

        logger.info("[BOT OAUTH] Restarting Twitch bot with new token...")
        from core.connection_manager import get_connection_manager
        from startup.bot_initializer import initialize_twitch_bot
        from startup.bot_registry import get_bot_registry

        registry = get_bot_registry()
        if registry.is_twitch_running():
            await registry.stop_twitch()
            logger.info("[BOT OAUTH] Old bot stopped")

        connection_manager = get_connection_manager()
        twitch_channels = await connection_manager.get_twitch_channels_for_bot(db)
        await initialize_twitch_bot(twitch_channels)
        logger.info("[OK] [BOT OAUTH] Bot restarted with new token")

        response = RedirectResponse(url=f"{settings.frontend_url}/admin/settings?bot_auth_success=true")
        response.delete_cookie("bot_oauth_state")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] [BOT OAUTH] Error during bot OAuth: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during bot authentication")


@router.post("/api/admin/bot/refresh-token")
@limiter.limit("5/minute")
async def refresh_bot_token(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """Force refresh Twitch bot token and restart bot."""
    try:
        logger.info(f"[BOT OAUTH] Admin {current_user.get('user_id')} requested token refresh")

        success = await twitch_bot_oauth_service.refresh_bot_token(db)
        if success:
            logger.info("[OK] [BOT OAUTH] Bot token refreshed successfully")

            from core.connection_manager import get_connection_manager
            from startup.bot_initializer import initialize_twitch_bot
            from startup.bot_registry import get_bot_registry

            registry = get_bot_registry()
            if registry.is_twitch_running():
                await registry.stop_twitch()

            connection_manager = get_connection_manager()
            twitch_channels = await connection_manager.get_twitch_channels_for_bot(db)
            await initialize_twitch_bot(twitch_channels)

            return {
                "success": True,
                "message": "Bot token refreshed and bot restarted",
            }

        return {
            "success": False,
            "message": "Failed to refresh bot token",
        }

    except Exception as e:
        logger.error(f"Error refreshing bot token: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh bot token")


@router.get("/api/admin/bot/token-status")
@limiter.limit("10/minute")
async def get_bot_token_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """Get Twitch bot token status for admin panel."""
    try:
        bot_token = await twitch_bot_oauth_service.get_bot_token(db)
        if bot_token:
            from core.datetime_utils import utcnow_naive

            expires_at = bot_token.get("expires_at")
            days_left = None
            needs_refresh = False

            if expires_at:
                days_left = (expires_at - utcnow_naive()).days
                needs_refresh = days_left < 7

            return {
                "success": True,
                "configured": True,
                "type": "oauth",
                "bot_login": bot_token.get("bot_login"),
                "bot_user_id": bot_token.get("bot_user_id"),
                "expires_at": expires_at.isoformat() if expires_at else None,
                "days_left": days_left,
                "needs_refresh": needs_refresh,
                "has_refresh_token": bool(bot_token.get("refresh_token")),
            }

        # Legacy env fallback without auto-refresh support.
        if settings.twitch_bot_token:
            from services.bot_token_validator import bot_token_validator

            validation = await bot_token_validator.validate_twitch_bot_token()
            if validation.get("valid"):
                return {
                    "success": True,
                    "configured": True,
                    "type": "legacy",
                    "bot_login": validation.get("login"),
                    "bot_user_id": validation.get("user_id"),
                    "expires_at": None,
                    "days_left": 30,
                    "needs_refresh": False,
                    "has_refresh_token": False,
                    "message": "Using legacy .env token. Auto-refresh unavailable.",
                }

            return {
                "success": False,
                "configured": True,
                "type": "legacy",
                "message": "Legacy .env token is invalid. Re-authorize the bot.",
            }

        return {
            "success": False,
            "configured": False,
            "message": "Bot token not configured. Please authorize the bot.",
        }

    except Exception as e:
        logger.error(f"Error getting bot token status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get bot token status")
