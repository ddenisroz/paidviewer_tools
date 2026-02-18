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
from services.memory_websocket_manager import get_memory_websocket_manager
from repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


async def _load_chat_history(user_id: int) -> List[Dict[str, Any]]:
    """
    Загружает историю чата для пользователя.
    """
    def _db_query():
        # Используем новый session context manager если он есть, или получаем session напрямую
        # В данном проекте get_db() - это генератор
        db = next(get_db())
        try:
            from repositories.user_repository import UserRepository
            from repositories.chat_message_repository import ChatMessageRepository
            
            user_repo = UserRepository(db)
            user = user_repo.get_by_id(user_id)
            if not user:
                return []
            
            platforms = []
            if user.twitch_username: platforms.append('twitch')
            if user.vk_channel_name: platforms.append('vk')
            
            if not platforms: return []
            
            chat_repo = ChatMessageRepository(db)
            # Оптимизация: limit=20 для быстрой загрузки, клиент может запросить больше если надо
            messages = chat_repo.get_history_by_platforms(user_id, platforms, limit=20)
            messages.sort(key=lambda x: x.timestamp)
            return messages
        except Exception as e:
            logger.exception("Error querying chat history")
            return []
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
        "channel": msg.channel_name,
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
        logger.exception("[WARN] Error loading chat history")


@router.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint для чата.
    """
    logger.info(f"[WS] Connection request for user {user_id}")
    
    await websocket.accept()
    
    user_id_int = int(user_id) if user_id.isdigit() else -1
    if user_id_int <= 0:
        logger.warning(f"[WS] Invalid user_id {user_id}, closing")
        await websocket.close(code=4000)
        return

    manager = get_memory_websocket_manager()
    conn_mgr = get_connection_manager()
    client_role = (websocket.query_params.get("client_role") or "dashboard").strip().lower()
    presence_only_raw = websocket.query_params.get("presence_only")
    presence_only = str(presence_only_raw).strip().lower() in {"1", "true", "yes", "on"}

    # Zombie Check: Close existing chat connections for this user to prevent duplicates
    # This is a basic implementation; for multiple tabs support, we might need a different strategy.
    # But for stability, ensuring 1 main connection is safer.
    # DISABLED to prevent infinite loops during stabilization
    # active_conns = manager.get_active_connections(user_id_int)
    # for conn in active_conns:
    #     if conn.connection_type == 'chat':
    #         logger.info(f"[WS] Closing stale connection {conn.connection_id} for user {user_id}")
    #         # We can't easily close the *socket* of the other task here without access to it, 
    #         # but we can remove it from manager so it stops receiving broadcasts.
    #         # Ideally the client handles single-tab logic.
    #         pass 

    # Cancel TTS disconnect timer
    conn_mgr.cancel_tts_disconnect(user_id_int)
    
    # Register connection
    conn_id = await manager.add_connection(
        websocket,
        user_id_int,
        f"user_{user_id}",
        "chat",
        client_role=client_role,
        presence_only=presence_only
    )
    logger.info(
        f"[WS] Connected: {conn_id} (User: {user_id}, role={client_role}, presence_only={presence_only})"
    )
    
    history_task: asyncio.Task | None = None
    if not presence_only:
        history_task = asyncio.create_task(_send_chat_history(websocket, user_id_int))
    
    try:
        while True:
            # heartbeat logic could go here if not handled by standard ping/pong
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    await manager.handle_ping(conn_id)
                    continue
                
                # Basic validation to avoid log spam
                msg_type = message.get('type', 'unknown')
                if msg_type != 'pong':
                     logger.debug(f"[WS] User {user_id} sent: {msg_type}")

            except json.JSONDecodeError:
                pass
                
    except Exception as e:
        # Normal disconnects (1000, 1001) raise exceptions in starlette/fastapi sometimes
        # check string to avoid scary logs for normal disconnects
        e_str = str(e)
        if "1000" in e_str or "1001" in e_str or "closed" in e_str.lower():
            logger.info(f"[WS] Disconnected cleanly: {user_id}")
        else:
            logger.warning(f"[WS] Error user {user_id}: {e}")
            
    finally:
        if history_task and not history_task.done():
            history_task.cancel()

        await manager.remove_connection(conn_id)
        
        # Schedule TTS disconnect if no other connections remain
        remaining = manager.get_user_connections(user_id_int)
        if not remaining:
            pending = conn_mgr.pending_tts_disconnects.get(user_id_int)
            if pending and not pending.done():
                logger.debug(f"[WS] TTS disconnect already scheduled for {user_id}, skipping duplicate schedule")
            else:
                logger.info(f"[WS] No active connections for {user_id}, scheduling TTS disconnect")
                await _schedule_tts_disconnect(user_id_int)
        else:
             logger.debug(f"[WS] User {user_id} still has {len(remaining)} connections, skipping disconnect timer")


async def _schedule_tts_disconnect(user_id: int) -> None:
    """Планирует отключение TTS после отключения пользователя."""
    conn_mgr = get_connection_manager()
    
    db = next(get_db())
    try:
        user_repo = UserRepository(db)
        user = user_repo.get_by_id(user_id)
        
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
        logger.exception("[ERROR] Test WebSocket error")
        await websocket.close()

