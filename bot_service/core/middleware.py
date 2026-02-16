# bot_service/core/middleware.py
"""Middleware для FastAPI приложения"""
import time
import logging
import secrets
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware для добавления заголовков безопасности"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Генерируем nonce для inline скриптов (более безопасный подход)
        script_nonce = secrets.token_urlsafe(16)

        # Content Security Policy - более строгая, без unsafe-inline/eval
        # Используем nonce для необходимых inline скриптов
        csp_policy = (
            f"default-src 'self'; "
            f"script-src 'self' 'nonce-{script_nonce}' https://cdn.jsdelivr.net https://cdn.socket.io; "
            f"style-src 'self' 'nonce-{script_nonce}' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            f"img-src 'self' data: https: blob:; "
            f"connect-src 'self' ws: wss: https://api.twitch.tv https://api.vk.com https://www.youtube.com; "
            f"font-src 'self' data: https://fonts.gstatic.com; "
            f"media-src 'self' https: blob:; "
            f"object-src 'none'; "
            f"base-uri 'self'; "
            f"form-action 'self'; "
            f"frame-ancestors 'self' https://www.youtube.com https://twitch.tv; "
            f"upgrade-insecure-requests; "
            f"require-sri-for script style"
        )

        response.headers["Content-Security-Policy"] = csp_policy
        response.headers["Content-Security-Policy-Report-Only"] = (
            f"script-src 'self' 'nonce-{script_nonce}'; "
            f"report-uri /api/csp-report"
        )

        # CORS headers (дополнение к CORS middleware)
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "3600"

        # Другие security headers
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"  # Более мягче, чем DENY, для встраивания в OBS
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )

        # Expose nonce в заголовок для использования в клиенте (если нужно)
        response.headers["X-Script-Nonce"] = script_nonce

        return response

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware для логирования запросов"""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Получаем информацию о пользователе из токена (если есть)
        user_info = "Anonymous"
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                # Здесь можно декодировать JWT токен для получения user_id
                # user_info = f"User:{user_id}"
                pass
            except Exception:
                pass

        # Выполняем запрос
        response = await call_next(request)

        # Вычисляем время выполнения
        process_time = time.time() - start_time

        # Логируем только важные запросы
        if self.should_log_request(request.url.path, response.status_code):
            log_message = (
                f"{request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time:.3f}s - "
                f"User: {user_info} - "
                f"IP: {request.client.host if request.client else 'unknown'}"
            )

            if response.status_code >= 400:
                logger.warning(log_message)
            else:
                logger.info(log_message)

        return response

    def should_log_request(self, path: str, status_code: int) -> bool:
        """Определяет, нужно ли логировать запрос"""
        # Игнорируем статические файлы и health checks
        if path.startswith(('/static/', '/audio/', '/widgets/', '/favicon.ico')):
            return False

        # Игнорируем частые запросы
        if path in ['/health', '/metrics', '/ping']:
            return False

        # Не логируем ожидаемые 401 для публичных эндпоинтов (polling без авторизации)
        if status_code == 401:
            # Эти эндпоинты часто опрашиваются frontend без авторизации
            polling_endpoints = [
                '/api/user-settings/',
                '/api/chat/status',
                '/api/auth/status',
            ]
            if any(path.startswith(endpoint) for endpoint in polling_endpoints):
                return False

        # Не логируем ожидаемые 403, 404
        if status_code in [403, 404]:
            return False

        # Логируем серьезные ошибки (5xx)
        if status_code >= 500:
            return True

        # Логируем клиентские ошибки (4xx), кроме уже исключенных
        if status_code >= 400:
            return True

        # Логируем API запросы
        if path.startswith('/api/'):
            return True

        # Логируем WebSocket подключения
        if path.startswith('/ws/'):
            return True

        return False

