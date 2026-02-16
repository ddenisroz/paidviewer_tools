# bot_service/api/additional_api.py
"""
Additional API endpoints.

REFACTORED: Р‘РёР·РЅРµСЃ-Р»РѕРіРёРєР° РІС‹РЅРµСЃРµРЅР° РІ СЃРµСЂРІРёСЃС‹:
- IntegrationManagementService
- ChatHistoryService  
- AccountDeletionService

Р­С‚РѕС‚ С„Р°Р№Р» СЃРѕРґРµСЂР¶РёС‚ РўРћР›Р¬РљРћ СЂРѕСѓС‚РёРЅРі Рё РїСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёРµ РґР°РЅРЅС‹С….
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional
from services.integration_management_service import integration_management_service
from services.chat_history_service import chat_history_service
from services.account_deletion_service import account_deletion_service

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["additional"])


# ==================== Auth Endpoints ====================

@router.get("/auth/user/me")
async def get_user_me(user: dict = Depends(get_current_user)):
    """РџРѕР»СѓС‡РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ С‚РµРєСѓС‰РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ."""
    return JSONResponse(content={
        "id": user.get("id"),
        "twitch_username": user.get("twitch_username"),
        "vk_username": user.get("vk_username"),
        "is_admin": user.get("is_admin", False),
        "created_at": user.get("created_at")
    })


@router.get("/auth/session/status")
async def get_session_status(user: dict = Depends(get_current_user)):
    """РџРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚СѓСЃ СЃРµСЃСЃРёРё."""
    return JSONResponse(content={
        "authenticated": True,
        "user_id": user.get("id"),
        "session_valid": True,
        "expires_at": None
    })


@router.post("/clear-verifications")
async def clear_verifications(user: dict = Depends(get_current_user)):
    """РћС‡РёСЃС‚РёС‚СЊ РІРµСЂРёС„РёРєР°С†РёРё."""
    logger.info(f"Clear verifications requested by user {user['id']}")
    return JSONResponse(content={"success": True, "message": "Verifications cleared"})


# ==================== Integration Endpoints ====================

@router.get("/integrations")
async def get_integrations(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РёРЅС‚РµРіСЂР°С†РёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ РІР°Р»РёРґР°С†РёРµР№ С‚РѕРєРµРЅРѕРІ."""
    try:
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        integrations = await integration_management_service.get_user_integrations(
            user_id, db
        )
        
        # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј РІ С„РѕСЂРјР°С‚ API
        result = {}
        for platform, info in integrations.items():
            result[platform] = {
                "connected": info.connected,
                "username": info.username,
                "platform_user_id": info.platform_user_id,
                "avatar_url": info.avatar_url,
            }
        
        return JSONResponse(content={"integrations": result})
        
    except Exception as e:
        logger.error(f"Error getting integrations: {e}")
        return JSONResponse(content={"integrations": {}}, status_code=500)


@router.post("/integrations/{platform}/disconnect")
async def disconnect_integration(
    platform: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    РћС‚РєР»СЋС‡РёС‚СЊ РёРЅС‚РµРіСЂР°С†РёСЋ (РѕС‚РєР»СЋС‡РёС‚СЊ Р±РѕС‚Р° Рё СѓРґР°Р»РёС‚СЊ С‚РѕРєРµРЅС‹).
    """
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found")
    
    try:
        await integration_management_service.disconnect_integration(
            user_id, platform, db
        )
        return JSONResponse(content={
            "success": True, 
            "message": f"{platform} bot disconnected"
        })
    except ValueError:
        raise HTTPException(status_code=404, detail="Resource not found")
    except Exception as e:
        logger.error(f"Error disconnecting {platform}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/integrations/{platform}/remove")
async def remove_integration(
    platform: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    РџРћР›РќРћРЎРўР¬Р® СѓРґР°Р»РёС‚СЊ РёРЅС‚РµРіСЂР°С†РёСЋ.
    РџРѕСЃР»Рµ СЌС‚РѕРіРѕ РїРѕС‚СЂРµР±СѓРµС‚СЃСЏ РїРѕР»РЅР°СЏ РїРµСЂРµР°РІС‚РѕСЂРёР·Р°С†РёСЏ.
    """
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found")
    
    try:
        await integration_management_service.remove_integration(
            user_id, platform, db
        )
        return JSONResponse(content={
            "success": True, 
            "message": f"{platform} integration fully removed. Re-authorization required."
        })
    except ValueError:
        raise HTTPException(status_code=404, detail="Resource not found")
    except Exception as e:
        logger.error(f"Error removing {platform}: {e}")
        return JSONResponse(
            content={"success": False, "error": "Internal server error"}, 
            status_code=500
        )


# ==================== Chat History Endpoints ====================

@router.get("/chat/history")
async def get_chat_history(
    channel: str = None,
    platform: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """РџРѕР»СѓС‡РёС‚СЊ РёСЃС‚РѕСЂРёСЋ СЃРѕРѕР±С‰РµРЅРёР№ С‡Р°С‚Р°."""
    try:
        if not current_user:
            return JSONResponse(content={"success": True, "messages": []})
        
        user_id = current_user.get("id")
        
        messages = chat_history_service.get_chat_history(
            user_id, channel, platform, limit, db
        )
        
        # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј DTO РІ dict РґР»СЏ JSON
        messages_data = [msg.to_dict() for msg in messages]
        
        logger.info(f"[CHAT] Returning {len(messages_data)} messages")
        
        return JSONResponse(content={
            "success": True,
            "messages": messages_data,
            "total": len(messages_data)
        })
        
    except Exception as e:
        logger.error(f"[CHAT] Error: {e}", exc_info=True)
        return JSONResponse(
            content={"success": False, "messages": [], "error": "Internal server error"},
            status_code=500
        )


# ==================== Account Deletion Endpoints ====================

@router.post("/admin/permanently-delete-user/{user_id}")
async def permanently_delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    [ADMIN ONLY] РћРєРѕРЅС‡Р°С‚РµР»СЊРЅРѕРµ СѓРґР°Р»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР· Р±Р°Р·С‹ РґР°РЅРЅС‹С….
    
    Р’РќРРњРђРќРР•: Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РќР•РћР‘Р РђРўРРњРћ!
    """
    # РџСЂРѕРІРµСЂРєР° РїСЂР°РІ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°
    if not current_user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await account_deletion_service.hard_delete_account(
            user_id, current_user.get("id"), db
        )
        return JSONResponse(content={
            "success": result.success,
            "message": result.message,
        })
    except ValueError:
        raise HTTPException(status_code=404, detail="Resource not found")
    except Exception as e:
        logger.error(f"[ADMIN] Error deleting user: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/user/delete-account")
async def delete_user_account(
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    РџРћР›РќРћР• СѓРґР°Р»РµРЅРёРµ Р°РєРєР°СѓРЅС‚Р° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
    
    РЈРґР°Р»СЏРµС‚ Р’РЎР• РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё Р°РЅРѕРЅРёРјРёР·РёСЂСѓРµС‚ РµРіРѕ Р·Р°РїРёСЃСЊ.
    РџРѕСЃР»Рµ СѓРґР°Р»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р±СѓРґРµС‚ СЂР°Р·Р»РѕРіРёРЅРµРЅ.
    """
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found")
    
    try:
        result = await account_deletion_service.soft_delete_account(user_id, db)
        
        # РћС‡РёС‰Р°РµРј cookie СЃРµСЃСЃРёРё
        response = JSONResponse(content={
            "success": result.success,
            "message": result.message,
            "deleted_data": result.deleted_counts
        })
        response.delete_cookie(key="session_id", path="/")
        
        return response
        
    except ValueError:
        raise HTTPException(status_code=404, detail="Resource not found")
    except Exception as e:
        logger.error(f"[ACCOUNT] Error deleting account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

