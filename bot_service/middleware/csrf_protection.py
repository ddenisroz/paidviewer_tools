"""
CSRF Protection Middleware
Р—Р°С‰РёС‚Р° РѕС‚ Cross-Site Request Forgery Р°С‚Р°Рє
"""
import secrets
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware РґР»СЏ Р·Р°С‰РёС‚С‹ РѕС‚ CSRF Р°С‚Р°Рє
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
        # РџСЂРѕРІРµСЂСЏРµРј, РЅСѓР¶РЅРѕ Р»Рё РїСЂРѕРІРµСЂСЏС‚СЊ CSRF РґР»СЏ СЌС‚РѕРіРѕ РїСѓС‚Рё
        if self._is_exempt_path(request.url.path):
            return await call_next(request)

        # РџСЂРѕРІРµСЂСЏРµРј С‚РѕР»СЊРєРѕ РёР·РјРµРЅСЏСЋС‰РёРµ РјРµС‚РѕРґС‹ РґР»СЏ cookie-based session flows.
        # Non-session traffic (service-to-service, token auth) is skipped for compatibility.
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            has_session_cookie = bool(request.cookies.get("session_id"))
            if has_session_cookie and not await self._validate_csrf_token(request):
                logger.warning(f"CSRF validation failed for {request.method} {request.url.path}")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "CSRF token validation failed"}
                )

        response = await call_next(request)

        # Р”РѕР±Р°РІР»СЏРµРј CSRF С‚РѕРєРµРЅ РІ РѕС‚РІРµС‚ РґР»СЏ GET Р·Р°РїСЂРѕСЃРѕРІ
        if request.method == "GET" and request.url.path.startswith("/api/"):
            csrf_token = self._generate_csrf_token(request)
            forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
            is_secure_request = request.url.scheme == "https" or forwarded_proto == "https"
            response.set_cookie(
                "csrf_token",
                csrf_token,
                httponly=False,  # РќСѓР¶РµРЅ РґР»СЏ JavaScript
                secure=is_secure_request,
                samesite="strict",
                max_age=3600  # 1 С‡Р°СЃ
            )

        return response

    def _is_exempt_path(self, path: str) -> bool:
        """РџСЂРѕРІРµСЂСЏРµС‚, РѕСЃРІРѕР±РѕР¶РґРµРЅ Р»Рё РїСѓС‚СЊ РѕС‚ CSRF РїСЂРѕРІРµСЂРєРё"""
        for exempt in self.exempt_paths:
            if path == exempt or path.startswith(f"{exempt}/"):
                return True
        return False

    def _generate_csrf_token(self, request: Request) -> str:
        """Р“РµРЅРµСЂРёСЂСѓРµС‚ CSRF С‚РѕРєРµРЅ, РїСЂРёРІСЏР·Р°РЅРЅС‹Р№ Рє СЃРµСЃСЃРёРё"""
        import hmac
        import hashlib
        
        # РџСЂРёРІСЏР·С‹РІР°РµРј С‚РѕРєРµРЅ Рє session_id С‡РµСЂРµР· HMAC
        session_id = request.cookies.get("session_id", "")
        if session_id:
            # HMAC РґР»СЏ РїСЂРёРІСЏР·РєРё Рє СЃРµСЃСЃРёРё + random РґР»СЏ СѓРЅРёРєР°Р»СЊРЅРѕСЃС‚Рё
            session_hash = hmac.new(
                self.secret_key.encode(),
                session_id.encode(),
                hashlib.sha256
            ).hexdigest()[:32]
            return f"{session_hash}_{secrets.token_urlsafe(16)}"
        
        # Fallback РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Р±РµР· СЃРµСЃСЃРёРё
        return secrets.token_urlsafe(32)

    async def _validate_csrf_token(self, request: Request) -> bool:
        """Р’Р°Р»РёРґРёСЂСѓРµС‚ CSRF С‚РѕРєРµРЅ"""
        # РџРѕР»СѓС‡Р°РµРј С‚РѕРєРµРЅ РёР· Р·Р°РіРѕР»РѕРІРєР°
        csrf_token = request.headers.get("X-CSRF-Token")
        if not csrf_token:
            return False

        # РџРѕР»СѓС‡Р°РµРј С‚РѕРєРµРЅ РёР· cookies
        cookie_token = request.cookies.get("csrf_token")
        if not cookie_token:
            return False

        # РЎСЂР°РІРЅРёРІР°РµРј С‚РѕРєРµРЅС‹
        return secrets.compare_digest(csrf_token, cookie_token)

def get_csrf_token(request: Request) -> str:
    """РџРѕР»СѓС‡РёС‚СЊ CSRF С‚РѕРєРµРЅ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РІ С„РѕСЂРјР°С…"""
    return request.cookies.get("csrf_token", "")

