# bot_service/core/security_modern.py
"""
РЎРѕРІСЂРµРјРµРЅРЅР°СЏ СЃРёСЃС‚РµРјР° Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј РїСЂРѕС„РµСЃСЃРёРѕРЅР°Р»СЊРЅС‹С… Р±РёР±Р»РёРѕС‚РµРє
Р—Р°РјРµРЅСЏРµС‚ СЃР°РјРѕРїРёСЃРЅС‹Рµ РєРѕСЃС‚С‹Р»Рё РЅР° РїСЂРѕРІРµСЂРµРЅРЅС‹Рµ СЂРµС€РµРЅРёСЏ
"""
import logging
import secrets
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

# РЎРѕРІСЂРµРјРµРЅРЅС‹Рµ Р±РёР±Р»РёРѕС‚РµРєРё Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse

from core.config import settings

logger = logging.getLogger(__name__)


# РќР°СЃС‚СЂРѕР№РєР° rate limiting
limiter = Limiter(key_func=get_remote_address)

# РќР°СЃС‚СЂРѕР№РєР° JWT
security = HTTPBearer()

class ModernSecurityManager:
    """РЎРѕРІСЂРµРјРµРЅРЅС‹Р№ РјРµРЅРµРґР¶РµСЂ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё СЃ РїСЂРѕС„РµСЃСЃРёРѕРЅР°Р»СЊРЅС‹РјРё Р±РёР±Р»РёРѕС‚РµРєР°РјРё"""

    def __init__(self):
        self.secret_key = settings.secret_key
        self.algorithm = settings.algorithm
        self.access_token_expire_minutes = 30  # Default 30 minutes

        logger.info("[AUTH] Modern Security Manager initialized with professional libraries")


    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        РЎРѕР·РґР°РЅРёРµ JWT С‚РѕРєРµРЅР° РґРѕСЃС‚СѓРїР°
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)

        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def verify_jwt_token(self, token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Verify JWT token and optionally enforce token type.

        `expected_type` matches payload field `type` or legacy `token_type`.
        """
        if not token or not isinstance(token, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload: Dict[str, Any] = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            if expected_type:
                token_type = payload.get("type") or payload.get("token_type")
                if token_type != expected_type:
                    logger.warning(
                        "JWT token type mismatch: expected=%s got=%s",
                        expected_type,
                        token_type,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token type",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            return payload
        except JWTError as e:
            logger.error(f"JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def verify_token(self, token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
        """Backward-compatible JWT verification API."""
        return self.verify_jwt_token(token, expected_type=expected_type)

    def generate_session_id(self) -> str:
        """
        Р“РµРЅРµСЂР°С†РёСЏ Р±РµР·РѕРїР°СЃРЅРѕРіРѕ ID СЃРµСЃСЃРёРё
        """
        return secrets.token_urlsafe(32)

    def generate_csrf_token(self) -> str:
        """
        Р“РµРЅРµСЂР°С†РёСЏ CSRF С‚РѕРєРµРЅР°
        """
        return secrets.token_urlsafe(32)

    def verify_csrf_token(self, token: str, session_token: str) -> bool:
        """
        РџСЂРѕРІРµСЂРєР° CSRF С‚РѕРєРµРЅР°
        """
        # РџСЂРѕСЃС‚Р°СЏ РїСЂРѕРІРµСЂРєР° - РІ СЂРµР°Р»СЊРЅРѕРј РїСЂРѕРµРєС‚Рµ РјРѕР¶РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ Р±РѕР»РµРµ СЃР»РѕР¶РЅСѓСЋ Р»РѕРіРёРєСѓ
        return token == session_token

# Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ СЌРєР·РµРјРїР»СЏСЂ
modern_security_manager = ModernSecurityManager()

# Р”РµРєРѕСЂР°С‚РѕСЂС‹ РґР»СЏ rate limiting
def rate_limit(requests_per_minute: str):
    """Р”РµРєРѕСЂР°С‚РѕСЂ РґР»СЏ rate limiting"""
    return limiter.limit(requests_per_minute)

def login_rate_limit():
    """Р”РµРєРѕСЂР°С‚РѕСЂ РґР»СЏ rate limiting Р»РѕРіРёРЅР°"""
    return limiter.limit(settings.rate_limit_login)

# Р¤СѓРЅРєС†РёРё РґР»СЏ FastAPI
def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """
    РџРѕР»СѓС‡РµРЅРёРµ ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР· JWT С‚РѕРєРµРЅР°
    """
    token = credentials.credentials
    payload = modern_security_manager.verify_token(token)
    user_id: int = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    return user_id

def get_current_user_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> bool:
    """
    РџСЂРѕРІРµСЂРєР° Р°РґРјРёРЅСЃРєРёС… РїСЂР°РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    """
    token = credentials.credentials
    payload = modern_security_manager.verify_token(token)
    is_admin: bool = payload.get("is_admin", False)
    return is_admin

# РћР±СЂР°Р±РѕС‚С‡РёРє РѕС€РёР±РѕРє rate limiting
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """
    РћР±СЂР°Р±РѕС‚С‡РёРє РѕС€РёР±РѕРє rate limiting
    """
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": f"Rate limit exceeded: {exc.detail}"}
    )

logger.info("[AUTH] Modern Security Manager initialized with JWT")

