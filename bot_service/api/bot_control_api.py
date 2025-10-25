# bot_service/api/bot_control_api.py
from fastapi import APIRouter, Depends, HTTPException
from auth.auth import get_current_user
from core.token_manager import token_manager
from core.connection_manager import get_connection_manager
from core.database import UserToken, get_db
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["bot-control"])

@router.get("/bot/status")
async def get_bot_status(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить статус бота"""
    try:
        user_id = user.get("id")
        
        # Получаем токены пользователя (без проверки session - это статус бота)
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)
        
        bot_status = {
            "connected": False,
            "channel": None,
            "platform": None,
            "last_activity": None,
            "twitch": {
                "connected": False,
                "channel": None
            },
            "vk": {
                "connected": False,
                "channel": None
            }
        }
        
        # Получаем connection_manager
        connection_manager = get_connection_manager()
        
        # Проверяем Twitch бота (bot_instance теперь глобальная переменная из main.py)
        from main import bot_instance
        if bot_instance and twitch_token:
            channel_name = twitch_token.get("platform_username")
            if channel_name and connection_manager.is_channel_active(channel_name):
                bot_status["twitch"]["connected"] = True
                bot_status["twitch"]["channel"] = channel_name
                bot_status["connected"] = True
                bot_status["channel"] = channel_name
                bot_status["platform"] = "twitch"
        
        # Проверяем VK бота (vk_live_bot_instance теперь глобальная переменная из main.py)
        from main import vk_live_bot_instance
        if vk_live_bot_instance and vk_token:
            channel_name = vk_token.get("platform_username")
            if channel_name and connection_manager.is_channel_active(channel_name):
                bot_status["vk"]["connected"] = True
                bot_status["vk"]["channel"] = channel_name
                if not bot_status["connected"]:
                    bot_status["connected"] = True
                    bot_status["channel"] = channel_name
                    bot_status["platform"] = "vk"
        
        return bot_status
    except Exception as e:
        logger.error(f"Error getting bot status: {e}")
        return {"connected": False, "error": str(e)}

@router.post("/chat/connect")
async def connect_chat(user: dict = Depends(get_current_user)):
    """Подключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat connect requested by user {user_id}")
        
        # Проверяем наличие токенов (без проверки session - это управление ботом)
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)
        
        if not twitch_token and not vk_token:
            return {"success": False, "error": "Нет подключенных платформ. Подключите Twitch или VK Live"}
        
        # Боты уже запущены глобально и автоматически подключаются к каналам
        # при наличии токенов. Проверяем статус подключения
        connected_platforms = []
        
        if twitch_token:
            channel_name = twitch_token.get("platform_username")
            if bot_instance and connection_manager.is_channel_active(channel_name):
                connected_platforms.append("Twitch")
        
        if vk_token:
            channel_name = vk_token.get("platform_username")
            if vk_live_bot_instance and connection_manager.is_channel_active(channel_name):
                connected_platforms.append("VK Live")
        
        if connected_platforms:
            return {
                "success": True,
                "message": f"Бот подключен к: {', '.join(connected_platforms)}"
            }
        else:
            return {
                "success": True,
                "message": "Боты запущены. Подключение может занять несколько секунд."
            }
    except Exception as e:
        logger.error(f"Error connecting chat: {e}")
        return {"success": False, "error": str(e)}

@router.post("/chat/disconnect")
async def disconnect_chat(user: dict = Depends(get_current_user)):
    """Отключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat disconnect requested by user {user_id}")
        
        # Получаем токены и удаляем активные сессии
        twitch_token = get_user_token_from_db(user_id, "twitch")
        vk_token = get_user_token_from_db(user_id, "vk")
        
        disconnected = []
        
        if twitch_token:
            channel_name = twitch_token.get("platform_username")
            if connection_manager.remove_active_session(channel_name, "manual_disconnect"):
                disconnected.append("Twitch")
        
        if vk_token:
            channel_name = vk_token.get("platform_username")
            if connection_manager.remove_active_session(channel_name, "manual_disconnect"):
                disconnected.append("VK Live")
        
        if disconnected:
            return {
                "success": True,
                "message": f"Бот отключен от: {', '.join(disconnected)}"
            }
        else:
            return {
                "success": True,
                "message": "Бот не был подключен"
            }
    except Exception as e:
        logger.error(f"Error disconnecting chat: {e}")
        return {"success": False, "error": str(e)}

@router.get("/chat/status")
async def get_chat_status(user: dict = Depends(get_current_user)):
    """Получить статус чата"""
    try:
        user_id = user.get("id")
        
        # Используем TokenManager (не требует session check для bot status)
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)
        
        chat_status = {
            "connected": False,
            "channel": None,
            "platform": None,
            "last_message": None
        }
        
        # Получаем connection_manager и bot instances
        connection_manager = get_connection_manager()
        from main import bot_instance, vk_live_bot_instance
        
        # Проверяем подключение к чатам
        if bot_instance and twitch_token:
            channel_name = twitch_token.get("platform_username")
            if channel_name and connection_manager.is_channel_active(channel_name):
                chat_status["connected"] = True
                chat_status["channel"] = channel_name
                chat_status["platform"] = "twitch"
                return chat_status
        
        if vk_live_bot_instance and vk_token:
            channel_name = vk_token.get("platform_username")
            if channel_name and connection_manager.is_channel_active(channel_name):
                chat_status["connected"] = True
                chat_status["channel"] = channel_name
                chat_status["platform"] = "vk"
                return chat_status
        
        return chat_status
    except Exception as e:
        logger.error(f"Error getting chat status: {e}")
        return {"connected": False, "error": str(e)}

@router.post("/chat/reconnect")
async def reconnect_chat(user: dict = Depends(get_current_user)):
    """Переподключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat reconnect requested by user {user_id}")
        
        # Получаем токены через TokenManager
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)
        
        if not twitch_token and not vk_token:
            return {"success": False, "error": "Нет подключенных платформ"}
        
        reconnected = []
        
        # Переподключаем Twitch
        if twitch_token:
            channel_name = twitch_token.get("platform_username")
            # Удаляем старую сессию если есть
            connection_manager.remove_active_session(channel_name, "reconnect")
            # Бот автоматически переподключится
            reconnected.append("Twitch")
        
        # Переподключаем VK
        if vk_token:
            channel_name = vk_token.get("platform_username")
            # Удаляем старую сессию если есть
            connection_manager.remove_active_session(channel_name, "reconnect")
            # Бот автоматически переподключится
            reconnected.append("VK Live")
        
        if reconnected:
            return {
                "success": True,
                "message": f"Переподключение инициировано для: {', '.join(reconnected)}"
            }
        else:
            return {"success": False, "error": "Не удалось инициировать переподключение"}
    except Exception as e:
        logger.error(f"Error reconnecting chat: {e}")
        return {"success": False, "error": str(e)}
