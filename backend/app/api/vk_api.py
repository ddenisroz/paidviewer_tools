# backend/app/api/vk_api.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_state_service
from app.services.state_service import StateService
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class UpdateTitleRequest(BaseModel):
    title: str
    description: str

class UpdateCategoryRequest(BaseModel):
    category_id: str

@router.get("/stream-info")
async def get_stream_info(state_service: StateService = Depends(get_state_service)):
    """Получить информацию о текущем стриме на VK Live"""
    try:
        # Здесь будет реальный API вызов к VK Live API
        # Пока возвращаем моковые данные
        return {
            "title": "VK Live: Играем вместе!",
            "description": "Присоединяйтесь к стриму на VK Live",
            "category_id": "1",
            "category_name": "Игры",
            "is_live": True
        }
    except Exception as e:
        logger.error(f"Error getting VK stream info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stream info")

@router.get("/viewers")
async def get_viewer_count(state_service: StateService = Depends(get_state_service)):
    """Получить количество зрителей на VK Live"""
    try:
        # Проверяем, есть ли токен доступа в состоянии
        channel_data = state_service.get_channel_data("yourchy")
        vk_token = channel_data.get("integrations", {}).get("vk_token")
        
        if not vk_token:
            return 0
        
        # Здесь будет реальный API вызов к VK Live API
        # Пока возвращаем 0 если не подключен
        return 0
    except Exception as e:
        logger.error(f"Error getting VK viewers: {e}")
        return 0

@router.post("/update-title")
async def update_stream_title(
    request: UpdateTitleRequest,
    state_service: StateService = Depends(get_state_service)
):
    """Обновить название и описание стрима на VK Live"""
    try:
        # Здесь будет реальный API вызов к VK Live API
        logger.info(f"Updating VK title: {request.title}")
        
        # Сохраняем в состояние для отображения
        channel_data = state_service.get_channel_data("yourchy")
        channel_data.setdefault("stream_info", {})["vk_title"] = request.title
        channel_data.setdefault("stream_info", {})["vk_description"] = request.description
        state_service.set_channel_data("yourchy", channel_data)
        
        return {"success": True, "message": f"Название обновлено: {request.title}"}
    except Exception as e:
        logger.error(f"Error updating VK title: {e}")
        return {"success": False, "message": f"Ошибка обновления: {str(e)}"}

@router.get("/categories")
async def get_categories(state_service: StateService = Depends(get_state_service)):
    """Получить список категорий VK Live"""
    try:
        # Здесь будет реальный API вызов к VK Live API
        # Пока возвращаем моковые данные
        categories = [
            {"id": "1", "name": "Игры", "viewers": 15000},
            {"id": "2", "name": "Общение", "viewers": 12000},
            {"id": "3", "name": "Музыка", "viewers": 8000},
            {"id": "4", "name": "Спорт", "viewers": 6000},
            {"id": "5", "name": "Образование", "viewers": 4000},
        ]
        return categories
    except Exception as e:
        logger.error(f"Error getting VK categories: {e}")
        return []

@router.post("/update-category")
async def update_category(
    request: UpdateCategoryRequest,
    state_service: StateService = Depends(get_state_service)
):
    """Обновить категорию стрима на VK Live"""
    try:
        # Находим название категории по ID
        categories = [
            {"id": "1", "name": "Игры", "viewers": 50000},
            {"id": "2", "name": "Музыка", "viewers": 25000},
            {"id": "3", "name": "Спорт", "viewers": 15000},
            {"id": "4", "name": "Образование", "viewers": 10000},
            {"id": "5", "name": "Развлечения", "viewers": 30000},
        ]
        
        category = next((cat for cat in categories if cat["id"] == request.category_id), None)
        if not category:
            return {"success": False, "message": "Категория не найдена"}
        
        # Здесь будет реальный API вызов к VK Live API
        logger.info(f"Updating VK category: {request.category_id}")
        
        # Сохраняем в состояние для отображения
        channel_data = state_service.get_channel_data("yourchy")
        channel_data.setdefault("stream_info", {})["vk_category_id"] = request.category_id
        channel_data.setdefault("stream_info", {})["vk_category_name"] = category["name"]
        state_service.set_channel_data("yourchy", channel_data)
        
        return {"success": True, "message": f"Категория изменена на {category['name']}"}
    except Exception as e:
        logger.error(f"Error updating VK category: {e}")
        return {"success": False, "message": f"Ошибка обновления: {str(e)}"}
