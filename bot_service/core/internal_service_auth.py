"""Helpers for bot_service -> internal services authentication headers."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import jwt

from core.config import settings

logger = logging.getLogger(__name__)


def create_internal_service_jwt(
    *,
    audience: str,
    subject: str = "bot_service",
) -> str:
    """Create a short-lived JWT for internal service-to-service requests."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.internal_service_jwt_ttl_seconds)
    payload = {
        "iss": settings.internal_service_jwt_issuer,
        "sub": subject,
        "service": subject,
        "aud": audience,
        "type": "service",
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    signing_key = settings.internal_service_jwt_secret or settings.secret_key
    return jwt.encode(payload, signing_key, algorithm=settings.algorithm)


def build_tts_auth_headers() -> Dict[str, str]:
    """
    Build auth headers for bot_service -> TTS calls.

    Includes service JWT and keeps legacy X-Internal-Service-Key for transition.
    """
    headers: Dict[str, str] = {}

    if settings.internal_service_jwt_enabled:
        try:
            service_token = create_internal_service_jwt(audience=settings.internal_service_jwt_audience_tts)
            headers["Authorization"] = f"Bearer {service_token}"
        except Exception:
            logger.exception("Failed to generate internal service JWT for TTS call")

    if settings.tts_internal_api_key:
        headers["X-Internal-Service-Key"] = settings.tts_internal_api_key

    return headers


def build_tts_httpx_client_kwargs() -> Dict[str, Any]:
    """
    Build optional httpx TLS kwargs for bot_service -> TTS internal calls.

    Uses mTLS settings only when explicitly enabled.
    """
    if not settings.internal_service_mtls_enabled:
        return {}

    kwargs: Dict[str, Any] = {}

    if settings.internal_service_ca_cert_path:
        kwargs["verify"] = settings.internal_service_ca_cert_path
    else:
        kwargs["verify"] = True

    cert_path = settings.internal_service_client_cert_path
    key_path = settings.internal_service_client_key_path
    if cert_path and key_path:
        kwargs["cert"] = (cert_path, key_path)
    elif cert_path:
        kwargs["cert"] = cert_path
    else:
        logger.warning(
            "INTERNAL_SERVICE_MTLS_ENABLED=true but client cert is not configured; continuing without mTLS cert"
        )

    return kwargs
