"""
Расширенный модуль логирования для отладки всех фич
"""
import logging
from functools import wraps
from typing import Any, Callable
import time
import json

# Создаем специальные логгеры для каждой системы
auth_logger = logging.getLogger('auth_system')
tts_logger = logging.getLogger('tts_system')
drops_logger = logging.getLogger('drops_system')
commands_logger = logging.getLogger('commands_system')
stream_logger = logging.getLogger('stream_system')
vk_logger = logging.getLogger('vk_system')
twitch_logger = logging.getLogger('twitch_system')
api_logger = logging.getLogger('api_system')

def log_api_call(system: str):
    """Декоратор для логирования API вызовов"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            logger = logging.getLogger(f'{system}_system')

            # Логируем входные данные
            logger.info(f"[{system.upper()}] ===== START: {func.__name__} =====")
            logger.info(f"[{system.upper()}] Args: {args}")
            logger.info(f"[{system.upper()}] Kwargs keys: {list(kwargs.keys())}")

            try:
                result = await func(*args, **kwargs)
                elapsed = time.time() - start_time
                logger.info(f"[{system.upper()}] ===== SUCCESS: {func.__name__} ({elapsed:.3f}s) =====")
                return result
            except Exception as e:
                elapsed = time.time() - start_time
                logger.error(f"[{system.upper()}] ===== ERROR: {func.__name__} ({elapsed:.3f}s) =====")
                logger.error(f"[{system.upper()}] Error: {str(e)}", exc_info=True)
                raise

        return wrapper
    return decorator

def log_function_call(logger_name: str):
    """Декоратор для логирования вызовов функций"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            logger = logging.getLogger(logger_name)
            logger.info(f"→ Calling {func.__name__}")
            try:
                result = await func(*args, **kwargs)
                logger.info(f"✓ {func.__name__} completed successfully")
                return result
            except Exception as e:
                logger.error(f"✗ {func.__name__} failed: {str(e)}")
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            logger = logging.getLogger(logger_name)
            logger.info(f"→ Calling {func.__name__}")
            try:
                result = func(*args, **kwargs)
                logger.info(f"✓ {func.__name__} completed successfully")
                return result
            except Exception as e:
                logger.error(f"✗ {func.__name__} failed: {str(e)}")
                raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator

def log_request(endpoint: str, method: str, data: Any = None, user_id: Any = None):
    """Логирование входящего запроса"""
    api_logger.info(f"[BROADCAST] [{method}] {endpoint} | User: {user_id}")
    if data:
        try:
            api_logger.debug(f"[PACKAGE] Data: {json.dumps(data, ensure_ascii=False, indent=2)}")
        except (TypeError, ValueError):
            api_logger.debug(f"[PACKAGE] Data: {str(data)}")

def log_response(endpoint: str, status: int, data: Any = None, elapsed: float = None):
    """Логирование ответа"""
    emoji = "[OK]" if status < 400 else "[ERROR]"
    time_str = f" ({elapsed:.3f}s)" if elapsed else ""
    api_logger.info(f"{emoji} [{status}] {endpoint}{time_str}")
    if data and status >= 400:
        try:
            api_logger.error(f"Error response: {json.dumps(data, ensure_ascii=False, indent=2)}")
        except (TypeError, ValueError):
            api_logger.error(f"Error response: {str(data)}")

def log_database_query(operation: str, table: str, filters: dict = None):
    """Логирование запроса к базе данных"""
    db_logger = logging.getLogger('database_system')
    db_logger.debug(f"🗄️  {operation} on {table} | Filters: {filters}")

def log_websocket_event(event_type: str, user_id: Any, data: Any = None):
    """Логирование WebSocket события"""
    ws_logger = logging.getLogger('websocket_system')
    ws_logger.info(f"[CONNECT] WS Event: {event_type} | User: {user_id} | Data: {data}")

def log_platform_api_call(platform: str, endpoint: str, status: int = None, error: str = None):
    """Логирование вызова API платформы"""
    platform_logger = logging.getLogger(f'{platform}_system')
    if error:
        platform_logger.error(f"[ERROR] API Error: {endpoint} | Error: {error}")
    else:
        platform_logger.info(f"✓ API Call: {endpoint} | Status: {status}")

def get_system_metrics():
    """Получить системные метрики для API"""
    return {
        "uptime": "system_uptime_seconds",
        "requests_total": "http_requests_total",
        "errors_total": "http_errors_total",
        "active_connections": "websocket_connections_active",
        "tts_requests": "tts_requests_total",
        "memory_usage": "memory_usage_bytes"
    }

