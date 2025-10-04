# bot_service/api/youtube_api_endpoints.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

# Импорты моделей и сервисов
from core.database import get_db
from services.queue_service import QueueService
from services.youtube_service import YouTubeService

# Получим функции аутентификации из main.py
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

logger = logging.getLogger('bot_service')

# Создаем роутер для YouTube API
youtube_router = APIRouter(prefix="/api/youtube", tags=["youtube"])

# Pydantic модели для API
class AddVideoRequest(BaseModel):
    video_url: str
    is_paid: Optional[bool] = False
    points_cost: Optional[int] = None

class QueueResponse(BaseModel):
    id: int
    video_id: str
    title: str
    duration: Optional[str]
    thumbnail_url: Optional[str]
    url: str
    channel_name: str
    platform: str
    requester_name: str
    position: int
    is_paid: bool
    points_cost: Optional[int]
    added_at: Optional[str]

class QueueManagementRequest(BaseModel):
    queue_id: int

# Инициализируем сервисы
queue_service = QueueService()
youtube_service = YouTubeService()

def get_current_user(request: Request):
    """Получение текущего пользователя (заглушка)"""
    # TODO: Реализовать получение пользователя из сессии
    return {"id": 1, "is_admin": True, "display_name": "TestUser"}

@youtube_router.post("/queue/add")
async def add_video_to_queue(
    request: AddVideoRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавление видео в очередь"""
    try:
        # Временно используем заглушки для requester info
        # В реальной системе это будет из сессии/чата
        result = await queue_service.add_video_to_queue(
            user_id=user["id"],
            video_url=request.video_url,
            channel_name="web_interface",  # Добавлено через веб-интерфейс
            platform="web",
            requester_name=user["display_name"],
            requester_id=str(user["id"]),
            is_paid=request.is_paid,
            points_cost=request.points_cost,
            db=db
        )
        
        if result["success"]:
            return {
                "success": True,
                "message": "Видео добавлено в очередь",
                "queue_item": result["queue_item"]
            }
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error adding video to queue via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления видео")

@youtube_router.get("/queue", response_model=List[QueueResponse])
async def get_queue(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение очереди видео"""
    try:
        queue_items = queue_service.get_queue(user["id"], db)
        return queue_items
        
    except Exception as e:
        logger.error(f"Error getting queue via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения очереди")

@youtube_router.get("/queue/next")
async def get_next_video(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение следующего видео в очереди"""
    try:
        next_video = queue_service.get_next_video(user["id"], db)
        
        if next_video:
            return {
                "success": True,
                "video": next_video
            }
        else:
            return {
                "success": False,
                "message": "Очередь пуста"
            }
            
    except Exception as e:
        logger.error(f"Error getting next video via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения следующего видео")

@youtube_router.delete("/queue/remove/{queue_id}")
async def remove_from_queue(
    queue_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаление видео из очереди"""
    try:
        success = queue_service.remove_from_queue(user["id"], queue_id, db)
        
        if success:
            return {
                "success": True,
                "message": "Видео удалено из очереди"
            }
        else:
            raise HTTPException(status_code=404, detail="Видео не найдено в очереди")
            
    except Exception as e:
        logger.error(f"Error removing video from queue via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления видео")

@youtube_router.delete("/queue/clear")
async def clear_queue(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистка всей очереди"""
    try:
        cleared_count = queue_service.clear_queue(user["id"], db)
        
        return {
            "success": True,
            "message": f"Очередь очищена ({cleared_count} видео удалено)"
        }
        
    except Exception as e:
        logger.error(f"Error clearing queue via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка очистки очереди")

@youtube_router.post("/queue/mark-played/{queue_id}")
async def mark_as_played(
    queue_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Отметить видео как проигранное"""
    try:
        success = queue_service.mark_as_played(user["id"], queue_id, db)
        
        if success:
            return {
                "success": True,
                "message": "Видео отмечено как проигранное"
            }
        else:
            raise HTTPException(status_code=404, detail="Видео не найдено в очереди")
            
    except Exception as e:
        logger.error(f"Error marking video as played via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления статуса видео")

@youtube_router.get("/video-info")
async def get_video_info(video_url: str):
    """Получение информации о YouTube видео"""
    try:
        if not youtube_service.is_valid_youtube_url(video_url):
            raise HTTPException(status_code=400, detail="Неверный YouTube URL")
        
        video_info = await youtube_service.get_video_info(video_url)
        
        if video_info:
            return {
                "success": True,
                "video_info": video_info
            }
        else:
            raise HTTPException(status_code=404, detail="Не удалось получить информацию о видео")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting video info via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения информации о видео")

@youtube_router.get("/search")
async def search_videos(query: str, max_results: int = 5):
    """Поиск YouTube видео"""
    try:
        if not query.strip():
            raise HTTPException(status_code=400, detail="Поисковый запрос не может быть пустым")
        
        results = await youtube_service.search_videos(query, max_results)
        
        return {
            "success": True,
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching videos via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка поиска видео")
