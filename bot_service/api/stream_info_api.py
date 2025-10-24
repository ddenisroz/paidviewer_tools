# bot_service/api/stream_info_api.py
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from auth.auth import get_current_user, get_current_user_optional
from core.session_manager import session_manager
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["stream-info"])

class CategoryObject(BaseModel):
    id: str
    title: Optional[str] = None
    cover_url: Optional[str] = None
    type: Optional[str] = None
    name: Optional[str] = None  # Alias for title (frontend uses 'name')

class PlatformUpdate(BaseModel):
    title: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[CategoryObject] = None  # Full category object for VK

class StreamUpdateRequest(BaseModel):
    twitch: Optional[PlatformUpdate] = None
    vk: Optional[PlatformUpdate] = None

@router.get("/twitch/stream")
async def get_twitch_stream(user: dict = Depends(get_current_user)):
    """Получить информацию о Twitch стриме"""
    try:
        # TODO: Реализовать получение информации о Twitch стриме
        return JSONResponse(content={
            "is_live": False,
            "title": "",
            "category": None,
            "viewers": 0
        })
    except Exception as e:
        logger.error(f"Error getting Twitch stream info: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@router.get("/twitch/stream-info")
async def get_twitch_stream_info(user: dict = Depends(get_current_user)):
    """Получить детальную информацию о Twitch стриме"""
    try:
        user_id = user.get("id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Пользователь с ID 0 - это гость, но у него могут быть токены
        logger.info(f"Getting Twitch stream info for user_id: {user_id}")
        
        from api.twitch_api import TwitchAPI
        from core.connection_manager import get_connection_manager
        connection_manager = get_connection_manager()
        twitch_api = TwitchAPI(connection_manager)
        
        # Получаем информацию о канале пользователя из базы данных
        from core.token_utils import get_user_token_from_db
        tokens = get_user_token_from_db(user_id, "twitch")
        
        if not tokens:
            logger.warning(f"No Twitch tokens found for user {user_id}")
            return JSONResponse(content={
                "is_live": False,
                "title": "",
                "game_id": None,
                "game": None,
                "viewers": 0,
                "started_at": None,
                "language": "ru"
            })
        
        platform_user_id = tokens["platform_user_id"]
        logger.info(f"Twitch token found for user {user_id}, platform_user_id: {platform_user_id}")
        logger.info(f"Getting channel info for platform_user_id: {platform_user_id}")
        
        # Получаем информацию о канале
        channel_info = await twitch_api.get_channel_info_by_id(platform_user_id)
        logger.info(f"Channel info result: {channel_info}")
        
        if not channel_info:
            logger.warning(f"No channel info found for platform_user_id: {platform_user_id}")
            return JSONResponse(content={
                "is_live": False,
                "title": "",
                "game_id": None,
                "game": None,
                "viewers": 0,
                "started_at": None,
                "language": "ru"
            })
        
        # Получаем информацию о стриме
        stream_info = await twitch_api.get_stream_info_by_id(platform_user_id)
        logger.info(f"Stream info result: {stream_info}")
        
        result = {
            "is_live": stream_info is not None,
            "title": channel_info.get("title", ""),
            "game_id": channel_info.get("game_id"),
            "game": channel_info.get("game_name"),
            "viewers": stream_info.get("viewer_count", 0) if stream_info else 0,
            "started_at": stream_info.get("started_at") if stream_info else None,
            "language": channel_info.get("broadcaster_language", "ru")
        }
        
        logger.info(f"Returning Twitch stream info: {result}")
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Error getting Twitch stream info: {e}")
        return JSONResponse(content={
            "is_live": False,
            "title": "",
            "game_id": None,
            "game": None,
            "viewers": 0,
            "started_at": None,
            "language": "ru"
        }, status_code=500)

@router.get("/vk/stream-info")
async def get_vk_stream_info(user: dict = Depends(get_current_user)):
    """Получить информацию о VK Live стриме"""
    try:
        user_id = user.get("id")
        session_id = user.get("session_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Пользователь с ID 0 - это гость, но у него могут быть токены
        logger.info(f"Getting VK stream info for user_id: {user_id}")
        
        from api.vk_api import vk_api
        
        # Получаем информацию о стриме VK (с проверкой безопасности)
        stream_info = await vk_api.get_stream_info(str(user_id), session_id)
        
        return JSONResponse(content={
            "is_live": stream_info.get("online", False),
            "title": stream_info.get("title", ""),
            "category_id": stream_info.get("category_id"),
            "category": stream_info.get("category"),
            "viewers": stream_info.get("viewer_count", 0),
            "started_at": stream_info.get("started_at"),
            "description": stream_info.get("description", "")
        })
    except Exception as e:
        logger.error(f"Error getting VK stream info: {e}")
        return JSONResponse(content={
            "is_live": False,
            "title": "",
            "category_id": None,
            "category": None,
            "viewers": 0,
            "started_at": None,
            "description": ""
        }, status_code=500)

@router.post("/stream/update")
async def update_stream(
    request: StreamUpdateRequest,
    user: dict = Depends(get_current_user)
):
    """Обновить информацию о стриме (title или category)"""
    logger.info(f"🎬 [STREAM UPDATE] ===== START =====")
    logger.info(f"🎬 [STREAM UPDATE] User: {user}")
    logger.info(f"🎬 [STREAM UPDATE] Request raw: {request}")
    
    try:
        user_id = user.get("id")
        session_id = user.get("session_id")
        results = []
        
        logger.info(f"🎬 [STREAM UPDATE] Received request from user {user_id}")
        logger.info(f"🎬 [STREAM UPDATE] Request data: {request.dict()}")
        
        # Детальное логирование VK данных
        if request.vk:
            logger.info(f"🔍 [DEBUG] request.vk exists")
            logger.info(f"🔍 [DEBUG] request.vk dict: {request.vk.dict()}")
            logger.info(f"🔍 [DEBUG] request.vk.category_id: {request.vk.category_id}")
            logger.info(f"🔍 [DEBUG] request.vk.category: {request.vk.category}")
            if request.vk.category:
                logger.info(f"🔍 [DEBUG] request.vk.category dict: {request.vk.category.dict()}")
        
        # Обновляем Twitch если данные переданы
        if request.twitch:
            from api.twitch_api import TwitchAPI
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            twitch_api = TwitchAPI(connection_manager)
            
            if request.twitch.title is not None:
                logger.info(f"🎬 [TWITCH] Updating title to: {request.twitch.title}")
                success = await twitch_api.update_stream_title(user_id, request.twitch.title)
                if not success:
                    logger.error(f"❌ [TWITCH] Title update failed for user {user_id}")
                    raise HTTPException(status_code=401, detail="Twitch token expired. Please re-authenticate.")
                logger.info(f"✅ [TWITCH] Title updated successfully")
                results.append("Twitch title updated")
            
            if request.twitch.category_id:
                logger.info(f"🎬 [TWITCH] Updating category to: {request.twitch.category_id}")
                success = await twitch_api.update_stream_category(user_id, request.twitch.category_id)
                if not success:
                    logger.error(f"❌ [TWITCH] Category update failed for user {user_id}")
                    raise HTTPException(status_code=401, detail="Twitch token expired. Please re-authenticate.")
                logger.info(f"✅ [TWITCH] Category updated successfully")
                results.append("Twitch category updated")
        
        # Обновляем VK если данные переданы
        if request.vk:
            from api.vk_api import vk_api
            logger.info(f"🎬 [VK] request.vk данные: title={request.vk.title}, category_id={request.vk.category_id}")
            
            if request.vk.title is not None:
                logger.info(f"🎬 [VK] Updating title to: {request.vk.title}")
                success = await vk_api.update_stream_title(str(user_id), request.vk.title, session_id)
                if not success:
                    logger.error(f"❌ [VK] Title update failed for user {user_id}")
                    raise HTTPException(status_code=400, detail="Failed to update VK stream title")
                logger.info(f"✅ [VK] Title updated successfully")
                results.append("VK title updated")
            
            if request.vk.category_id or request.vk.category:
                # Детальное логирование для отладки
                logger.info(f"🔍 [VK] request.vk.category_id = {request.vk.category_id}")
                logger.info(f"🔍 [VK] request.vk.category = {request.vk.category}")
                logger.info(f"🔍 [VK] type(request.vk.category) = {type(request.vk.category)}")
                
                # Используем полный объект категории если доступен, иначе только ID
                category_data = None
                if request.vk.category:
                    # Фронтенд отправил полный объект - используем его
                    category_data = {
                        "id": request.vk.category.id,
                        "title": request.vk.category.title or request.vk.category.name or "",
                        "cover_url": request.vk.category.cover_url or "",
                        "type": request.vk.category.type or "games"
                    }
                    logger.info(f"🎬 [VK] Updating category with full object: {category_data}")
                else:
                    # Только ID - используем старый метод (может не работать!)
                    category_data = request.vk.category_id
                    logger.warning(f"🎬 [VK] Updating category with ID only (may fail): {category_data}")
                
                success = await vk_api.update_stream_category(str(user_id), category_data, session_id)
                if not success:
                    logger.error(f"❌ [VK] Category update failed for user {user_id}")
                    raise HTTPException(status_code=400, detail="Failed to update VK stream category")
                logger.info(f"✅ [VK] Category updated successfully")
                results.append("VK category updated")
        
        if not results:
            logger.warning(f"⚠️ [STREAM UPDATE] No changes to update for user {user_id}")
            return JSONResponse(content={"success": True, "message": "No changes to update"})
        
        logger.info(f"✅ [STREAM UPDATE] Completed for user {user_id}: {', '.join(results)}")
        return JSONResponse(content={"success": True, "message": ", ".join(results)})
            
    except HTTPException as he:
        logger.error(f"❌ [STREAM UPDATE] HTTPException: {he.status_code} - {he.detail}")
        return JSONResponse(content={"success": False, "error": he.detail}, status_code=he.status_code)
    except Exception as e:
        logger.error(f"❌ [STREAM UPDATE] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"❌ [STREAM UPDATE] Traceback: {traceback.format_exc()}")
        return JSONResponse(content={"success": False, "error": f"Internal server error: {str(e)}"}, status_code=500)

@router.get("/twitch/categories")
async def search_twitch_categories(
    search: str = "",
    user: dict = Depends(get_current_user_optional)
):
    """Поиск категорий Twitch"""
    try:
        from api.twitch_api import TwitchAPI
        from core.connection_manager import get_connection_manager
        connection_manager = get_connection_manager()
        twitch_api = TwitchAPI(connection_manager)
        
        categories = await twitch_api.search_categories(search)
        
        if categories is None:
            return JSONResponse(content={"categories": []})
        
        return JSONResponse(content={"categories": categories})
        
    except Exception as e:
        logger.error(f"Error searching Twitch categories: {e}")
        return JSONResponse(content={"categories": []}, status_code=500)

# УДАЛЕНО: Дублирует endpoint из vk_api.py
# Теперь используется /api/vk/categories из vk_api.py с полным логированием
