# bot_service/features/youtube/youtube_api.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
import time

# Импорты моделей и сервисов
from core.database import get_db
from .queue_service import QueueService
from .youtube_service import YouTubeService
from utils.enhanced_logger import log_request, log_response, api_logger
from core.connection_manager import get_connection_manager

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

# Импортируем правильную аутентификацию
from auth.auth import get_current_user, get_current_user_optional

# Вспомогательная функция для отправки WebSocket уведомлений
async def notify_queue_update(user_id: int = None, session_id: str = None, db: Session = None):
    """Отправляет WebSocket уведомление об обновлении очереди"""
    try:
        connection_manager = get_connection_manager()
        queue_items = queue_service.get_queue(user_id=user_id, session_id=session_id, db=db)
        
        # Определяем получателя уведомления
        target_id = str(user_id) if user_id else session_id
        
        await connection_manager.send_to_user(
            target_id,
            {
                "type": "youtube_queue_update",
                "queue": queue_items,
                "timestamp": time.time()
            }
        )
        logger.debug(f"📺 Sent youtube_queue_update to {target_id}")
    except Exception as e:
        logger.error(f"Error sending youtube_queue_update: {e}")

@youtube_router.post("/queue/add")
async def add_video_to_queue(
    request: AddVideoRequest,
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Добавление видео в очередь"""
    is_guest = (not user or user.get('id') == -1)
    user_id = user.get('id') if user and user.get('id') != -1 else None
    session_id = user.get('session_id') if is_guest and user else None
    
    log_request("/youtube/queue/add", "POST", {"video_url": request.video_url}, user_id or session_id)
    start_time = time.time()
    try:
        # Временно используем заглушки для requester info
        # В реальной системе это будет из сессии/чата
        result = await queue_service.add_video_to_queue(
            user_id=user_id,
            session_id=session_id,
            video_url=request.video_url,
            channel_name="web_interface",  # Добавлено через веб-интерфейс
            platform="web",
            requester_name=f"User_{user_id}" if user_id else f"Guest_{session_id}",
            requester_id=str(user_id) if user_id else session_id,
            is_paid=request.is_paid,
            points_cost=request.points_cost,
            db=db
        )
        
        if result["success"]:
            # Отправляем WebSocket уведомление об обновлении очереди
            await notify_queue_update(user_id=user_id, session_id=session_id, db=db)
            
            response = {
                "success": True,
                "message": "Видео добавлено в очередь",
                "queue_item": result["queue_item"]
            }
            log_response("/youtube/queue/add", 200, response, time.time() - start_time)
            return response
        else:
            log_response("/youtube/queue/add", 400, {"error": result["error"]}, time.time() - start_time)
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error adding video to queue via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления видео")

@youtube_router.get("/queue")
async def get_queue(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получение очереди видео с текущим воспроизводящимся видео"""
    try:
        is_guest = (not user or user.get('id') == -1)
        user_id = user.get('id') if user and user.get('id') != -1 else None
        session_id = user.get('session_id') if is_guest and user else None
        
        queue_items = queue_service.get_queue(user_id=user_id, session_id=session_id, db=db)
        
        # Текущее видео - первое в очереди (все уже отфильтрованы по status='pending')
        current_video = queue_items[0] if queue_items and len(queue_items) > 0 else None
        
        logger.debug(f"📺 [Queue] User {user_id or session_id}: {len(queue_items)} videos, current: {current_video['title'] if current_video else 'None'}")
        
        return {
            "queue": queue_items,
            "current_video": current_video,
            "is_playing": current_video is not None
        }
        
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

@youtube_router.post("/player/next")
async def skip_to_next_video(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Пропустить текущее видео и перейти к следующему"""
    try:
        # Получаем текущую очередь
        queue_items = queue_service.get_queue(user_id=user["id"], db=db)
        
        if not queue_items or len(queue_items) == 0:
            return {
                "success": False,
                "message": "Очередь пуста",
                "current_video": None
            }
        
        # Первое видео в очереди - это текущее, отмечаем его как проигранное
        current_video_id = queue_items[0]['id']
        success = queue_service.mark_as_played(user["id"], current_video_id, db)
        
        if not success:
            raise HTTPException(status_code=404, detail="Не удалось отметить видео как проигранное")
        
        # Получаем следующее видео (теперь оно первое в очереди)
        updated_queue = queue_service.get_queue(user_id=user["id"], db=db)
        current_video = updated_queue[0] if updated_queue and len(updated_queue) > 0 else None
        
        # Отправляем WebSocket уведомление об обновлении очереди
        await notify_queue_update(user_id=user["id"], db=db)
        
        return {
            "success": True,
            "message": "Переход к следующему видео",
            "current_video": current_video
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error skipping to next video via API: {e}")
        raise HTTPException(status_code=500, detail="Ошибка перехода к следующему видео")

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
            # Отправляем WebSocket уведомление об обновлении очереди
            await notify_queue_update(user["id"], db)
            
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
@youtube_router.post("/clear")  # Alias для совместимости с frontend
async def clear_queue(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистка всей очереди"""
    try:
        cleared_count = queue_service.clear_queue(user["id"], db)
        
        # Отправляем WebSocket уведомление об обновлении очереди
        await notify_queue_update(user["id"], db)
        
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
            # Отправляем WebSocket уведомление об обновлении очереди
            await notify_queue_update(user["id"], db)
            
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
async def search_youtube_videos(
    query: str = None,
    platform: str = "youtube",
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Поиск YouTube видео по названию или популярным видео"""
    log_request("/youtube/search", "GET", {"query": query}, user.get('id'))
    start_time = time.time()
    
    try:
        if not query or len(query.strip()) < 2:
            # Возвращаем список популярных видео если нет поиска
            response = {
                "success": True,
                "results": [
                    {
                        "video_id": "dQw4w9WgXcQ",
                        "title": "Rick Astley - Never Gonna Give You Up (Video)",
                        "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                        "channel": "Rick Astley Official",
                        "duration": "3:33",
                        "views": "1.2B"
                    },
                    {
                        "video_id": "jNQXAC9IVRw",
                        "title": "Me at the zoo",
                        "thumbnail": "https://img.youtube.com/vi/jNQXAC9IVRw/mqdefault.jpg",
                        "channel": "jawed",
                        "duration": "0:18",
                        "views": "300M"
                    }
                ],
                "count": 2
            }
            log_response("/youtube/search", 200, response, time.time() - start_time)
            return response
        
        # Используем yt-dlp для поиска (без скачивания)
        import yt_dlp
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'default_search': 'ytsearch5',  # Ищем 5 результатов
            'extract_flat': True,
            'skip_download': True,
        }
        
        search_results = []
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(query, download=False)
                
                if 'entries' in info:
                    for entry in info['entries'][:5]:
                        if entry.get('id'):
                            search_results.append({
                                "video_id": entry.get('id'),
                                "title": entry.get('title', 'Unknown'),
                                "thumbnail": entry.get('thumbnail', f"https://img.youtube.com/vi/{entry.get('id')}/mqdefault.jpg"),
                                "channel": entry.get('uploader', 'Unknown'),
                                "duration": entry.get('duration', 'Unknown'),
                                "url": f"https://www.youtube.com/watch?v={entry.get('id')}"
                            })
        except Exception as yt_error:
            logger.warning(f"yt-dlp search failed: {yt_error}, using fallback")
            # Fallback: возвращаем пустой результат
            search_results = []
        
        response = {
            "success": True,
            "results": search_results,
            "count": len(search_results),
            "query": query
        }
        
        log_response("/youtube/search", 200, response, time.time() - start_time)
        return response
        
    except Exception as e:
        logger.error(f"Error searching YouTube: {e}")
        log_response("/youtube/search", 500, {"error": str(e)}, time.time() - start_time)
        raise HTTPException(status_code=500, detail="Ошибка поиска видео YouTube")
