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
from pathlib import Path

from dotenv import load_dotenv

# === Path Setup ===
_bot_service_root = Path(__file__).parent
if str(_bot_service_root) not in sys.path:
    sys.path.insert(0, str(_bot_service_root))

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
from middleware.csrf_protection import CSRFProtectionMiddleware  # noqa: E402

app.add_middleware(ErrorLoggingMiddleware)
app.add_middleware(PerformanceLoggingMiddleware, slow_threshold_ms=1000)
app.add_middleware(StructuredLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(CSRFProtectionMiddleware, secret_key=settings.secret_key)

# Existing middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# === Router Registration ===
# All 35+ routers are now registered via router_registry
from startup.router_registry import register_all_routers  # noqa: E402
register_all_routers(app)


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
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=is_dev,
        access_log=False,  # Request logging is already handled by middleware.
        log_config=None,   # Keep a single app-level logging format.
    )
