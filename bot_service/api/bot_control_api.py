# bot_service/api/bot_control_api.py
"""
API endpoints для управления ботами.

Рефакторинг: использует BotRegistry вместо глобальных переменных из main.py.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from auth.auth import get_current_user
from core.token_manager import token_manager
from core.connection_manager import get_connection_manager
from core.database import User, get_db
from startup.bot_registry import get_bot_registry

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

        # Получаем usernames из таблицы User
        user_record = db.query(User).filter(User.id == user_id).first()
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

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

        # Получаем connection_manager и bot registry
        connection_manager = get_connection_manager()
        registry = get_bot_registry()

        # Проверяем Twitch бота
        if registry.twitch_bot and twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if connection_manager.is_channel_active(channel_name):
                bot_status["twitch"]["connected"] = True
                bot_status["twitch"]["channel"] = channel_name
                bot_status["connected"] = True
                bot_status["channel"] = channel_name
                bot_status["platform"] = "twitch"

        # Проверяем VK бота
        if registry.vk_bot and vk_token and user_record.vk_channel_name:
            channel_name = user_record.vk_channel_name
            if connection_manager.is_channel_active(channel_name):
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
async def connect_chat(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Подключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat connect requested by user {user_id}")

        # Проверяем наличие токенов (без проверки session - это управление ботом)
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)

        if not twitch_token and not vk_token:
            return {"success": False, "error": "Нет подключенных платформ. Подключите Twitch или VK Live"}

        # Получаем usernames из таблицы User
        user_record = db.query(User).filter(User.id == user_id).first()
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        # Боты уже запущены глобально и автоматически подключаются к каналам
        # при наличии токенов. Проверяем статус подключения
        connection_manager = get_connection_manager()
        registry = get_bot_registry()
        connected_platforms = []

        if twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if registry.twitch_bot and connection_manager.is_channel_active(channel_name):
                connected_platforms.append("Twitch")

        if vk_token and user_record.vk_channel_name:
            channel_name = user_record.vk_channel_name
            if registry.vk_bot and connection_manager.is_channel_active(channel_name):
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
async def disconnect_chat(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Отключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat disconnect requested by user {user_id}")

        # Получаем токены и удаляем активные сессии
        from core.token_utils import get_user_token_from_db
        twitch_token = get_user_token_from_db(user_id, "twitch")
        vk_token = get_user_token_from_db(user_id, "vk")

        # Получаем usernames из таблицы User
        user_record = db.query(User).filter(User.id == user_id).first()
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        connection_manager = get_connection_manager()
        disconnected = []

        if twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if connection_manager.remove_active_session(channel_name, "manual_disconnect"):
                disconnected.append("Twitch")

        if vk_token and user_record.vk_channel_name:
            channel_name = user_record.vk_channel_name
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
async def get_chat_status(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Получить статус чата"""
    try:
        user_id = user.get("id")

        # Используем TokenManager (не требует session check для bot status)
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)

        # Получаем usernames из таблицы User
        user_record = db.query(User).filter(User.id == user_id).first()
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        chat_status = {
            "connected": False,
            "channel": None,
            "platform": None,
            "last_message": None
        }

        # Получаем connection_manager и bot registry
        connection_manager = get_connection_manager()
        registry = get_bot_registry()

        # Проверяем подключение к чатам
        if registry.twitch_bot and twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            if connection_manager.is_channel_active(channel_name):
                chat_status["connected"] = True
                chat_status["channel"] = channel_name
                chat_status["platform"] = "twitch"
                return chat_status

        if registry.vk_bot and vk_token and user_record.vk_channel_name:
            channel_name = user_record.vk_channel_name
            if connection_manager.is_channel_active(channel_name):
                chat_status["connected"] = True
                chat_status["channel"] = channel_name
                chat_status["platform"] = "vk"
                return chat_status

        return chat_status
    except Exception as e:
        logger.error(f"Error getting chat status: {e}")
        return {"connected": False, "error": str(e)}

@router.post("/chat/reconnect")
async def reconnect_chat(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Переподключить чат-бота"""
    try:
        user_id = user.get("id")
        logger.info(f"Chat reconnect requested by user {user_id}")

        # Получаем токены через TokenManager
        twitch_token = token_manager.get_user_token_data(user_id, "twitch", require_session_check=False)
        vk_token = token_manager.get_user_token_data(user_id, "vk", require_session_check=False)

        if not twitch_token and not vk_token:
            return {"success": False, "error": "Нет подключенных платформ"}

        # Получаем usernames из таблицы User
        user_record = db.query(User).filter(User.id == user_id).first()
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        connection_manager = get_connection_manager()
        reconnected = []

        # Переподключаем Twitch
        if twitch_token and user_record.twitch_username:
            channel_name = user_record.twitch_username
            # Удаляем старую сессию если есть
            connection_manager.remove_active_session(channel_name, "reconnect")
            # Бот автоматически переподключится
            reconnected.append("Twitch")

        # Переподключаем VK
        if vk_token and user_record.vk_channel_name:
            channel_name = user_record.vk_channel_name
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
