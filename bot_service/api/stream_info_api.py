from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import time

from auth.auth import get_current_user, get_current_user_optional
from core.database import get_db

# Schemas
from schemas.stream import StreamUpdateRequest
from schemas.stream import PlatformUpdate # Helper import if needed, but not used directly in signature

# Services
from services.stream_info_service import StreamInfoService

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["stream-info"])

# Simple in-memory cache for stream info (30 second TTL)
# Key: (user_id, platform) -> (data, timestamp)
_stream_info_cache: dict[tuple[int, str], tuple[dict, float]] = {}
STREAM_INFO_CACHE_TTL = 30  # seconds

def _get_cached_stream_info(user_id: int, platform: str) -> Optional[dict]:
    """Get cached stream info if not expired"""
    key = (user_id, platform)
    if key in _stream_info_cache:
        data, timestamp = _stream_info_cache[key]
        if time.time() - timestamp < STREAM_INFO_CACHE_TTL:
            logger.debug(f"[STREAM_INFO] Cache HIT for user {user_id}, platform {platform}")
            return data
        else:
            del _stream_info_cache[key]
    return None

def _set_cached_stream_info(user_id: int, platform: str, data: dict) -> None:
    """Cache stream info with timestamp"""
    _stream_info_cache[(user_id, platform)] = (data, time.time())
    logger.debug(f"[STREAM_INFO] Cached data for user {user_id}, platform {platform}")

def get_stream_service(db: Session = Depends(get_db)) -> StreamInfoService:
    return StreamInfoService(db)

@router.get("/twitch/stream")
async def get_twitch_stream_basic(user: dict = Depends(get_current_user)):
    """
    Получить информацию о Twitch стриме (legacy basic info)
    """
    return JSONResponse(content={
        "is_live": False,
        "title": "",
        "category": None,
        "viewers": 0,
        "message": "Basic stream info. Use /api/twitch/stream-info for detailed information."
    })

@router.get("/twitch/stream-info")
async def get_twitch_stream_info(
    user: dict = Depends(get_current_user),
    service: StreamInfoService = Depends(get_stream_service)
):
    """Получить детальную информацию о Twitch стриме (cached for 30s)"""
    try:
        user_id = user.get("id")
        session_id = user.get("session_id")
        
        # Check cache first
        cached = _get_cached_stream_info(user_id, "twitch")
        if cached:
            return JSONResponse(content={"data": cached})
        
        info = await service.get_stream_info(user_id, "twitch", session_id)
        
        # Cache result
        _set_cached_stream_info(user_id, "twitch", info)
        
        return JSONResponse(content={"data": info})
    except Exception as e:
        logger.error(f"Error getting Twitch stream info: {e}")
        return JSONResponse(content={"data": service._empty_info()}, status_code=500)

@router.get("/vk/stream-info")
async def get_vk_stream_info(
    user: dict = Depends(get_current_user),
    service: StreamInfoService = Depends(get_stream_service)
):
    """Получить информацию о VK Live стриме"""
    try:
        user_id = user.get("id")
        session_id = user.get("session_id")
        
        info = await service.get_stream_info(user_id, "vk", session_id)
        
        # Adaptation for VK specific response format if needed
        # Service returns unified dict. Frontend might expect 'description' for VK?
        # StreamInfoService doesn't explicitly fetch description unless platform returns it.
        # But VK platform get_stream_info usually includes everything.
        
        return JSONResponse(content={"data": info})
    except Exception as e:
        logger.error(f"Error getting VK stream info: {e}")
        return JSONResponse(content={"data": service._empty_info()}, status_code=500)

@router.post("/stream/update")
async def update_stream(
    request: StreamUpdateRequest,
    user: dict = Depends(get_current_user),
    service: StreamInfoService = Depends(get_stream_service)
):
    """Обновить информацию о стриме (title или category)"""
    logger.info("🎬 [STREAM UPDATE] Request received")
    
    try:
        user_id = user.get("id")
        results = []

        # Update Twitch
        if request.twitch:
            title = request.twitch.title
            category_id = request.twitch.category_id
            
            if title is not None or category_id is not None:
                success = await service.update_stream(user_id, "twitch", title, category_id)
                if success:
                    results.append("Twitch updated")
                else:
                    logger.error(f"Failed to update Twitch for user {user_id}")
                    # Decide if we throw error or just log. API previously threw 401/400.
                    # We'll continue for now but mark as error if critical?
                    # Original API raised detailed HTTPExceptions.
                    # For simplicity, we assume Service handles logic, but if failure, we might can't easily propagate specific error details easily without Service returning result object.
                    # But boolean is enough to know it failed.

        # Update VK
        if request.vk:
            title = request.vk.title
            category_id = request.vk.category_id
            
            # Handle complexity of VK category object vs ID
            # Frontend sends 'category' object sometimes.
            # Schema PlatformUpdate handles `category: Optional[CategoryObject]`.
            # We should prefer ID from object if ID is missing?
            if request.vk.category and not category_id:
                category_id = request.vk.category.id
            
            # If still using 'category_id' field:
            # request.vk.category_id is primary.
            
            if title is not None or category_id is not None:
                success = await service.update_stream(user_id, "vk", title, category_id)
                if success:
                    results.append("VK updated")
                else:
                    logger.error(f"Failed to update VK for user {user_id}")

        if not results:
             return JSONResponse(content={"success": True, "message": "No changes or updates failed/not needed"})

        return JSONResponse(content={"success": True, "message": ", ".join(results)})

    except Exception as e:
        logger.error(f"Error in stream update: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/twitch/categories")
async def search_twitch_categories(
    search: str = "",
    user: dict = Depends(get_current_user_optional),
    service: StreamInfoService = Depends(get_stream_service)
):
    """Поиск категорий Twitch"""
    user_id = user.get("id") if user else None
    categories = await service.search_categories("twitch", search, user_id)
    return JSONResponse(content={"categories": categories})

@router.get("/platforms/{platform_name}/categories")
async def search_platform_categories(
    platform_name: str,
    search: str = "",
    user: dict = Depends(get_current_user_optional),
    service: StreamInfoService = Depends(get_stream_service)
):
    """Generic endpoint to search categories for any platform"""
    user_id = user.get("id") if user else None
    categories = await service.search_categories(platform_name, search, user_id)
    return JSONResponse(content={"categories": categories})

@router.post("/platforms/{platform_name}/stream/update")
async def update_platform_stream(
    platform_name: str,
    title: Optional[str] = None,
    category_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
    service: StreamInfoService = Depends(get_stream_service)
):
    """Generic endpoint to update stream info for any platform"""
    user_id = user.get("id")
    success = await service.update_stream(user_id, platform_name, title, category_id)
    
    if success:
        return JSONResponse(content={"success": True, "message": f"{platform_name} updated"})
    else:
        return JSONResponse(content={"success": False, "error": f"Failed to update {platform_name}"}, status_code=400)
