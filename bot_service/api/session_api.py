# bot_service/api/session_api.py
"""
API РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ СЃРµСЃСЃРёСЏРјРё.
Refactored to use SessionService (Clean Architecture).
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user
from services.session_service import SessionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _is_admin(user: dict) -> bool:
    """Role-based admin check with legacy compatibility."""
    return user.get("role") == "admin" or bool(user.get("is_admin", False))


@router.post("/clear-legacy")
async def clear_legacy_sessions(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """РћС‡РёСЃС‚РёС‚СЊ legacy СЃРµСЃСЃРёРё (test_channel, СЃС‚Р°СЂС‹Рµ VK ID)"""
    try:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin access required")
        service = SessionService(db)
        cleared = service.clear_legacy_sessions()
        return {"success": True, "cleared": cleared}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error clearing legacy sessions")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/active-channels")
async def get_active_channels(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє Р°РєС‚РёРІРЅС‹С… РєР°РЅР°Р»РѕРІ"""
    try:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin access required")
        service = SessionService(db)
        channels = service.get_active_channels()
        
        return {
            "success": True,
            "channels": channels,
            "total": len(channels)
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting active channels")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/active-sessions")
async def get_active_sessions(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """РџРѕР»СѓС‡РёС‚СЊ РґРµС‚Р°Р»СЊРЅСѓСЋ РёРЅС„РѕСЂРјР°С†РёСЋ РѕР± Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёСЏС…"""
    try:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin access required")
        service = SessionService(db)
        sessions = service.get_active_sessions_details()

        return {
            "success": True,
            "sessions": sessions,
            "total_channels": len(sessions)
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting active sessions")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/disconnect/{channel_name}")
async def disconnect_channel(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РѕС‚РєР»СЋС‡РёС‚СЊ РєР°РЅР°Р»"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹)
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin access required")

        service = SessionService(db)
        success = service.disconnect_channel(channel_name, user['id'])

        if success:
            return {"success": True, "message": f"Channel {channel_name} disconnected"}
        else:
            raise HTTPException(status_code=404, detail=f"Channel {channel_name} not found")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error disconnecting channel %s", channel_name)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user-tokens")
async def get_user_tokens(
    user_id: int = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"""
    try:
        # Р•СЃР»Рё user_id РЅРµ СѓРєР°Р·Р°РЅ, РёСЃРїРѕР»СЊР·СѓРµРј С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        if user_id is None:
            user_id = user['id']

        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР°
        if not _is_admin(user) and user['id'] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        service = SessionService(db)
        token_data = service.get_user_tokens(user_id)

        return {
            "success": True,
            "user_id": user_id,
            "tokens": token_data,
            "total": len(token_data)
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting user tokens")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/refresh-token/{token_id}")
async def refresh_token(
    token_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±РЅРѕРІРёС‚СЊ С‚РѕРєРµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РѕР±РЅРѕРІРёС‚СЊ timestamp)"""
    try:
        service = SessionService(db)
        
        # РџСЂРѕРІРµСЂРєР° РїСЂР°РІ РґРѕСЃС‚СѓРїР°
        token_owner_id = service.get_token_owner(token_id)
        if not token_owner_id:
             raise HTTPException(status_code=404, detail="Token not found")
             
        if not _is_admin(user) and user['id'] != token_owner_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Р’С‹РїРѕР»РЅСЏРµРј РѕР±РЅРѕРІР»РµРЅРёРµ
        # (РїРµСЂРµРґР°РµРј user_id РґР»СЏ РґРѕРї. РїСЂРѕРІРµСЂРєРё РІРЅСѓС‚СЂРё СЃРµСЂРІРёСЃР°, С…РѕС‚СЏ РјС‹ СѓР¶Рµ РїСЂРѕРІРµСЂРёР»Рё)
        service.refresh_token(token_id, token_owner_id)

        return {"success": True, "message": "Token refreshed successfully"}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error refreshing token %s", token_id)
        raise HTTPException(status_code=500, detail="Internal server error")
