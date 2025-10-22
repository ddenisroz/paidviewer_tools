# bot_service/core/middleware.py
"""Middleware для FastAPI приложения"""
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware для добавления заголовков безопасности"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' ws: wss:; "
            "font-src 'self' data:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        
        # Другие заголовки безопасности
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware для логирования запросов"""
    
    async def dispatch(self, request: Request, call_next):
        # Логируем ВCЕХ запросы к /auth/twitch/callback
        if "/auth/twitch/callback" in str(request.url):
            logger.info(f"!!! MIDDLEWARE: Twitch callback request: {request.url}")
            logger.info(f"!!! MIDDLEWARE: Method: {request.method}")
            logger.info(f"!!! MIDDLEWARE: Headers: {dict(request.headers)}")
        
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
        # Всегда логируем ошибки
        if status_code >= 400:
            return True
        
        # Игнорируем статические файлы и health checks
        if path.startswith(('/static/', '/audio/', '/widgets/', '/favicon.ico')):
            return False
        
        # Игнорируем частые запросы
        if path in ['/health', '/metrics', '/ping']:
            return False
        
        # Логируем API запросы
        if path.startswith('/api/'):
            return True
        
        # Логируем WebSocket подключения
        if path.startswith('/ws/'):
            return True
        
        return False

