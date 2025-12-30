# bot_service/main.py
"""
Основной файл bot_service.

Рефакторинг: логика вынесена в модули:
- startup/bot_registry.py - управление ботами
- startup/bot_initializer.py - инициализация ботов
- startup/lifespan.py - lifecycle events
- api/websocket_endpoints.py - WebSocket handlers
"""

import sys
import logging
import urllib3
from pathlib import Path

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Подавляем предупреждение о небезопасных HTTPS для dev API VK
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# === Path Setup ===
BOT_SERVICE_ROOT = Path(__file__).parent
if str(BOT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_SERVICE_ROOT))

from core.project_paths import BOT_SERVICE_ROOT
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# === Core Imports ===
from core.app_config import create_app, setup_logging
from core.config import settings
from core.middleware import SecurityHeadersMiddleware, RequestLoggingMiddleware
from core.database import get_db, User, UserToken
from core.session_manager import session_manager
from core.token_utils import validate_platform_token
from auth.auth import get_current_user
from core.auth_handlers import auth_handlers

# === Startup Module ===
from startup.lifespan import lifespan
from startup.bot_registry import get_bot_registry

# === Sentry & Structured Logging Setup ===
from core.sentry_config import init_sentry
from core.structured_logging import setup_structured_logging

# Initialize Sentry (before app creation)
init_sentry()

# Setup structured logging
setup_structured_logging()

# === Logging ===
setup_logging()
logger = logging.getLogger(__name__)

# === App Creation ===
app = create_app()
app.router.lifespan_context = lifespan

# === OpenAPI Configuration ===
from core.openapi_config import setup_openapi
setup_openapi(app)

# === Middleware ===
# Logging Middleware (add first for proper order)
from middleware.logging_middleware import (
    StructuredLoggingMiddleware,
    PerformanceLoggingMiddleware,
    ErrorLoggingMiddleware
)

app.add_middleware(ErrorLoggingMiddleware)
app.add_middleware(PerformanceLoggingMiddleware, slow_threshold_ms=1000)
app.add_middleware(StructuredLoggingMiddleware)

# Existing middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# === Router Imports ===
from features.tts.tts_api import tts_router, voices_router, user_voices_router, local_tts_router
from features.youtube.youtube_api import youtube_router
from features.youtube.youtube_settings_api import youtube_settings_router
from features.drops.drops_api import router as drops_router
from features.commands.commands_api import router as commands_router
from api.moderation_api import router as moderation_router
from api.database_management_api import router as database_router
from api.points_api_endpoints import points_router
from api.session_api import router as session_api_router
from api.support_api import router as support_router
from auth.vk_auth import router as vk_auth_router
from auth.twitch_auth import router as twitch_auth_router
from auth.twitch_bot_oauth import router as twitch_bot_oauth_router
from api.vk_api import router as vk_api_router
from api.vk_channel_points_api import router as vk_channel_points_router
from api.twitch_api_badges import router as twitch_badges_router
from api.twitch_predictions_api import router as twitch_predictions_router
from api.twitch_polls_api import router as twitch_polls_router
from api.twitch_interactive_api import router as twitch_interactive_router
from auth.donationalerts_auth import router as da_auth_router
from api.widgets import router as widgets_router
from api.bot_control_api import router as bot_control_router
from api.stream_info_api import router as stream_info_router
from api.additional_api import router as additional_router
from api.obs_integration_api import router as obs_integration_router
from api.system_api import router as system_router
from api.user_settings_api import router as user_settings_router
from api.chatbox_api import router as chatbox_router
from api.admin_api import router as admin_router
from api.admin.users_management import router as admin_users_router
from api.admin.bot_token_api import router as bot_token_router
from api.database_health_api import router as database_health_router
from api.active_channels_api import router as active_channels_router
from api.stream_history_api import router as stream_history_router
from api.donationalerts_api import router as donationalerts_router
from api.platforms_api import router as platforms_router
from api.system_logs_api import router as system_logs_router
from api.proxy_api import router as proxy_router
from api.error_reporting_api import router as error_reporting_router
from api.auth_api import router as auth_api_router
from api.websocket_endpoints import router as websocket_router
from api.dashboard_api import router as dashboard_router


# === Backward Compatibility ===
# Для обратной совместимости с кодом, который импортирует из main
# NOTE: bot_instance and vk_live_bot_instance are now managed by BotRegistry
# Code that does "from main import bot_instance" will get None
# Use get_bot_registry().twitch_bot instead for actual bot access

# These are kept as None for backward compatibility
# Real bot instances are in BotRegistry
bot_instance = None
vk_live_bot_instance = None


# === Auth Endpoints ===

@app.get("/test-callback")
async def test_callback():
    logger.info("Test callback route called!")
    return {"message": "Test callback works"}


@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return await auth_handlers.logout(current_user)


@app.get("/api/auth/status")
async def auth_status(request: Request, db: Session = Depends(get_db)):
    """Получить статус авторизации и интеграций."""
    logger.info("=== AUTH STATUS REQUEST START ===")
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        logger.info("[AUTH] No session_id found")
        return {"authenticated": False}
    
    session_data = session_manager.validate_session(session_id)
    if not session_data:
        logger.info("[AUTH] Session validation failed")
        return {"authenticated": False, "integrations": {}}
    
    user_id = session_data.get("user_id")
    
    # Only authenticated users allowed
    if not user_id or user_id <= 0:
        logger.info("[AUTH] Invalid user_id in session")
        return {"authenticated": False, "integrations": {}}
    
    # Regular user
    user_data = {}
    user = None
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user_data = {
                "id": user.id,
                "twitch_username": user.twitch_username,
                "vk_username": user.vk_username,
                "vk_channel_name": user.vk_channel_name,
                "is_admin": user.is_admin
            }
    except Exception as e:
        logger.error(f"[ERROR] Error getting user data: {e}")
        user_data = {
            "id": user_id,
            "twitch_username": None,
            "vk_username": None,
            "vk_channel_name": None,
            "is_admin": session_data.get("is_admin", False)
        }
    
    # Get integrations
    integrations = await _get_user_integrations(user_id, user, db)
    
    logger.info("=== AUTH STATUS REQUEST END ===")
    return {
        "authenticated": True,
        "integrations": integrations,
        "user": user_data
    }


async def _get_user_integrations(user_id: int, user: User, db: Session) -> dict:
    """Получает интеграции пользователя с валидацией токенов."""
    integrations = {}
    
    try:
        user_tokens = db.query(UserToken).filter(UserToken.user_id == user_id).all()
        
        for token in user_tokens:
            is_active = getattr(token, 'is_active', True)
            if not is_active or not token.access_token:
                continue
            
            # Валидация токена
            try:
                is_valid = await validate_platform_token(token)
            except Exception:
                is_valid = True  # При сетевых ошибках считаем валидным
            
            if not is_valid:
                continue
            
            # VK: проверяем что это OAuth токен стримера
            if token.platform == 'vk':
                if not token.refresh_token or not token.scopes:
                    continue
            
            # Получаем username
            username = None
            if token.platform == 'twitch' and user:
                username = user.twitch_username
            elif token.platform == 'vk' and user:
                username = user.vk_username
            elif token.platform == 'donationalerts' and user:
                username = getattr(user, 'donationalerts_username', None)
            
            integrations[token.platform] = {
                "connected": True,
                "enabled": True,
                "platform_user_id": token.platform_user_id,
                "avatar_url": token.avatar_url,
                "username": username
            }
            
    except Exception as e:
        logger.error(f"[ERROR] Error fetching integrations: {e}")
    
    return integrations


# === Health Check ===

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bot_service"}


# === Exception Handlers ===
from core.exception_handlers import setup_exception_handlers
setup_exception_handlers(app)


# === Include Routers ===

# WebSocket
app.include_router(websocket_router)

# Features
app.include_router(tts_router)
app.include_router(local_tts_router)
app.include_router(voices_router)
app.include_router(user_voices_router)
app.include_router(youtube_router)
app.include_router(youtube_settings_router)
app.include_router(drops_router)
app.include_router(commands_router)

# API
app.include_router(moderation_router)
app.include_router(database_router)
app.include_router(points_router)
app.include_router(session_api_router)
app.include_router(bot_control_router)
app.include_router(stream_info_router)
app.include_router(additional_router)
app.include_router(dashboard_router)
app.include_router(obs_integration_router)
app.include_router(system_router)
app.include_router(user_settings_router)
app.include_router(support_router)
app.include_router(chatbox_router)

# Auth
app.include_router(vk_auth_router)
app.include_router(twitch_auth_router)
app.include_router(twitch_bot_oauth_router)
app.include_router(twitch_badges_router, prefix="/api/twitch", tags=["twitch-badges"])
app.include_router(twitch_predictions_router)
app.include_router(twitch_polls_router)
app.include_router(twitch_interactive_router)
app.include_router(vk_api_router)
app.include_router(vk_channel_points_router)
app.include_router(da_auth_router)
app.include_router(auth_api_router)

# Admin
app.include_router(admin_router)
app.include_router(admin_users_router)
app.include_router(bot_token_router)
app.include_router(database_health_router)
app.include_router(system_logs_router)

# Other
app.include_router(widgets_router)
app.include_router(active_channels_router)
app.include_router(stream_history_router)
app.include_router(donationalerts_router)
app.include_router(platforms_router)
app.include_router(proxy_router)
app.include_router(error_reporting_router)


# === Entry Point ===

if __name__ == "__main__":
    import uvicorn
    is_dev = settings.is_development
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=is_dev)
