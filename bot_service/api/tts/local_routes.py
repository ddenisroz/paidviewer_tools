# api/tts/local_routes.py
"""
Provider-aware Local TTS API endpoints.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.auth import get_current_user, get_current_user_optional
from core.database import get_db
from repositories.local_tts_repository import LocalTTSRepository
from services.tts.tts_core import LocalTTSConfigRequest, check_local_tts_health

logger = logging.getLogger("bot_service.tts.local")

local_tts_router = APIRouter(prefix="/api/local-tts", tags=["local-tts"])


def _normalize_local_provider(provider: str) -> str:
    normalized = (provider or "").strip().lower()
    if normalized not in {"f5", "qwen"}:
        raise HTTPException(status_code=400, detail='provider must be either "f5" or "qwen"')
    return normalized


# ============================================================================
# LOCAL TTS CONFIG
# ============================================================================


@local_tts_router.get("/config")
async def get_local_tts_config(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    provider: str = "f5",
):
    """Get local TTS config for selected provider."""
    try:
        resolved_provider = _normalize_local_provider(provider)

        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = user.get("id")
        if not user_id or user_id <= 0:
            raise HTTPException(status_code=401, detail="Authentication required")

        repo = LocalTTSRepository(db)
        config = repo.get_by_user_id(user_id, provider=resolved_provider)

        if not config:
            return {
                "success": True,
                "configured": False,
                "config": None,
                "provider": resolved_provider,
                "healthy": False,
                "can_manage_voices": True,
                "endpoint_url": None,
                "api_key": None,
                "use_local": False,
                "message": "Local TTS is not configured",
            }

        return {
            "success": True,
            "configured": True,
            "provider": resolved_provider,
            "healthy": config.is_healthy,
            "can_manage_voices": True,
            "endpoint_url": config.endpoint_url,
            "api_key": config.api_key,
            "use_local": config.use_local,
            "is_active": config.is_active,
            "config": {
                "id": config.id,
                "provider": config.provider,
                "endpoint_url": config.endpoint_url,
                "api_key": config.api_key,
                "is_active": config.is_active,
                "use_local": config.use_local,
                "is_healthy": config.is_healthy,
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting local TTS config")
        raise HTTPException(status_code=500, detail="Internal server error")


@local_tts_router.post("/config")
async def save_local_tts_config(
    request: LocalTTSConfigRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save local TTS config for selected provider."""
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = user.get("id")
        if not user_id or user_id <= 0:
            raise HTTPException(status_code=401, detail="Authentication required")

        resolved_provider = _normalize_local_provider(request.provider)
        repo = LocalTTSRepository(db)
        config = repo.create_or_update(
            endpoint_url=request.endpoint_url,
            api_key=request.api_key,
            use_local=request.use_local,
            user_id=user_id,
            provider=resolved_provider,
        )

        health_status = await check_local_tts_health(config.endpoint_url, config.api_key)
        repo.update_health_status(config, health_status.get("healthy", False))

        return {
            "success": True,
            "provider": resolved_provider,
            "message": "Configuration saved",
            "config": {
                "id": config.id,
                "provider": config.provider,
                "endpoint_url": config.endpoint_url,
                "api_key": config.api_key,
                "use_local": config.use_local,
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error saving local TTS config")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# LOCAL TTS TOGGLE
# ============================================================================


@local_tts_router.post("/toggle")
async def toggle_local_tts(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    provider: str = "f5",
):
    """Toggle use_local flag for selected local provider."""
    try:
        resolved_provider = _normalize_local_provider(provider)
        repo = LocalTTSRepository(db)

        db_user = repo.get_user_by_id(user["id"])
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        login_platform = user.get("login_platform")
        if not repo.is_user_whitelisted(db_user, login_platform):
            raise HTTPException(
                status_code=403,
                detail="Local TTS is available only for whitelisted users.",
            )

        config = repo.get_by_user_id(user["id"], provider=resolved_provider)
        if not config:
            raise HTTPException(status_code=404, detail="Local TTS config not found.")

        config = repo.toggle_use_local(config)

        if config.use_local:
            health_status = await check_local_tts_health(config.endpoint_url, config.api_key)
            if not health_status.get("healthy", False):
                repo.disable_local(config)
                raise HTTPException(
                    status_code=503,
                    detail="Local TTS is unavailable. Check your connection.",
                )

        return {
            "success": True,
            "provider": resolved_provider,
            "message": f"Local TTS {'enabled' if config.use_local else 'disabled'}",
            "use_local": config.use_local,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error toggling local TTS")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# LOCAL TTS TEST & SYNC
# ============================================================================


@local_tts_router.post("/test-connection")
async def test_local_tts_connection(
    request: LocalTTSConfigRequest,
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Test connection to a local provider endpoint."""
    _ = db
    _ = user

    try:
        resolved_provider = _normalize_local_provider(request.provider)
        headers = {}
        if request.api_key:
            headers["Authorization"] = f"Bearer {request.api_key}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            health_response = await client.get(f"{request.endpoint_url}/health", headers=headers)

            if health_response.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Server returned status code {health_response.status_code}")

            health_data = health_response.json()

            try:
                status_response = await client.get(f"{request.endpoint_url}/api/status", headers=headers)
                status_data = status_response.json() if status_response.status_code == 200 else None
            except Exception:
                status_data = None

            return {
                "success": True,
                "provider": resolved_provider,
                "message": "Connection successful",
                "health_data": health_data,
                "status_data": status_data,
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout: service is not responding.")
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Could not connect. Check endpoint URL.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error testing local TTS connection")
        raise HTTPException(status_code=500, detail="Connection check failed")


@local_tts_router.post("/sync-global-voices")
async def sync_global_voices_to_local(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
    provider: str = "f5",
):
    """Fetch voice list from configured local provider endpoint."""
    try:
        resolved_provider = _normalize_local_provider(provider)

        user_id = user.get("id") if user else None
        if not user_id or user_id <= 0:
            raise HTTPException(status_code=401, detail="Authentication required")

        repo = LocalTTSRepository(db)
        config = repo.get_by_user_id(user_id, provider=resolved_provider)
        if not config:
            raise HTTPException(status_code=404, detail="Local TTS is not configured")

        headers = {}
        if config.api_key:
            headers["Authorization"] = f"Bearer {config.api_key}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{config.endpoint_url}/api/voices/list", headers=headers)
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail="Failed to fetch voices")

                data = response.json()
                local_voices = data.get("voices", [])
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Internal server error")

        return {
            "success": True,
            "provider": resolved_provider,
            "message": f"Detected voices: {len(local_voices)}",
            "voices": local_voices,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error syncing local voices")
        raise HTTPException(status_code=500, detail="Internal server error")
