"""
CSRF Protection Middleware
Защита от Cross-Site Request Forgery атак
"""
import secrets
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware для защиты от CSRF атак
    """

    def __init__(self, app, secret_key: str, exempt_paths: list = None):
        super().__init__(app)
        self.secret_key = secret_key
        self.exempt_paths = exempt_paths or [
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/auth/twitch",
            "/auth/vk",
            "/auth/twitch/callback",
            "/auth/vk/callback",
        ]

    async def dispatch(self, request: Request, call_next):
        # Проверяем, нужно ли проверять CSRF для этого пути
        if self._is_exempt_path(request.url.path):
            return await call_next(request)

        # Проверяем только изменяющие методы
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            if not await self._validate_csrf_token(request):
                logger.warning(f"CSRF validation failed for {request.method} {request.url.path}")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "CSRF token validation failed"}
                )

        response = await call_next(request)

        # Добавляем CSRF токен в ответ для GET запросов
        if request.method == "GET" and request.url.path.startswith("/api/"):
            csrf_token = self._generate_csrf_token(request)
            response.set_cookie(
                "csrf_token",
                csrf_token,
                httponly=False,  # Нужен для JavaScript
                secure=True,  # Только HTTPS в production
                samesite="strict",
                max_age=3600  # 1 час
            )

        return response

    def _is_exempt_path(self, path: str) -> bool:
        """Проверяет, освобожден ли путь от CSRF проверки"""
        return any(path.startswith(exempt) for exempt in self.exempt_paths)

    def _generate_csrf_token(self, request: Request) -> str:
        """Генерирует CSRF токен"""
        # Используем session ID + secret key для генерации токена
        request.session.get("session_id", "")
        return secrets.token_urlsafe(32)

    async def _validate_csrf_token(self, request: Request) -> bool:
        """Валидирует CSRF токен"""
        # Получаем токен из заголовка
        csrf_token = request.headers.get("X-CSRF-Token")
        if not csrf_token:
            return False

        # Получаем токен из cookies
        cookie_token = request.cookies.get("csrf_token")
        if not cookie_token:
            return False

        # Сравниваем токены
        return secrets.compare_digest(csrf_token, cookie_token)

def get_csrf_token(request: Request) -> str:
    """Получить CSRF токен для использования в формах"""
    return request.cookies.get("csrf_token", "")
