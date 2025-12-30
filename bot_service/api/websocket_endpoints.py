# bot_service/api/websocket_endpoints.py
"""
WebSocket endpoints для чата и тестирования.

Вынесено из main.py для улучшения модульности.
"""

import json
import asyncio
import logging
from typing import List, Dict, Any

from fastapi import APIRouter, WebSocket

from core.database import ChatMessage, User, get_db
from core.connection_manager import get_connection_manager
from services.memory_websocket_manager import memory_websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


async def _load_chat_history(user_id: int) -> List[Dict[str, Any]]:
    """
    Загружает историю чата для пользователя.
    
    Выполняется в отдельном потоке для избежания блокировки event loop.
    """
    def _db_query():
        db = next(get_db())
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return []
            
            # Определяем платформы пользователя
            platforms = []
            if user.twitch_username:
                platforms.append('twitch')
            if user.vk_channel_name:
                platforms.append('vk')
            
            if not platforms:
                return []
            
            # Один запрос для всех платформ
            messages = db.query(ChatMessage).filter(
                ChatMessage.user_id == user_id,
                ChatMessage.platform.in_(platforms)
            ).order_by(ChatMessage.timestamp.desc()).limit(50).all()
            
            messages.sort(key=lambda x: x.timestamp)
            return messages
        finally:
            db.close()
    
    return await asyncio.to_thread(_db_query)


def _format_message(msg: ChatMessage) -> Dict[str, Any]:
    """Форматирует сообщение для отправки клиенту."""
    # Парсим badges
    badges_list = msg.badges
    if isinstance(badges_list, str):
        try:
            badges_list = json.loads(badges_list)
        except (json.JSONDecodeError, TypeError):
            badges_list = None
    
    # Конвертируем timestamp
    timestamp_ms = None
    if msg.timestamp:
        timestamp_ms = int(msg.timestamp.timestamp() * 1000)
    
    return {
        "id": msg.id,
        "platform": msg.platform,
        "author": msg.author_username,
        "author_name": msg.author_username,
        "message": msg.message,
        "timestamp": timestamp_ms,
        "role": msg.role,
        "badges": badges_list
    }


async def _send_chat_history(websocket: WebSocket, user_id: int) -> None:
    """
    Отправляет историю чата через WebSocket.
    
    Выполняется асинхронно в background.
    """
    try:
        await asyncio.sleep(0.05)  # Даём клиенту время на инициализацию
        
        messages = await _load_chat_history(user_id)
        
        if not messages:
            return
        
        history_data = [_format_message(msg) for msg in messages]
        
        await websocket.send_text(json.dumps({
            "type": "chat_history",
            "messages": history_data
        }))
        
        logger.info(f"[HISTORY] Sent {len(history_data)} messages")
        
    except Exception as e:
        logger.debug(f"[WARN] Error loading chat history: {e}")


@router.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint для чата.
    
    Обрабатывает:
    - Подключение/отключение пользователей
    - Отправку истории чата
    - Ping/pong heartbeat
    - TTS disconnect scheduling
    """
    logger.info(f"[WS] WebSocket connection for user {user_id}")
    
    await websocket.accept()
    logger.info(f"[OK] WebSocket accepted for user {user_id}")
    
    user_id_int = int(user_id) if user_id.isdigit() else -1
    
    # Отменяем отложенное отключение TTS
    if user_id_int > 0:
        conn_mgr = get_connection_manager()
        conn_mgr.cancel_tts_disconnect(user_id_int)
    
    # Добавляем соединение в manager
    conn_id = await memory_websocket_manager.add_connection(
        websocket,
        user_id_int,
        f"user_{user_id}",
        "chat"
    )
    logger.info(f"[OK] Connection added: {conn_id}")
    
    # Отправляем историю в background
    asyncio.create_task(_send_chat_history(websocket, user_id_int))
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await memory_websocket_manager.handle_ping(conn_id)
                    logger.debug(f"🏓 Ping/Pong with user {user_id}")
                    continue
                
                logger.info(f"[BROADCAST] Received from user {user_id}: {message.get('type', 'unknown')}")
                
            except json.JSONDecodeError:
                logger.info(f"[BROADCAST] Received from user {user_id}: {data}")
                
    except Exception as e:
        logger.info(f"[WS] WebSocket disconnected for user {user_id}: {e}")
    finally:
        await memory_websocket_manager.remove_connection(conn_id)
        logger.info(f"[OK] Connection removed: {conn_id}")
        
        # Планируем отключение TTS
        if user_id_int > 0:
            await _schedule_tts_disconnect(user_id_int)


async def _schedule_tts_disconnect(user_id: int) -> None:
    """Планирует отключение TTS после отключения пользователя."""
    conn_mgr = get_connection_manager()
    
    db = next(get_db())
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if user:
            username = user.twitch_username or user.vk_username or f"user_{user_id}"
            conn_mgr.schedule_tts_disconnect(user_id, username)
        else:
            logger.warning(f"[WARN] User {user_id} not found, skipping TTS disconnect")
    finally:
        db.close()


@router.websocket("/ws/test")
async def websocket_test(websocket: WebSocket):
    """Тестовый WebSocket endpoint."""
    logger.info("[WS] Test WebSocket connection attempt")
    await websocket.accept()
    logger.info("[OK] Test WebSocket connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"[WS] Test received: {data}")
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        logger.error(f"[ERROR] Test WebSocket error: {e}")
        await websocket.close()
