# bot_service/api/admin_api.py
"""API для админ-панели"""
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from core.database import get_db, User, UserSettings, ChatMessage, UserSession
from auth.auth import get_current_user
from datetime import datetime, timedelta
from typing import Optional, Dict
from pydantic import BaseModel
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/list")
async def get_admin_list(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список для админ-панели"""
    try:
        # Проверяем права доступа
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Получаем статистику
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        total_messages = db.query(ChatMessage).count()
        
        # Получаем активные каналы
        active_channels = db.query(UserSettings).filter(
            UserSettings.chat_enabled == True
        ).all()
        
        channels_data = []
        for channel in active_channels:
            channels_data.append({
                'id': channel.id,
                'channel_name': getattr(channel, 'channel_name', None),
                'vk_channel_name': getattr(channel, 'vk_channel_name', None),
                'platform': 'twitch' if getattr(channel, 'channel_name', None) else 'vk',
                'tts_enabled': getattr(channel, 'tts_enabled', False),
                'created_at': channel.created_at.isoformat() if channel.created_at else None
            })
        
        return {
            "success": True,
            "stats": {
                "total_users": total_users,
                "active_users": active_users,
                "total_messages": total_messages,
                "active_channels": len(channels_data)
            },
            "channels": channels_data
        }
    except Exception as e:
        logger.error(f"Error getting admin list: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

def _is_user_whitelisted(user: User, db: Session) -> bool:
    """Проверяет, находится ли пользователь в whitelist"""
    try:
        from core.database import WhitelistedChannel
        
        # Проверяем по Twitch username
        if user.twitch_username:
            twitch_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == user.twitch_username.lower()
            ).first()
            if twitch_whitelisted:
                return True
        
        # Проверяем по VK username
        if user.vk_username:
            vk_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == user.vk_username.lower()
            ).first()
            if vk_whitelisted:
                return True
        
        return False
    except Exception as e:
        logger.error(f"Error checking whitelist status: {e}")
        return False

def is_channel_blocked(channel_name: str, db: Session) -> tuple[bool, Optional[str]]:
    """Проверяет, заблокирован ли канал.
    
    Returns:
        (is_blocked: bool, reason: Optional[str])
    """
    try:
        from core.database import BlockedChannel
        
        channel_name = channel_name.lower().strip()
        
        blocked_channel = db.query(BlockedChannel).filter(
            BlockedChannel.channel_name == channel_name,
            BlockedChannel.is_active == True
        ).first()
        
        if blocked_channel:
            return (True, blocked_channel.reason)
        
        return (False, None)
    except Exception as e:
        logger.error(f"Error checking if channel is blocked: {e}")
        return (False, None)

@router.get("/users")
async def get_admin_users(
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список пользователей для админки"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        offset = (page - 1) * limit
        users = db.query(User).offset(offset).limit(limit).all()
        total_users = db.query(User).count()
        
        user_data = []
        for u in users:
            # Получаем информацию об интеграциях
            from core.database import UserToken
            twitch_token = db.query(UserToken).filter(
                UserToken.user_id == u.id,
                UserToken.platform == 'twitch',
                UserToken.access_token.isnot(None)
            ).first()
            
            vk_token = db.query(UserToken).filter(
                UserToken.user_id == u.id,
                UserToken.platform == 'vk',
                UserToken.access_token.isnot(None)
            ).first()
            
            # Проверяем валидность токенов
            twitch_connected = False
            vk_connected = False
            
            if twitch_token:
                try:
                    import requests
                    test_response = requests.get(f'https://api.twitch.tv/helix/users?id={twitch_token.platform_user_id}', 
                                               headers={'Client-ID': 'your_client_id', 'Authorization': f'Bearer {twitch_token.access_token}'}, 
                                               timeout=5)
                    twitch_connected = test_response.status_code == 200
                except:
                    twitch_connected = False
            
            if vk_token:
                try:
                    import requests
                    test_response = requests.get(f'https://api.vk.com/method/users.get?access_token={vk_token.access_token}&v=5.131', timeout=5)
                    vk_connected = not test_response.json().get('error')
                except:
                    vk_connected = False
            
            user_data.append({
                'id': u.id,
                'is_admin': u.is_admin,
                'is_active': u.is_active,
                'is_blocked': u.is_blocked,
                'blocked_reason': u.blocked_reason,
                'created_at': u.created_at.isoformat() if u.created_at else None,
                'twitch_username': u.twitch_username,
                'vk_username': u.vk_username,
                'integrations': {
                    'twitch': {
                        'connected': twitch_connected,
                        'username': u.twitch_username
                    },
                    'vk': {
                        'connected': vk_connected,
                        'username': u.vk_username
                    }
                },
                'total_integrations': (1 if twitch_connected else 0) + (1 if vk_connected else 0),
                'is_whitelisted': _is_user_whitelisted(u, db)
            })
        
        return {
            "success": True,
            "users": user_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_users,
                "pages": (total_users + limit - 1) // limit
            }
        }
    except Exception as e:
        logger.error(f"Error getting admin users: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.post("/users/{user_id}/block")
async def block_user(
    user_id: int,
    reason: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Комплексная блокировка пользователя:
    1. Блокирует доступ через OAuth (User.is_blocked)
    2. Блокирует все его каналы в гостевом режиме (BlockedChannel)
    3. Отключает бота от всех каналов пользователя
    """
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        blocked_channels = []
        
        # 1. Блокируем пользователя (OAuth доступ)
        target_user.is_blocked = True
        target_user.blocked_reason = reason or "Blocked by administrator"
        target_user.blocked_at = datetime.utcnow()
        logger.info(f"🚫 [ADMIN BLOCK] User {user_id} blocked via OAuth")
        
        # 2. Блокируем все каналы пользователя (гостевой доступ)
        from core.database import BlockedChannel
        
        if target_user.twitch_username:
            twitch_channel = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == target_user.twitch_username.lower()
            ).first()
            
            if not twitch_channel:
                twitch_channel = BlockedChannel(
                    channel_name=target_user.twitch_username.lower(),
                    reason=f"Owner blocked: {target_user.blocked_reason}"
                )
                db.add(twitch_channel)
                blocked_channels.append(f"twitch.tv/{target_user.twitch_username}")
                logger.info(f"🚫 [ADMIN BLOCK] Blocked Twitch channel: {target_user.twitch_username}")
        
        if target_user.vk_username:
            vk_channel = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == target_user.vk_username.lower()
            ).first()
            
            if not vk_channel:
                vk_channel = BlockedChannel(
                    channel_name=target_user.vk_username.lower(),
                    reason=f"Owner blocked: {target_user.blocked_reason}"
                )
                db.add(vk_channel)
                blocked_channels.append(f"vk.com/{target_user.vk_username}")
                logger.info(f"🚫 [ADMIN BLOCK] Blocked VK channel: {target_user.vk_username}")
        
        # Сохраняем изменения в БД
        db.commit()
        
        # 3. Отключаем бота от всех каналов пользователя
        from main import bot_instance, vk_live_bot_instance
        
        disconnected = []
        
        if target_user.twitch_username and bot_instance:
            try:
                await bot_instance.part_channels([target_user.twitch_username])
                disconnected.append(f"Twitch: {target_user.twitch_username}")
                logger.info(f"🤖 [ADMIN BLOCK] Disconnected Twitch bot from {target_user.twitch_username}")
            except Exception as e:
                logger.error(f"Error disconnecting Twitch bot: {e}")
        
        if target_user.vk_channel_name and vk_live_bot_instance:
            try:
                await vk_live_bot_instance.disconnect_from_channel(target_user.vk_channel_name)
                disconnected.append(f"VK: {target_user.vk_channel_name}")
                logger.info(f"🤖 [ADMIN BLOCK] Disconnected VK bot from {target_user.vk_channel_name}")
            except Exception as e:
                logger.error(f"Error disconnecting VK bot: {e}")
        
        logger.info(f"✅ [ADMIN BLOCK] User {user_id} fully blocked. Channels: {blocked_channels}, Bots disconnected: {disconnected}")
        
        return JSONResponse(content={
            "success": True,
            "message": f"User {user_id} fully blocked",
            "details": {
                "oauth_blocked": True,
                "channels_blocked": blocked_channels,
                "bots_disconnected": disconnected,
                "reason": target_user.blocked_reason
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking user: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.post("/users/{user_id}/unblock")
async def unblock_user(
    user_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Комплексная разблокировка пользователя:
    1. Разблокирует доступ через OAuth (User.is_blocked)
    2. Удаляет его каналы из BlockedChannel (восстанавливает гостевой доступ)
    """
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        unblocked_channels = []
        
        # 1. Разблокируем пользователя (OAuth доступ)
        target_user.is_blocked = False
        target_user.blocked_reason = None
        target_user.blocked_at = None
        logger.info(f"✅ [ADMIN UNBLOCK] User {user_id} unblocked via OAuth")
        
        # 2. Удаляем каналы из BlockedChannel (восстанавливаем гостевой доступ)
        from core.database import BlockedChannel
        
        if target_user.twitch_username:
            twitch_channel = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == target_user.twitch_username.lower()
            ).first()
            
            if twitch_channel:
                db.delete(twitch_channel)
                unblocked_channels.append(f"twitch.tv/{target_user.twitch_username}")
                logger.info(f"✅ [ADMIN UNBLOCK] Unblocked Twitch channel: {target_user.twitch_username}")
        
        if target_user.vk_username:
            vk_channel = db.query(BlockedChannel).filter(
                BlockedChannel.channel_name == target_user.vk_username.lower()
            ).first()
            
            if vk_channel:
                db.delete(vk_channel)
                unblocked_channels.append(f"vk.com/{target_user.vk_username}")
                logger.info(f"✅ [ADMIN UNBLOCK] Unblocked VK channel: {target_user.vk_username}")
        
        # Сохраняем изменения в БД
        db.commit()
        
        logger.info(f"✅ [ADMIN UNBLOCK] User {user_id} fully unblocked. Channels: {unblocked_channels}")
        
        return JSONResponse(content={
            "success": True,
            "message": f"User {user_id} fully unblocked",
            "details": {
                "oauth_unblocked": True,
                "channels_unblocked": unblocked_channels
            }
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking user: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/sessions")
async def get_sessions(
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список активных сессий"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        offset = (page - 1) * limit
        sessions = db.query(UserSession).offset(offset).limit(limit).all()
        total_sessions = db.query(UserSession).count()
        
        sessions_data = []
        for session in sessions:
            session_user = db.query(User).filter(User.id == session.user_id).first()
            sessions_data.append({
                'id': session.id,
                'user_id': session.user_id,
                'username': session_user.twitch_username if session_user else 'Unknown',
                'session_id': session.session_id,
                'created_at': session.created_at.isoformat() if session.created_at else None,
                'last_activity': session.last_activity.isoformat() if session.last_activity else None,
                'is_active': session.is_active
            })
        
        return {
            "success": True,
            "sessions": sessions_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_sessions,
                "pages": (total_sessions + limit - 1) // limit
            }
        }
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.post("/whitelist/add")
async def add_to_whitelist(
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить пользователя в whitelist"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Получаем данные из query параметров или body
        try:
            body = await request.json()
            username = body.get('username') or body.get('channel_name')
            platform = (body.get('platform') or 'twitch').lower().strip()
        except:
            # Если не JSON, пробуем query параметры
            username = request.query_params.get('username') or request.query_params.get('channel_name')
            platform = (request.query_params.get('platform') or 'twitch').lower().strip()
        
        if not username:
            raise HTTPException(status_code=400, detail="Username or channel_name is required")
        
        # Нормализуем имя пользователя и платформу
        username = username.lower().strip()
        if platform not in ("twitch", "vk"):
            platform = "twitch"
        
        # Проверяем, не добавлен ли уже
        from core.database import WhitelistedChannel
        existing = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username,
            WhitelistedChannel.platform == platform
        ).first()
        
        if existing:
            logger.warning(f"⚠️ WHITELIST: Попытка добавить уже существующий канал '{username}'")
            return JSONResponse(content={"success": False, "error": f"User {username} is already in whitelist"}, status_code=400)
        
        # Добавляем в whitelist
        whitelist_user = WhitelistedChannel(
            channel_name=username,
            platform=platform
        )
        db.add(whitelist_user)
        db.commit()
        
        logger.info(f"✅ WHITELIST: Канал '{username}' добавлен в белый список")
        return JSONResponse(content={"success": True, "message": f"User {username} added to whitelist"})
    except Exception as e:
        logger.error(f"Error adding to whitelist: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/whitelist")
async def get_whitelist(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список пользователей в whitelist"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import WhitelistedChannel
        whitelist_users = db.query(WhitelistedChannel).all()
        
        whitelist_data = []
        for user in whitelist_users:
            whitelist_data.append({
                'id': user.id,
                'channel_name': user.channel_name,
                'created_at': user.created_at.isoformat() if user.created_at else None
            })
        
        return JSONResponse(content={
            "success": True,
            "whitelist": whitelist_data,
            "total": len(whitelist_data)
        })
    except Exception as e:
        logger.error(f"Error getting whitelist: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.delete("/whitelist/{username}")
async def remove_from_whitelist(
    username: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить пользователя из whitelist"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import WhitelistedChannel
        username = username.lower().strip()
        
        whitelist_user = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username
        ).first()
        
        if not whitelist_user:
            return JSONResponse(content={"success": False, "error": f"User {username} not found in whitelist"}, status_code=404)
        
        db.delete(whitelist_user)
        db.commit()
        
        logger.info(f"🗑️ WHITELIST: Канал '{username}' удален из белого списка")
        return JSONResponse(content={"success": True, "message": f"User {username} removed from whitelist"})
    except Exception as e:
        logger.error(f"Error removing from whitelist: {e}")
        db.rollback()
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/bots/status")
async def get_bots_status(
    user: dict = Depends(get_current_user)
):
    """Получить статус всех ботов"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from main import bot_instance, vk_live_bot_instance
        
        twitch_status = {
            "connected": bot_instance is not None,
            "channels": len(bot_instance.connected_channels) if bot_instance else 0,
            "is_ready": bot_instance.is_ready() if bot_instance else False
        }
        
        vk_status = {
            "connected": vk_live_bot_instance is not None,
            "channels": len(vk_live_bot_instance.connected_channels) if vk_live_bot_instance else 0,
            "is_running": vk_live_bot_instance.is_running if vk_live_bot_instance else False
        }
        
        return {
            "success": True,
            "bots": {
                "twitch": twitch_status,
                "vk": vk_status
            }
        }
    except Exception as e:
        logger.error(f"Error getting bots status: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/tts/status")
async def get_tts_status(
    user: dict = Depends(get_current_user)
):
    """Получить статус TTS сервиса"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        import httpx
        import os
        
        tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{tts_service_url}/health", timeout=5.0)
                tts_data = response.json()
                
            return {
                "success": True,
                "tts_service": {
                    "available": True,
                    "status": tts_data.get("status", "unknown"),
                    "url": tts_service_url
                }
            }
        except Exception as e:
            return {
                "success": True,
                "tts_service": {
                    "available": False,
                    "error": str(e),
                    "url": tts_service_url
                }
            }
            
    except Exception as e:
        logger.error(f"Error getting TTS status: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)

@router.get("/support/tickets")
async def get_support_tickets(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить тикеты поддержки (только для админов)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import SupportTicket
        
        # Базовый запрос
        query = db.query(SupportTicket).filter(SupportTicket.is_archived == False)
        
        # Фильтр по статусу
        if status and status.lower() in ["open", "in_progress", "closed"]:
            query = query.filter(SupportTicket.status == status.lower())
        
        # Получаем общее количество
        total = query.count()
        
        # Пагинация
        offset = (page - 1) * limit
        tickets = query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "success": True,
            "tickets": [
                {
                    "id": t.id,
                    "user_id": t.user_id,
                    "user_name": t.user_name,
                    "user_email": t.user_email,
                    "subject": t.subject,
                    "message": t.message,
                    "status": t.status,
                    "priority": t.priority,
                    "admin_notes": t.admin_notes,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                    "closed_at": t.closed_at.isoformat() if t.closed_at else None
                }
                for t in tickets
            ],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting support tickets: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения тикетов")

@router.get("/support/tickets/{ticket_id}")
async def get_support_ticket_detail(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить деталь тикета с ответами"""
    try:
        from core.database import SupportTicket, TicketResponse
        
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        # Проверяем права доступа (свой тикет или админ)
        if not user.get('is_admin') and ticket.user_id != user.get('id'):
            raise HTTPException(status_code=403, detail="Нет доступа к этому тикету")
        
        # Получаем ответы
        responses = db.query(TicketResponse).filter(
            TicketResponse.ticket_id == ticket_id
        ).order_by(TicketResponse.created_at).all()
        
        return {
            "success": True,
            "ticket": {
                "id": ticket.id,
                "user_id": ticket.user_id,
                "user_name": ticket.user_name,
                "user_email": ticket.user_email,
                "subject": ticket.subject,
                "message": ticket.message,
                "status": ticket.status,
                "priority": ticket.priority,
                "admin_notes": ticket.admin_notes,
                "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
                "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
                "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None
            },
            "responses": [
                {
                    "id": r.id,
                    "author_id": r.author_id,
                    "author_name": r.author_name,
                    "message": r.message,
                    "is_admin_response": r.is_admin_response,
                    "is_read": r.is_read,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in responses
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ticket detail: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения тикета")

@router.post("/support/tickets")
async def create_support_ticket(
    subject: str,
    message: str,
    priority: Optional[str] = "medium",
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый тикет поддержки (для аутентифицированных и анонимных пользователей)"""
    try:
        from core.database import SupportTicket
        
        # Валидация
        if not subject or len(subject.strip()) < 3:
            raise HTTPException(status_code=400, detail="Subject должна быть минимум 3 символа")
        
        if not message or len(message.strip()) < 10:
            raise HTTPException(status_code=400, detail="Message должна быть минимум 10 символов")
        
        if priority and priority.lower() not in ["low", "medium", "high", "urgent"]:
            priority = "medium"
        
        # Создаем тикет
        ticket = SupportTicket(
            user_id=user.get('id') if user else None,
            user_name=user.get('username') if user else None,
            subject=subject.strip(),
            message=message.strip(),
            priority=priority.lower(),
            status="open"
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        logger.info(f"✅ Created support ticket #{ticket.id} from {user.get('username') if user else 'Anonymous'}")
        
        return {
            "success": True,
            "ticket_id": ticket.id,
            "message": "Тикет успешно создан. Мы скоро ответим на ваше обращение."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating support ticket: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка создания тикета")

@router.patch("/support/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: int,
    status: str,
    admin_notes: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить статус тикета (только для админов)"""
    try:
        if not user.get('is_admin'):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import SupportTicket
        from datetime import datetime as dt
        
        if status.lower() not in ["open", "in_progress", "closed"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        ticket.status = status.lower()
        ticket.updated_at = datetime.utcnow()
        
        if status.lower() == "closed":
            ticket.closed_at = datetime.utcnow()
        
        if admin_notes:
            ticket.admin_notes = admin_notes
        
        db.commit()
        
        logger.info(f"✅ Updated ticket #{ticket_id} status to {status}")
        
        return {
            "success": True,
            "message": "Статус тикета обновлен"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating ticket status: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления статуса")

@router.post("/support/tickets/{ticket_id}/responses")
async def add_ticket_response(
    ticket_id: int,
    message: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить ответ на тикет"""
    try:
        from core.database import SupportTicket, TicketResponse
        
        if not message or len(message.strip()) < 3:
            raise HTTPException(status_code=400, detail="Message должна быть минимум 3 символа")
        
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        # Проверяем права доступа
        is_admin = user.get('is_admin', False)
        is_owner = ticket.user_id == user.get('id')
        
        if not (is_admin or is_owner):
            raise HTTPException(status_code=403, detail="Нет доступа к этому тикету")
        
        # Создаем ответ
        response = TicketResponse(
            ticket_id=ticket_id,
            author_id=user.get('id'),
            author_name=user.get('username'),
            message=message.strip(),
            is_admin_response=is_admin
        )
        
        db.add(response)
        ticket.updated_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"✅ Added response to ticket #{ticket_id} from {user.get('username')}")
        
        return {
            "success": True,
            "message": "Ответ добавлен"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding ticket response: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка добавления ответа")

@router.delete("/support/tickets/{ticket_id}")
async def archive_support_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Архивировать тикет (мягкое удаление)"""
    try:
        if not user.get('is_admin'):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import SupportTicket
        
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        ticket.is_archived = True
        db.commit()
        
        logger.info(f"✅ Archived ticket #{ticket_id}")
        
        return {
            "success": True,
            "message": "Тикет архивирован"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving ticket: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка архивирования тикета")

@router.get("/blocked-channels")
async def get_blocked_channels(
    page: int = 1,
    limit: int = 50,
    search: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список заблокированных каналов"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import BlockedChannel
        
        # Базовый запрос
        query = db.query(BlockedChannel).filter(BlockedChannel.is_active == True)
        
        # Поиск по названию канала
        if search:
            query = query.filter(BlockedChannel.channel_name.ilike(f"%{search}%"))
        
        # Получаем общее количество
        total = query.count()
        
        # Пагинация
        offset = (page - 1) * limit
        blocked_channels = query.order_by(BlockedChannel.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "success": True,
            "blocked_channels": [
                {
                    "id": bc.id,
                    "channel_name": bc.channel_name,
                    "reason": bc.reason,
                    "blocked_by": bc.blocked_by,
                    "is_active": bc.is_active,
                    "created_at": bc.created_at.isoformat() if bc.created_at else None
                }
                for bc in blocked_channels
            ],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting blocked channels: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения заблокированных каналов")

@router.post("/blocked-channels")
async def block_channel(
    channel_name: str,
    reason: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Заблокировать канал"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import BlockedChannel
        
        # Валидация
        if not channel_name or len(channel_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Channel name должна быть минимум 2 символа")
        
        # Нормализуем имя канала
        channel_name = channel_name.lower().strip()
        
        # Проверяем, не заблокирован ли уже
        existing = db.query(BlockedChannel).filter(
            BlockedChannel.channel_name == channel_name,
            BlockedChannel.is_active == True
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail=f"Channel {channel_name} is already blocked")
        
        # Создаем запись
        blocked_channel = BlockedChannel(
            channel_name=channel_name,
            reason=reason,
            blocked_by=user.get('username'),
            is_active=True
        )
        
        db.add(blocked_channel)
        db.commit()
        db.refresh(blocked_channel)
        
        logger.info(f"🚫 Blocked channel: {channel_name} by {user.get('username')} (reason: {reason})")
        
        return {
            "success": True,
            "channel_id": blocked_channel.id,
            "message": f"Channel {channel_name} has been blocked"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking channel: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка блокировки канала")

@router.patch("/blocked-channels/{channel_id}")
async def update_blocked_channel(
    channel_id: int,
    reason: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить информацию о заблокированном канале"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import BlockedChannel
        
        blocked_channel = db.query(BlockedChannel).filter(BlockedChannel.id == channel_id).first()
        
        if not blocked_channel:
            raise HTTPException(status_code=404, detail="Blocked channel not found")
        
        if reason:
            blocked_channel.reason = reason
        
        db.commit()
        
        logger.info(f"✏️ Updated blocked channel: {blocked_channel.channel_name}")
        
        return {
            "success": True,
            "message": "Blocked channel updated"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating blocked channel: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления заблокированного канала")

@router.delete("/blocked-channels/{channel_id}")
async def unblock_channel(
    channel_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Разблокировать канал (мягкое удаление)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import BlockedChannel
        
        blocked_channel = db.query(BlockedChannel).filter(BlockedChannel.id == channel_id).first()
        
        if not blocked_channel:
            raise HTTPException(status_code=404, detail="Blocked channel not found")
        
        # Мягкое удаление - просто отмечаем как неактивный
        blocked_channel.is_active = False
        db.commit()
        
        logger.info(f"✅ Unblocked channel: {blocked_channel.channel_name} by {user.get('username')}")
        
        return {
            "success": True,
            "message": f"Channel {blocked_channel.channel_name} has been unblocked"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking channel: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка разблокировки канала")

@router.get("/monitoring/metrics")
async def get_monitoring_metrics(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить метрики мониторинга"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Считаем различные метрики
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        blocked_users = db.query(User).filter(User.is_blocked == True).count()
        
        # Сообщения за последние 24 часа
        day_ago = datetime.utcnow() - timedelta(days=1)
        messages_24h = db.query(ChatMessage).filter(
            ChatMessage.timestamp >= day_ago
        ).count()
        
        # Активные сессии
        active_sessions = db.query(UserSession).filter(
            UserSession.is_active == True
        ).count()
        
        return {
            "success": True,
            "metrics": {
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "blocked": blocked_users
                },
                "messages": {
                    "last_24h": messages_24h
                },
                "sessions": {
                    "active": active_sessions
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error getting monitoring metrics: {e}")
        return {"success": False, "error": str(e)}

# === ANALYTICS ENDPOINT ===
@router.get("/analytics")
async def get_analytics(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить аналитику системы"""
    try:
        logger.info(f"📊 [ANALYTICS] Request from user {user.get('id')}")
        
        # Проверяем что пользователь админ
        user_record = db.query(User).filter(User.id == user.get('id')).first()
        if not user_record or not user_record.is_admin:
            logger.warning(f"❌ [ANALYTICS] User {user.get('id')} is not admin")
            raise HTTPException(status_code=403, detail="Admin access required")
        
        logger.info(f"✅ [ANALYTICS] User {user.get('id')} is admin")
        
        from core.database import BotCommand
        from datetime import datetime
        import psutil
        import os
        
        logger.info(f"📊 [ANALYTICS] Imports successful")
        
        # Последний час
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        
        logger.info(f"📊 [ANALYTICS] Time calculations done")
        
        # Активные пользователи
        active_users = db.query(User).filter(
            User.last_seen > one_hour_ago
        ).count()
        logger.info(f"📊 [ANALYTICS] Active users: {active_users}")
        
        # Сообщения за последний час
        recent_messages = db.query(ChatMessage).filter(
            ChatMessage.timestamp > one_hour_ago
        ).count()
        logger.info(f"📊 [ANALYTICS] Recent messages: {recent_messages}")
        
        # Всего сообщений
        total_messages = db.query(ChatMessage).count()
        logger.info(f"📊 [ANALYTICS] Total messages: {total_messages}")
        
        # TTS запросы
        tts_enabled_users = db.query(User).filter(User.tts_enabled == True).count()
        logger.info(f"📊 [ANALYTICS] TTS enabled users: {tts_enabled_users}")
        
        # Получаем реальные команды
        logger.info(f"📊 [ANALYTICS] Querying top commands...")
        top_commands_query = db.query(
            BotCommand.command_name,
            func.sum(BotCommand.usage_count).label('total_usage')
        ).filter(
            BotCommand.usage_count > 0
        ).group_by(BotCommand.command_name).order_by(
            func.sum(BotCommand.usage_count).desc()
        ).limit(5).all()
        
        logger.info(f"📊 [ANALYTICS] Top commands query result: {top_commands_query}")
        
        top_commands = [
            {"command": f"!{cmd[0]}", "count": cmd[1] or 0}
            for cmd in top_commands_query
        ]
        logger.info(f"📊 [ANALYTICS] Top commands formatted: {top_commands}")
        
        if not top_commands:
            top_commands = []
        
        # Получаем системные метрики
        logger.info(f"📊 [ANALYTICS] Getting system metrics...")
        try:
            cpu_usage = psutil.cpu_percent(interval=1)
            memory_info = psutil.virtual_memory()
            memory_usage = memory_info.percent
            current_process = psutil.Process(os.getpid())
            process_memory_mb = current_process.memory_info().rss / 1024 / 1024
            
            logger.info(f"📊 [ANALYTICS] CPU: {cpu_usage}%, Memory: {memory_usage}%, Process: {process_memory_mb}MB")
            
        except Exception as e:
            logger.warning(f"⚠️ [ANALYTICS] Could not get system metrics: {e}")
            cpu_usage = 0
            memory_usage = 0
            process_memory_mb = 0
        
        # Сборка аналитики
        logger.info(f"📊 [ANALYTICS] Assembling analytics response...")
        analytics = {
            "active_users": active_users,
            "total_messages": total_messages,
            "recent_messages": recent_messages,
            "tts_requests": tts_enabled_users,
            "errors_count": 0,
            "last_error": None,
            "uptime_percent": 99.8,
            "avg_response_time": None,
            "cpu_usage": round(cpu_usage, 1),
            "memory_usage": round(memory_usage, 1),
            "process_memory_mb": round(process_memory_mb, 1),
            "timestamp": datetime.utcnow().isoformat(),
            "top_commands": top_commands
        }
        
        logger.info(f"✅ [ANALYTICS] Response assembled successfully")
        
        return {
            "success": True,
            "analytics": analytics
        }
        
    except HTTPException:
        logger.error(f"❌ [ANALYTICS] HTTPException raised")
        raise
    except Exception as e:
        logger.error(f"❌ [ANALYTICS] Error getting analytics: {e}")
        import traceback
        logger.error(f"❌ [ANALYTICS] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения аналитики: {str(e)}")

# === SERVICE RESTART ENDPOINTS ===
@router.post("/bot-service/restart")
async def restart_bot_service(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Перезапустить Bot Service (только для админов)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        logger.info(f"🔄 [ADMIN] Bot service restart requested by user {user.get('id')}")
        
        # Получаем доступ к ботам из main
        from main import bot_instance, vk_live_bot_instance
        
        restart_results = {
            "twitch": {"status": "not_available", "message": "Бот не активен"},
            "vk": {"status": "not_available", "message": "Бот не активен"}
        }
        
        # Перезапуск Twitch бота
        if bot_instance:
            try:
                logger.info("🔄 [ADMIN] Restarting Twitch bot...")
                channels = list(bot_instance.connected_channels) if bot_instance.connected_channels else []
                
                # Отключаем текущие каналы
                for channel in channels:
                    try:
                        await bot_instance.part_channels([channel.name])
                    except Exception as e:
                        logger.error(f"Error parting channel {channel.name}: {e}")
                
                # Переподключаем через небольшую задержку
                await asyncio.sleep(2)
                
                # Получаем активных пользователей с Twitch
                active_twitch_users = db.query(User).filter(
                    User.twitch_access_token.isnot(None),
                    User.is_active == True
                ).all()
                
                reconnected = 0
                for user_record in active_twitch_users:
                    if user_record.twitch_username:
                        try:
                            success = await bot_instance.join_channel(user_record.twitch_username)
                            if success:
                                reconnected += 1
                        except Exception as e:
                            logger.error(f"Error rejoining {user_record.twitch_username}: {e}")
                
                restart_results["twitch"] = {
                    "status": "restarted",
                    "message": f"Переподключено к {reconnected} каналам",
                    "reconnected_channels": reconnected
                }
                logger.info(f"✅ [ADMIN] Twitch bot restarted, reconnected to {reconnected} channels")
                
            except Exception as e:
                logger.error(f"Error restarting Twitch bot: {e}")
                restart_results["twitch"] = {
                    "status": "error",
                    "message": f"Ошибка перезапуска: {str(e)}"
                }
        
        # Перезапуск VK бота
        if vk_live_bot_instance:
            try:
                logger.info("🔄 [ADMIN] Restarting VK bot...")
                
                # Получаем активных пользователей с VK
                active_vk_users = db.query(User).filter(
                    User.vk_access_token.isnot(None),
                    User.is_active == True
                ).all()
                
                # Переподключаем каналы
                reconnected = 0
                for user_record in active_vk_users:
                    if user_record.vk_channel_name:
                        try:
                            await vk_live_bot_instance.disconnect_from_channel(user_record.vk_channel_name)
                            await asyncio.sleep(1)
                            success = await vk_live_bot_instance.connect_to_channel(
                                user_record.vk_channel_name,
                                user_record.vk_access_token
                            )
                            if success:
                                reconnected += 1
                        except Exception as e:
                            logger.error(f"Error reconnecting VK channel {user_record.vk_channel_name}: {e}")
                
                restart_results["vk"] = {
                    "status": "restarted",
                    "message": f"Переподключено к {reconnected} каналам",
                    "reconnected_channels": reconnected
                }
                logger.info(f"✅ [ADMIN] VK bot restarted, reconnected to {reconnected} channels")
                
            except Exception as e:
                logger.error(f"Error restarting VK bot: {e}")
                restart_results["vk"] = {
                    "status": "error",
                    "message": f"Ошибка перезапуска: {str(e)}"
                }
        
        return {
            "success": True,
            "message": "Перезапуск завершен",
            "results": restart_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restarting bot service: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка перезапуска: {str(e)}")

@router.post("/tts/restart")
async def restart_tts_engine(
    user: dict = Depends(get_current_user)
):
    """Перезапустить TTS движок (только для админов)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        logger.info(f"🔄 [ADMIN] TTS engine restart requested by user {user.get('id')}")
        
        # TTS сервис - это отдельный микросервис, мы можем только проверить его статус
        # Реальный перезапуск должен быть выполнен через Docker или системный менеджер
        
        from constants import TTS_SERVICE_URL
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Проверяем health endpoint
                response = await client.get(f"{TTS_SERVICE_URL}/health")
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": "TTS сервис работает нормально",
                        "status": "healthy",
                        "note": "Для полного перезапуска используйте Docker: docker-compose restart tts_service"
                    }
                else:
                    return {
                        "success": False,
                        "message": "TTS сервис недоступен",
                        "status": "unhealthy",
                        "status_code": response.status_code
                    }
                    
        except httpx.RequestError as e:
            logger.error(f"Error checking TTS service: {e}")
            return {
                "success": False,
                "message": "TTS сервис недоступен",
                "status": "offline",
                "error": str(e),
                "note": "Запустите TTS сервис через: docker-compose up -d tts_service"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restarting TTS engine: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка проверки TTS: {str(e)}")
