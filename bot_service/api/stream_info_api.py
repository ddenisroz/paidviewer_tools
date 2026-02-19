from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional

from auth.auth import get_current_user, get_current_user_optional
from core.database import get_db

# Schemas
from schemas.stream import PlatformUpdate, StreamUpdateRequest

# Services
from services.stream_info_service import StreamInfoService
from utils.websocket_broadcast import broadcast_stream_info_change
from utils.stream_info_cache import get_cached_stream_info, set_cached_stream_info

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["stream-info"])


def _sanitize_category_id(raw_value: Optional[str]) -> Optional[str]:
    """Normalize category identifiers from mixed payloads."""
    if raw_value is None:
        return None

    normalized = str(raw_value).strip()
    if not normalized:
        return None
    if normalized.lower() in {"none", "null", "undefined"}:
        return None
    return normalized


def _extract_category_id(update: Optional[PlatformUpdate]) -> Optional[str]:
    """Read category id from `category_id` or nested `category.id`."""
    if not update:
        return None

    direct_id = _sanitize_category_id(update.category_id)
    if direct_id:
        return direct_id

    category_obj = update.category
    if category_obj and category_obj.id:
        return _sanitize_category_id(category_obj.id)

    return None

# Simple in-memory cache for stream info (60 second TTL)

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
        cached = get_cached_stream_info(user_id, "twitch")
        if cached:
            return JSONResponse(content={"data": cached})
        
        info = await service.get_stream_info(user_id, "twitch", session_id)
        
        # Cache result
        set_cached_stream_info(user_id, "twitch", info)
        
        return JSONResponse(content={"data": info})
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting Twitch stream info")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/vk/stream-info")
async def get_vk_stream_info(
    user: dict = Depends(get_current_user),
    service: StreamInfoService = Depends(get_stream_service)
):
    """???????? ?????????? ? VK Live ??????"""
    try:
        user_id = user.get("id")
        session_id = user.get("session_id")

        cached = get_cached_stream_info(user_id, "vk")
        if cached:
            return JSONResponse(content={"data": cached})

        info = await service.get_stream_info(user_id, "vk", session_id)
        set_cached_stream_info(user_id, "vk", info)

        # Adaptation for VK specific response format if needed
        # Service returns unified dict. Frontend might expect 'description' for VK?
        # StreamInfoService doesn't explicitly fetch description unless platform returns it.
        # But VK platform get_stream_info usually includes everything.

        return JSONResponse(content={"data": info})
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting VK stream info")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/stream/update")
async def update_stream(
    request: StreamUpdateRequest,
    user: dict = Depends(get_current_user),
    service: StreamInfoService = Depends(get_stream_service)
):
    """Обновить информацию о стриме (title или category)"""
    """Обновить информацию о стриме (title или category)"""
    logger.info("[STREAM UPDATE] Request received")
    
    try:
        user_id = user.get("id")
        session_id = user.get("session_id")
        results = []
        failures = []

        async def _broadcast_stream_info(platform_name: str) -> None:
            try:
                info = await service.get_stream_info(user_id, platform_name, session_id)
                set_cached_stream_info(user_id, platform_name, info)
                await broadcast_stream_info_change(user_id, platform_name, info)
            except Exception:
                logger.exception("[STREAM_INFO] Broadcast failed for %s", platform_name)

        # Update Twitch
        if request.twitch:
            title = request.twitch.title
            category_id = _extract_category_id(request.twitch)

            if title is not None or category_id is not None:
                success = await service.update_stream(user_id, "twitch", title, category_id)
                if success:
                    results.append("Twitch updated")
                    await _broadcast_stream_info("twitch")
                else:
                    failures.append("Twitch")
                    logger.error("Failed to update Twitch for user %s", user_id)

        # Update VK
        if request.vk:
            title = request.vk.title
            category_id = _extract_category_id(request.vk)

            if title is not None or category_id is not None:
                success = await service.update_stream(user_id, "vk", title, category_id)
                if success:
                    results.append("VK updated")
                    await _broadcast_stream_info("vk")
                else:
                    failures.append("VK")
                    logger.error("Failed to update VK for user %s", user_id)

        if not results and not failures:
            return JSONResponse(content={"success": True, "message": "No changes or updates needed"})

        if failures:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": (
                        f"Updated: {', '.join(results)}. Failed: {', '.join(failures)}"
                        if results
                        else f"Failed to update: {', '.join(failures)}"
                    ),
                    "updated_platforms": [item.replace(" updated", "").lower() for item in results],
                    "failed_platforms": [item.lower() for item in failures],
                },
            )

        return JSONResponse(
            content={
                "success": True,
                "message": ", ".join(results),
                "updated_platforms": [item.replace(" updated", "").lower() for item in results],
                "failed_platforms": [],
            }
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error in stream update")
        raise HTTPException(status_code=500, detail="Internal server error")

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
    try:
        user_id = user.get("id")
        session_id = user.get("session_id")
        success = await service.update_stream(user_id, platform_name, title, category_id)

        if not success:
            raise HTTPException(status_code=409, detail=f"Failed to update {platform_name}")

        try:
            info = await service.get_stream_info(user_id, platform_name, session_id)
            set_cached_stream_info(user_id, platform_name, info)
            await broadcast_stream_info_change(user_id, platform_name, info)
        except Exception:
            logger.exception("[STREAM_INFO] Broadcast failed for %s", platform_name)
        return JSONResponse(content={"success": True, "message": f"{platform_name} updated"})
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating %s stream info", platform_name)
        raise HTTPException(status_code=500, detail="Internal server error")
