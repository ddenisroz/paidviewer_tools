# bot_service/main.py
"""
Основной файл bot_service.

Рефакторинг: логика вынесена в модули:
- startup/bot_registry.py - управление ботами
- startup/bot_initializer.py - инициализация ботов
- startup/lifespan.py - lifecycle events
- startup/router_registry.py - централизованная регистрация роутеров
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

# Initialize analysis logging for LLM analysis (enabled via ANALYSIS_MODE=true)
from core.analysis_logging import get_analysis_logger
analysis_logger = get_analysis_logger()

# === Logging ===
logger = logging.getLogger(__name__)

# === App Creation ===
app = create_app(lifespan=lifespan)
# app.router.lifespan_context assigned via constructor

# === OpenAPI Configuration ===
from core.openapi_config import setup_openapi  # noqa: E402
setup_openapi(app)

# === Middleware ===
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

# === Router Registration ===
# All 35+ routers are now registered via router_registry
from startup.router_registry import register_all_routers  # noqa: E402
register_all_routers(app)

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


# === Entry Point ===

if __name__ == "__main__":
    import uvicorn
    is_dev = settings.is_development
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=is_dev)
