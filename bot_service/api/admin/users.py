# bot_service/api/admin/users.py
"""
Admin Users API endpoints.

Clean Architecture: endpoints delegate to services.
No direct DB queries in this file.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from typing import Optional
import logging

from services.admin import get_admin_stats_service, whitelist_service, user_management_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: dict):
    """Check if user is admin."""
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/users")
async def get_admin_users(
    page: int = 1,
    limit: int = 50,
    search: str = None,
    include_guests: bool = True,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РґР»СЏ Р°РґРјРёРЅРєРё."""
    try:
        require_admin(user)
        
        stats_service = get_admin_stats_service(db)
        result = stats_service.get_admin_users_list(page=page, limit=limit, search=search)
        
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting admin users: {e}")
        return JSONResponse(content={"success": False, "error": "Internal server error"}, status_code=500)


@router.post("/users/{user_id}/block")
async def block_user(
    user_id: int,
    reason: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РљРѕРјРїР»РµРєСЃРЅР°СЏ Р±Р»РѕРєРёСЂРѕРІРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ:
    1. Р‘Р»РѕРєРёСЂСѓРµС‚ РґРѕСЃС‚СѓРї С‡РµСЂРµР· OAuth (User.is_blocked)
    2. Р‘Р»РѕРєРёСЂСѓРµС‚ РІСЃРµ РµРіРѕ РєР°РЅР°Р»С‹ РІ РіРѕСЃС‚РµРІРѕРј СЂРµР¶РёРјРµ (BlockedChannel)
    3. РћС‚РєР»СЋС‡Р°РµС‚ Р±РѕС‚Р° РѕС‚ РІСЃРµС… РєР°РЅР°Р»РѕРІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    """
    try:
        require_admin(user)
        
        # Use service for blocking
        result = await user_management_service.block_user(
            user_id, 
            {"reason": reason or "Blocked by administrator"}, 
            db
        )
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        # Disconnect bots (runtime operation, stays in controller)
        from startup.bot_registry import get_bot_registry
        from repositories.user_repository import UserRepository
        
        user_repo = UserRepository(db)
        target_user = user_repo.get_by_id(user_id)
        
        disconnected = []
        if target_user:
            registry = get_bot_registry()
            
            if target_user.twitch_username and registry.twitch_bot:
                try:
                    await registry.twitch_bot.part_channels([target_user.twitch_username])
                    disconnected.append(f"Twitch: {target_user.twitch_username}")
                except Exception as e:
                    logger.error(f"Error disconnecting Twitch bot: {e}")
            
            if target_user.vk_channel_name and registry.vk_bot:
                try:
                    await registry.vk_bot.disconnect_from_channel(target_user.vk_channel_name)
                    disconnected.append(f"VK: {target_user.vk_channel_name}")
                except Exception as e:
                    logger.error(f"Error disconnecting VK bot: {e}")
        
        return JSONResponse(content={
            "success": True,
            "message": f"User {user_id} fully blocked",
            "details": {
                "oauth_blocked": True,
                "bots_disconnected": disconnected,
                "reason": reason or "Blocked by administrator"
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking user: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": "Internal server error"}, status_code=500)


@router.post("/users/{user_id}/unblock")
async def unblock_user(
    user_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РљРѕРјРїР»РµРєСЃРЅР°СЏ СЂР°Р·Р±Р»РѕРєРёСЂРѕРІРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ."""
    try:
        require_admin(user)
        
        result = await user_management_service.unblock_user(user_id, db)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return JSONResponse(content={
            "success": True,
            "message": f"User {user_id} fully unblocked",
            "details": {"oauth_unblocked": True}
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking user: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": "Internal server error"}, status_code=500)


@router.get("/sessions")
async def get_sessions(
    page: int = 1,
    limit: int = 50,
    include_guests: bool = True,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№."""
    try:
        require_admin(user)
        
        stats_service = get_admin_stats_service(db)
        result = stats_service.get_sessions_paginated(page=page, limit=limit)
        
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        return JSONResponse(content={"success": False, "error": "Internal server error"}, status_code=500)


@router.post("/whitelist/add")
async def add_to_whitelist(
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р”РѕР±Р°РІРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ whitelist."""
    try:
        require_admin(user)
        
        try:
            body = await request.json()
            username = body.get('username') or body.get('channel_name')
            platform = (body.get('platform') or 'twitch').lower().strip()
        except Exception:
            username = request.query_params.get('username') or request.query_params.get('channel_name')
            platform = (request.query_params.get('platform') or 'twitch').lower().strip()
        
        if not username:
            raise HTTPException(status_code=400, detail="Username or channel_name is required")
        
        username = username.lower().strip()
        if platform not in ("twitch", "vk"):
            platform = "twitch"
        
        from models.pydantic_models import AddToWhitelistRequest
        request_data = AddToWhitelistRequest(username=username, platform=platform)
        
        result = await whitelist_service.add_to_whitelist(request_data, db)
        
        if "error" in result:
            return JSONResponse(content={"success": False, "error": result["error"]}, status_code=400)
        
        return JSONResponse(content={"success": True, "message": f"User {username} added to whitelist"})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding to whitelist: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": "Internal server error"}, status_code=500)


@router.get("/whitelist")
async def get_whitelist(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РІ whitelist."""
    try:
        require_admin(user)
        
        result = await whitelist_service.get_whitelist(db)
        
        whitelist_data = [
            {
                'id': entry.id,
                'channel_name': entry.channel_name,
                'platform': entry.platform,
                'created_at': entry.created_at.isoformat() if entry.created_at else None
            }
            for entry in result.whitelist_users
        ]
        
        return JSONResponse(content={
            "success": True,
            "whitelist": whitelist_data,
            "total": len(whitelist_data)
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting whitelist: {e}")
        return JSONResponse(content={"success": False, "error": "Internal server error"}, status_code=500)


@router.delete("/whitelist/{username}")
async def remove_from_whitelist(
    username: str,
    platform: Optional[str] = Query(None, description="Platform to remove from (twitch or vk)"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЈРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР· whitelist."""
    try:
        require_admin(user)
        
        username = username.lower().strip()
        
        if platform:
            platform = platform.lower().strip()
            if platform not in ("twitch", "vk"):
                return JSONResponse(content={"success": False, "error": "Invalid platform"}, status_code=400)
        else:
            platform = "twitch"  # Default
        
        from models.pydantic_models import AddToWhitelistRequest
        request_data = AddToWhitelistRequest(username=username, platform=platform)
        
        result = await whitelist_service.remove_from_whitelist(request_data, db)
        
        if "error" in result:
            return JSONResponse(content={"success": False, "error": result["error"]}, status_code=404)
        
        return JSONResponse(content={"success": True, "message": f"User {username} removed from whitelist"})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing from whitelist: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": "Internal server error"}, status_code=500)
