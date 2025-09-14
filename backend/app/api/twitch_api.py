# backend/app/api/twitch_api.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_state_service
from app.services.state_service import StateService
from app.core.config import settings
from app.core.security import decrypt_token
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class UpdateTitleRequest(BaseModel):
    title: str

class UpdateCategoryRequest(BaseModel):
    category_id: str

@router.get("/debug-state")
async def debug_state(state_service: StateService = Depends(get_state_service)):
    """Отладочный endpoint для проверки состояния"""
    channel_name = "yourchy"
    channel_data = state_service.get_channel_data(channel_name)
    return {
        "channel_name": channel_name,
        "channel_data": channel_data,
        "has_twitch_token": bool(channel_data.get("integrations", {}).get("twitch_token")),
        "has_twitch_user_id": bool(channel_data.get("integrations", {}).get("twitch_user_id")),
        "twitch_enabled": channel_data.get("integrations", {}).get("twitch_enabled", False)
    }

@router.post("/fix-auth")
async def fix_auth(state_service: StateService = Depends(get_state_service)):
    """Принудительно исправить авторизацию для тестирования"""
    channel_name = "yourchy"
    await state_service.register_channel(channel_name)
    
    # Устанавливаем тестовые данные
    channel_data = state_service.get_channel_data(channel_name)
    channel_data.setdefault("integrations", {})["twitch_token"] = "test_token_123"
    channel_data.setdefault("integrations", {})["twitch_user_id"] = "123456789"
    channel_data.setdefault("integrations", {})["twitch_enabled"] = True
    state_service.set_channel_data(channel_name, channel_data)
    
    return {"message": "Auth fixed for testing", "channel_data": channel_data}

@router.get("/stream-info")
async def get_stream_info(state_service: StateService = Depends(get_state_service)):
    """Получить информацию о текущем стриме на Twitch"""
    try:
        # Получаем имя канала из JWT токена или используем "yourchy" как fallback
        # В реальном приложении это должно приходить из контекста пользователя
        channel_name = "yourchy"  # TODO: получать из контекста пользователя
        channel_data = state_service.get_channel_data(channel_name)
        encrypted_token = channel_data.get("integrations", {}).get("twitch_token")
        broadcaster_id = channel_data.get("integrations", {}).get("twitch_user_id")
        
        if not encrypted_token or not broadcaster_id:
            return {
                "title": "Подключите Twitch для просмотра информации",
                "description": "",
                "category_id": "",
                "category_name": "",
                "is_live": False
            }
        
        # Расшифровываем токен
        twitch_token = decrypt_token(encrypted_token)
        
        headers = {
            "Authorization": f"Bearer {twitch_token}",
            "Client-Id": settings.TWITCH_CLIENT_ID
        }
        
        async with httpx.AsyncClient() as client:
            # Получаем информацию о канале
            response = await client.get(
                f"https://api.twitch.tv/helix/channels?broadcaster_id={broadcaster_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("data"):
                    channel = data["data"][0]
                    return {
                        "title": channel.get("title", ""),
                        "description": channel.get("title", ""),  # Twitch не возвращает отдельное описание
                        "category_id": channel.get("game_id", ""),
                        "category_name": channel.get("game_name", ""),
                        "is_live": True
                    }
            
            # Fallback если API не работает
            return {
                "title": "Ошибка получения данных",
                "description": "",
                "category_id": "",
                "category_name": "",
                "is_live": False
            }
            
    except Exception as e:
        logger.error(f"Error getting Twitch stream info: {e}")
        return {
            "title": "Ошибка подключения",
            "description": "",
            "category_id": "",
            "category_name": "",
            "is_live": False
        }

@router.get("/viewers")
async def get_viewer_count(state_service: StateService = Depends(get_state_service)):
    """Получить количество зрителей на Twitch"""
    try:
        # Получаем имя канала из JWT токена или используем "yourchy" как fallback
        # В реальном приложении это должно приходить из контекста пользователя
        channel_name = "yourchy"  # TODO: получать из контекста пользователя
        channel_data = state_service.get_channel_data(channel_name)
        encrypted_token = channel_data.get("integrations", {}).get("twitch_token")
        broadcaster_id = channel_data.get("integrations", {}).get("twitch_user_id")
        
        if not encrypted_token or not broadcaster_id:
            return 0
        
        # Расшифровываем токен
        twitch_token = decrypt_token(encrypted_token)
        
        headers = {
            "Authorization": f"Bearer {twitch_token}",
            "Client-Id": settings.TWITCH_CLIENT_ID
        }
        
        async with httpx.AsyncClient() as client:
            # Получаем информацию о стриме
            response = await client.get(
                f"https://api.twitch.tv/helix/streams?user_id={broadcaster_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("data"):
                    stream = data["data"][0]
                    return stream.get("viewer_count", 0)
            
            return 0
    except Exception as e:
        logger.error(f"Error getting Twitch viewers: {e}")
        return 0

@router.post("/update-title")
async def update_stream_title(
    request: UpdateTitleRequest,
    state_service: StateService = Depends(get_state_service)
):
    """Обновить название и описание стрима на Twitch"""
    try:
        # Получаем токен доступа из состояния
        # Получаем имя канала из JWT токена или используем "yourchy" как fallback
        # В реальном приложении это должно приходить из контекста пользователя
        channel_name = "yourchy"  # TODO: получать из контекста пользователя
        channel_data = state_service.get_channel_data(channel_name)
        encrypted_token = channel_data.get("integrations", {}).get("twitch_token")
        broadcaster_id = channel_data.get("integrations", {}).get("twitch_user_id")
        
        if not encrypted_token or not broadcaster_id:
            return {"success": False, "message": "Twitch не подключен. Необходима авторизация."}
        
        # Валидация названия
        if not request.title or not request.title.strip():
            return {"success": False, "message": "Название не может быть пустым"}
        
        if len(request.title) > 140:
            return {"success": False, "message": "Название слишком длинное (максимум 140 символов)"}
        
        # Расшифровываем токен
        twitch_token = decrypt_token(encrypted_token)
        
        # Реальный API вызов к Twitch API
        headers = {
            "Authorization": f"Bearer {twitch_token}",
            "Client-Id": settings.TWITCH_CLIENT_ID,
            "Content-Type": "application/json"
        }
        
        data = {
            "title": request.title.strip(),
            "broadcaster_language": "ru"  # Язык стрима
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"https://api.twitch.tv/helix/channels?broadcaster_id={broadcaster_id}",
                headers=headers,
                json=data
            )
            
            if response.status_code == 204:
                # Twitch API возвращает 204 No Content при успешном обновлении
                # Сохраняем в состояние для отображения
                channel_data.setdefault("stream_info", {})["title"] = request.title
                state_service.set_channel_data("yourchy", channel_data)
                
                return {"success": True, "message": f"Название обновлено: {request.title}"}
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("message", f"HTTP {response.status_code}")
                logger.error(f"Twitch API error: {response.status_code} - {error_msg}")
                return {"success": False, "message": f"Ошибка Twitch API: {error_msg}"}
                
    except Exception as e:
        logger.error(f"Error updating Twitch title: {e}")
        return {"success": False, "message": f"Ошибка обновления: {str(e)}"}

@router.get("/categories")
async def get_categories(search: str = "", state_service: StateService = Depends(get_state_service)):
    """Получить список категорий Twitch"""
    try:
        # Получаем имя канала из JWT токена или используем "yourchy" как fallback
        # В реальном приложении это должно приходить из контекста пользователя
        channel_name = "yourchy"  # TODO: получать из контекста пользователя
        channel_data = state_service.get_channel_data(channel_name)
        encrypted_token = channel_data.get("integrations", {}).get("twitch_token")
        
        if not encrypted_token:
            return []
        
        # Расшифровываем токен
        twitch_token = decrypt_token(encrypted_token)
        
        headers = {
            "Authorization": f"Bearer {twitch_token}",
            "Client-Id": settings.TWITCH_CLIENT_ID
        }
        
        async with httpx.AsyncClient() as client:
            if search:
                # Поиск по названию игры с автодополнением
                response = await client.get(
                    f"https://api.twitch.tv/helix/search/categories?query={search}&first=10",
                    headers=headers
                )
            else:
                # Получаем топ игры
                response = await client.get(
                    f"https://api.twitch.tv/helix/games/top?first=20",
                    headers=headers
                )
            
            if response.status_code == 200:
                data = response.json()
                categories = []
                for game in data.get("data", []):
                    categories.append({
                        "id": game.get("id", ""),
                        "name": game.get("name", ""),
                        "viewers": 0  # Twitch не возвращает количество зрителей в этом API
                    })
                
                if search:
                    categories = [cat for cat in categories if search.lower() in cat["name"].lower()]
                
                return categories
            else:
                # Fallback на моковые данные
                return [
                    {"id": "509658", "name": "Just Chatting", "viewers": 0},
                    {"id": "509670", "name": "Minecraft", "viewers": 0},
                    {"id": "509660", "name": "Fortnite", "viewers": 0},
                    {"id": "509661", "name": "Call of Duty: Warzone", "viewers": 0},
                    {"id": "509662", "name": "Valorant", "viewers": 0},
                ]
                
    except Exception as e:
        logger.error(f"Error getting Twitch categories: {e}")
        return []

@router.post("/update-category")
async def update_category(
    request: UpdateCategoryRequest,
    state_service: StateService = Depends(get_state_service)
):
    """Обновить категорию стрима на Twitch"""
    try:
        # Получаем токен доступа из состояния
        # Получаем имя канала из JWT токена или используем "yourchy" как fallback
        # В реальном приложении это должно приходить из контекста пользователя
        channel_name = "yourchy"  # TODO: получать из контекста пользователя
        channel_data = state_service.get_channel_data(channel_name)
        encrypted_token = channel_data.get("integrations", {}).get("twitch_token")
        broadcaster_id = channel_data.get("integrations", {}).get("twitch_user_id")
        
        if not encrypted_token or not broadcaster_id:
            return {"success": False, "message": "Twitch не подключен. Необходима авторизация."}
        
        # Расшифровываем токен
        twitch_token = decrypt_token(encrypted_token)
        
        # Реальный API вызов к Twitch API
        headers = {
            "Authorization": f"Bearer {twitch_token}",
            "Client-Id": settings.TWITCH_CLIENT_ID,
            "Content-Type": "application/json"
        }
        
        # Twitch API ожидает game_id в query параметрах
        params = {
            "broadcaster_id": broadcaster_id,
            "game_id": request.category_id
        }
        
        # Тело запроса должно быть пустым для PATCH /helix/channels
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                "https://api.twitch.tv/helix/channels",
                headers=headers,
                params=params,
                json={}  # Пустое тело запроса
            )
            
            if response.status_code == 204:
                # Twitch API возвращает 204 No Content при успешном обновлении
                # Получаем название категории из API
                try:
                    game_response = await client.get(
                        f"https://api.twitch.tv/helix/games?id={request.category_id}",
                        headers=headers
                    )
                    if game_response.status_code == 200:
                        game_data = game_response.json()
                        if game_data.get("data"):
                            category_name = game_data["data"][0]["name"]
                        else:
                            category_name = f"ID: {request.category_id}"
                    else:
                        category_name = f"ID: {request.category_id}"
                except:
                    category_name = f"ID: {request.category_id}"
                
                # Сохраняем в состояние для отображения
                channel_data.setdefault("stream_info", {})["category_id"] = request.category_id
                channel_data.setdefault("stream_info", {})["category_name"] = category_name
                state_service.set_channel_data("yourchy", channel_data)
                
                return {"success": True, "message": f"Категория изменена на {category_name}"}
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("message", "Неизвестная ошибка")
                return {"success": False, "message": f"Ошибка Twitch API: {error_msg}"}
                
    except Exception as e:
        logger.error(f"Error updating Twitch category: {e}")
        return {"success": False, "message": f"Ошибка обновления: {str(e)}"}
