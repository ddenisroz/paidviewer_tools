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


@router.post("/clear-legacy")
async def clear_legacy_sessions(db: Session = Depends(get_db)):
    """РћС‡РёСЃС‚РёС‚СЊ legacy СЃРµСЃСЃРёРё (test_channel, СЃС‚Р°СЂС‹Рµ VK ID)"""
    try:
        service = SessionService(db)
        cleared = service.clear_legacy_sessions()
        return {"success": True, "cleared": cleared}
    except Exception as e:
        logger.error(f"Error clearing legacy sessions: {e}")
        return {"success": False, "error": "Internal server error"}


@router.get("/active-channels")
async def get_active_channels(db: Session = Depends(get_db)):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє Р°РєС‚РёРІРЅС‹С… РєР°РЅР°Р»РѕРІ"""
    try:
        service = SessionService(db)
        channels = service.get_active_channels()
        
        return {
            "success": True,
            "channels": channels,
            "total": len(channels)
        }
    except Exception as e:
        logger.error(f"Error getting active channels: {e}")
        return {"success": False, "error": "Internal server error"}


@router.get("/active-sessions")
async def get_active_sessions(db: Session = Depends(get_db)):
    """РџРѕР»СѓС‡РёС‚СЊ РґРµС‚Р°Р»СЊРЅСѓСЋ РёРЅС„РѕСЂРјР°С†РёСЋ РѕР± Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёСЏС…"""
    try:
        service = SessionService(db)
        sessions = service.get_active_sessions_details()

        return {
            "success": True,
            "sessions": sessions,
            "total_channels": len(sessions)
        }
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        return {"success": False, "error": "Internal server error"}


@router.post("/disconnect/{channel_name}")
async def disconnect_channel(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РѕС‚РєР»СЋС‡РёС‚СЊ РєР°РЅР°Р»"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹)
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")

        service = SessionService(db)
        success = service.disconnect_channel(channel_name, user['id'])

        if success:
            return {"success": True, "message": f"Channel {channel_name} disconnected"}
        else:
            return {"success": False, "message": f"Channel {channel_name} not found"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting channel {channel_name}: {e}")
        return {"success": False, "error": "Internal server error"}


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
        if not user.get('is_admin', False) and user['id'] != user_id:
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
    except Exception as e:
        logger.error(f"Error getting user tokens: {e}")
        return {"success": False, "error": "Internal server error"}


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
             
        if not user.get('is_admin', False) and user['id'] != token_owner_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Р’С‹РїРѕР»РЅСЏРµРј РѕР±РЅРѕРІР»РµРЅРёРµ
        # (РїРµСЂРµРґР°РµРј user_id РґР»СЏ РґРѕРї. РїСЂРѕРІРµСЂРєРё РІРЅСѓС‚СЂРё СЃРµСЂРІРёСЃР°, С…РѕС‚СЏ РјС‹ СѓР¶Рµ РїСЂРѕРІРµСЂРёР»Рё)
        success = service.refresh_token(token_id, token_owner_id)

        return {"success": True, "message": "Token refreshed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token {token_id}: {e}")
        return {"success": False, "error": "Internal server error"}
