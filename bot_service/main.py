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

from dotenv import load_dotenv

# Подавляем предупреждение о небезопасных HTTPS для dev API VK
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# === Path Setup ===
BOT_SERVICE_ROOT = Path(__file__).parent
if str(BOT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(BOT_SERVICE_ROOT))

from core.project_paths import BOT_SERVICE_ROOT  # noqa: E402
env_path = BOT_SERVICE_ROOT / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# === Core Imports ===
from core.app_config import create_app  # noqa: E402
from core.config import settings  # noqa: E402
from core.middleware import SecurityHeadersMiddleware, RequestLoggingMiddleware  # noqa: E402

# === Startup Module ===
from startup.lifespan import lifespan  # noqa: E402

# === Sentry & Structured Logging Setup ===
from core.sentry_config import init_sentry  # noqa: E402
from core.structured_logging import setup_structured_logging  # noqa: E402

# Initialize Sentry (before app creation)
init_sentry()

# Setup structured logging
setup_structured_logging()

# === Logging ===
logger = logging.getLogger(__name__)

# === App Creation ===
app = create_app(lifespan=lifespan)
# app.router.lifespan_context assigned via constructor

# === OpenAPI Configuration ===
from core.openapi_config import setup_openapi  # noqa: E402
setup_openapi(app)

# === Middleware ===
# Logging Middleware (add first for proper order)
from middleware.logging_middleware import (  # noqa: E402
    StructuredLoggingMiddleware,
    PerformanceLoggingMiddleware,
    ErrorLoggingMiddleware
)
from middleware.rate_limit_middleware import RateLimitMiddleware  # noqa: E402

app.add_middleware(ErrorLoggingMiddleware)
app.add_middleware(PerformanceLoggingMiddleware, slow_threshold_ms=1000)
app.add_middleware(StructuredLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

# Existing middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# === Router Imports ===
from api.tts import tts_router  # Only need the main one now
from api.youtube.routes import youtube_router  # noqa: E402
from api.youtube.settings_routes import youtube_settings_router  # noqa: E402
from api.drops import router as drops_router  # noqa: E402
from api.commands import router as commands_router  # noqa: E402
from api.moderation_api import router as moderation_router  # noqa: E402
from api.database_management_api import router as database_router  # noqa: E402
from api.points_api_endpoints import points_router  # noqa: E402
from api.session_api import router as session_api_router  # noqa: E402
from api.support_api import router as support_router  # noqa: E402
from auth.vk_auth import router as vk_auth_router  # noqa: E402
from auth.twitch_auth import router as twitch_auth_router  # noqa: E402
from auth.twitch_bot_oauth import router as twitch_bot_oauth_router  # noqa: E402
from api.vk_api import router as vk_api_router  # noqa: E402
from api.vk_channel_points_api import router as vk_channel_points_router  # noqa: E402
from api.twitch_api_badges import router as twitch_badges_router  # noqa: E402
from api.twitch_predictions_api import router as twitch_predictions_router  # noqa: E402
from api.twitch_polls_api import router as twitch_polls_router  # noqa: E402
from api.twitch_interactive_api import router as twitch_interactive_router  # noqa: E402
from auth.donationalerts_auth import router as da_auth_router  # noqa: E402
from api.widgets import router as widgets_router  # noqa: E402
from api.bot_control_api import router as bot_control_router  # noqa: E402
from api.stream_info_api import router as stream_info_router  # noqa: E402
from api.additional_api import router as additional_router  # noqa: E402
from api.obs_integration_api import router as obs_integration_router  # noqa: E402
from api.system_api import router as system_router  # noqa: E402
from api.user_settings_api import router as user_settings_router  # noqa: E402
from api.chatbox_api import router as chatbox_router  # noqa: E402
from api.admin.router import router as admin_router  # noqa: E402
from api.admin.users_management import router as admin_users_router  # noqa: E402
from api.database_health_api import router as database_health_router  # noqa: E402
from api.active_channels_api import router as active_channels_router  # noqa: E402
from api.stream_history_api import router as stream_history_router  # noqa: E402
from api.donationalerts_api import router as donationalerts_router  # noqa: E402
from api.memealerts_api import router as memealerts_router  # noqa: E402
from api.platforms_api import router as platforms_router  # noqa: E402
from api.system_logs_api import router as system_logs_router  # noqa: E402
from api.proxy_api import router as proxy_router  # noqa: E402
from api.auth_api import router as auth_api_router  # noqa: E402
from api.websocket_endpoints import router as websocket_router  # noqa: E402
from api.dashboard_api import router as dashboard_router  # noqa: E402
from api.errors_api import router as errors_router  # noqa: E402


# === Backward Compatibility ===
# Для обратной совместимости с кодом, который импортирует из main
# NOTE: bot_instance and vk_live_bot_instance are now managed by BotRegistry
# Code that does "from main import bot_instance" will get None
# Use get_bot_registry().twitch_bot instead for actual bot access

# These are kept as None for backward compatibility
# Real bot instances are in BotRegistry
bot_instance = None
vk_live_bot_instance = None


# === Health Check ===

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "bot_service"}


# === Exception Handlers ===
# Handlers are setup in create_app()


# === Include Routers ===
app.include_router(auth_api_router) # Moved to top for priority

# WebSocket
app.include_router(websocket_router)

# Features
app.include_router(tts_router)
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
app.include_router(errors_router)

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
# app.include_router(auth_api_router) - Moved to top

# Admin
app.include_router(admin_router)
app.include_router(admin_users_router)
app.include_router(database_health_router)
app.include_router(system_logs_router)

# Other
app.include_router(widgets_router)
app.include_router(active_channels_router)
app.include_router(stream_history_router)
app.include_router(donationalerts_router)
app.include_router(memealerts_router)
app.include_router(platforms_router)
app.include_router(proxy_router)


# === Entry Point ===

if __name__ == "__main__":
    import uvicorn
    is_dev = settings.is_development
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=is_dev)
