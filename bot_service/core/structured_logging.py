# bot_service/core/structured_logging.py
"""
Structured Logging Configuration

Provides JSON-formatted logs with context for better debugging and monitoring.

Features:
- JSON output for production
- Human-readable output for development
- Automatic context injection (user_id, request_id, etc.)
- Integration with Sentry
- Log rotation
"""
import logging
import sys
from pathlib import Path
from typing import Any, Dict

import structlog
from structlog.types import EventDict, Processor

from core.config import settings


def add_app_context(logger: Any, method_name: str, event_dict: EventDict) -> EventDict:
    """
    Add application context to all log entries.
    
    This adds:
    - environment (development/production)
    - service name
    - version
    """
    event_dict["environment"] = settings.environment
    event_dict["service"] = "bot_service"
    event_dict["version"] = "0.03"
    return event_dict


def add_severity_level(logger: Any, method_name: str, event_dict: EventDict) -> EventDict:
    """
    Add severity level for better filtering.
    
    Maps structlog levels to standard severity levels.
    """
    level_mapping = {
        "debug": "DEBUG",
        "info": "INFO",
        "warning": "WARNING",
        "error": "ERROR",
        "critical": "CRITICAL",
    }
    
    if "level" in event_dict:
        event_dict["severity"] = level_mapping.get(event_dict["level"], "INFO")
    
    return event_dict


def censor_sensitive_data(logger: Any, method_name: str, event_dict: EventDict) -> EventDict:
    """
    Censor sensitive data from logs.
    
    Replaces sensitive fields with [FILTERED].
    """
    sensitive_fields = [
        "password", "token", "secret", "api_key", 
        "access_token", "refresh_token", "authorization"
    ]
    
    def censor_dict(d: Dict) -> Dict:
        """Recursively censor dictionary"""
        result = {}
        for key, value in d.items():
            if any(sensitive in key.lower() for sensitive in sensitive_fields):
                result[key] = "[FILTERED]"
            elif isinstance(value, dict):
                result[key] = censor_dict(value)
            else:
                result[key] = value
        return result
    
    return censor_dict(event_dict)


_SETUP_DONE = False

def setup_structured_logging():
    """
    Configure structured logging for the application.
    
    Call this once at application startup, before any logging occurs.
    Idempotent: subsequent calls will be ignored.
    """
    global _SETUP_DONE
    if _SETUP_DONE:
        return
    _SETUP_DONE = True

    # Determine processors based on environment
    # Determine processors based on environment
    processors: list[Processor] = [
        # Add log level
        structlog.stdlib.add_log_level,
        
        # Add timestamp
        structlog.processors.TimeStamper(fmt="iso"),
        
        # Add caller information (file, line, function)
        structlog.processors.CallsiteParameterAdder(
            parameters=[
                structlog.processors.CallsiteParameter.FILENAME,
                structlog.processors.CallsiteParameter.LINENO,
                structlog.processors.CallsiteParameter.FUNC_NAME,
            ]
        ),
        
        # Add application context
        add_app_context,
        
        # Add severity level
        add_severity_level,
        
        # Censor sensitive data
        censor_sensitive_data,
        
        # Add exception info
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    
    # Choose renderer based on environment
    if settings.is_production or getattr(settings, 'enable_json_logs', False):
        # JSON for production (machine-readable)
        processors.append(structlog.processors.JSONRenderer())
        structlog.processors.JSONRenderer()
    else:
        # Console for development (human-readable)
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
        structlog.dev.ConsoleRenderer(colors=True)
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.INFO  # Always use INFO level to reduce noise
        ),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,  # Always use INFO level to reduce noise
    )
    
    # Redirect warnings to logging
    logging.captureWarnings(True)

    # Silence noisy libraries
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.CRITICAL)
    logging.getLogger("watchfiles.main").setLevel(logging.CRITICAL)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    
    # Setup log rotation if enabled
    if getattr(settings, 'enable_log_rotation', True):
        setup_log_rotation()
    
    logger = structlog.get_logger()
    logger.info(
        "structured_logging_initialized",
        environment=settings.environment,
        json_logs=settings.is_production or getattr(settings, 'enable_json_logs', False)
    )


def setup_log_rotation():
    """
    Setup log file rotation.
    
    Rotates logs daily and keeps last 30 days.
    """
    from logging.handlers import RotatingFileHandler
    
    log_file = Path(getattr(settings, 'log_file', 'logs/bot_service.log'))
    if not log_file.is_absolute():
        repo_root = Path(__file__).resolve().parents[2]
        log_file = repo_root / log_file
    log_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Create rotating file handler
    handler = RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=10,  # Keep 10 files
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    
    # Add handler to root logger
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)


def get_logger(name: str = None) -> structlog.BoundLogger:
    """
    Get a structured logger instance.
    
    Usage:
        logger = get_logger(__name__)
        logger.info("user_logged_in", user_id=123, platform="twitch")
    
    Args:
        name: Logger name (usually __name__)
    
    Returns:
        Structured logger instance
    """
    return structlog.get_logger(name)


# Context managers for adding context to logs

class LogContext:
    """
    Context manager for adding context to all logs within a block.
    
    Usage:
        with LogContext(user_id=123, platform="twitch"):
            logger.info("processing_request")
            # All logs will include user_id and platform
    """
    
    def __init__(self, **context):
        self.context = context
        self.token = None
    
    def __enter__(self):
        self.token = structlog.contextvars.bind_contextvars(**self.context)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        structlog.contextvars.unbind_contextvars(*self.context.keys())


def bind_context(**context):
    """
    Bind context to all subsequent logs in the current context.
    
    Usage:
        bind_context(user_id=123, platform="twitch")
        logger.info("processing_request")  # Will include user_id and platform
    """
    structlog.contextvars.bind_contextvars(**context)


def unbind_context(*keys):
    """
    Unbind context from logs.
    
    Usage:
        unbind_context("user_id", "platform")
    """
    structlog.contextvars.unbind_contextvars(*keys)


def clear_context():
    """
    Clear all bound context.
    """
    structlog.contextvars.clear_contextvars()


# Convenience functions for common log patterns

def log_request(method: str, path: str, **extra):
    """Log HTTP request"""
    logger = get_logger("http")
    logger.info(
        "http_request",
        method=method,
        path=path,
        **extra
    )


def log_response(method: str, path: str, status_code: int, duration_ms: float, **extra):
    """Log HTTP response"""
    logger = get_logger("http")
    logger.info(
        "http_response",
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=round(duration_ms, 2),
        **extra
    )


def log_error(error: Exception, context: str = None, **extra):
    """Log error with context"""
    logger = get_logger("error")
    logger.error(
        "error_occurred",
        error_type=type(error).__name__,
        error_message=str(error),
        context=context,
        exc_info=True,
        **extra
    )


def log_db_query(query: str, duration_ms: float, **extra):
    """Log database query"""
    logger = get_logger("database")
    logger.debug(
        "db_query",
        query=query[:200],  # Truncate long queries
        duration_ms=round(duration_ms, 2),
        **extra
    )


def log_user_action(action: str, user_id: int, **extra):
    """Log user action"""
    logger = get_logger("user")
    logger.info(
        "user_action",
        action=action,
        user_id=user_id,
        **extra
    )
