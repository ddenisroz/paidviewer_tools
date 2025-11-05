# bot_service/api/admin_api.py
"""API для админ-панели"""
from fastapi import APIRouter, Depends, HTTPException, Request, Body, UploadFile, File, Form, Query
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
import os

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
    """Проверяет, находится ли пользователь в whitelist (с кешированием)"""
    try:
        from utils.whitelist_cache import is_user_whitelisted_cached
        return is_user_whitelisted_cached(user, db)
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
    search: str = None,  # ✅ Добавлена поддержка поиска
    include_guests: bool = True,  # По умолчанию включаем гостей
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список пользователей для админки (включая гостевые сессии)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import WhitelistedChannel, GuestSession
        
        offset = (page - 1) * limit
        
        # ✅ ОПТИМИЗАЦИЯ: Ищем пользователей с фильтром и пагинацией
        users_query = db.query(User)
        
        # Добавляем фильтр поиска если есть
        if search:
            search_term = f"%{search.lower()}%"
            users_query = users_query.filter(
                (User.twitch_username.ilike(search_term)) |
                (User.vk_username.ilike(search_term)) |
                (User.vk_channel_name.ilike(search_term))
            )
        
        # Загружаем обычных пользователей с пагинацией
        users = users_query.offset(offset).limit(limit).all()
        total_users = users_query.count()  # ✅ Считаем ПОСЛЕ фильтра
        
        # Загружаем гостевые сессии (если включено) из таблицы GuestSession
        guest_sessions = []
        total_guest_sessions = 0
        if include_guests:
            # ✅ ОПТИМИЗАЦИЯ: Гостевые сессии ТОЖЕ с пагинацией
            guest_query = db.query(GuestSession).filter(
                GuestSession.is_active == True
            )
            
            # Добавляем фильтр поиска для гостей
            if search:
                search_term = f"%{search.lower()}%"
                guest_query = guest_query.filter(
                    GuestSession.channel_name.ilike(search_term) |
                    GuestSession.platform.ilike(search_term)
                )
            
            # Загружаем с пагинацией
            guest_sessions = guest_query.offset(offset).limit(limit).all()
            total_guest_sessions = guest_query.count()  # ✅ Считаем ПОСЛЕ фильтра
        
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
            
            # Проверяем наличие активных токенов (упрощенно - без проверки через API)
            twitch_connected = twitch_token is not None and twitch_token.is_active
            vk_connected = vk_token is not None and vk_token.is_active
            
            # Получаем username из токена или из User
            twitch_display_name = u.twitch_username or (twitch_token.platform_user_id if twitch_token else None)
            vk_display_name = u.vk_username or u.vk_channel_name or (vk_token.platform_user_id if vk_token else None)
            
            # Проверяем whitelist статус по платформам
            whitelisted_platforms = []
            whitelisted_channels = {}
            
            # Проверяем Twitch whitelist
            if u.twitch_username:
                twitch_whitelisted = db.query(WhitelistedChannel).filter(
                    WhitelistedChannel.channel_name == u.twitch_username.lower(),
                    WhitelistedChannel.platform == 'twitch'
                ).first()
                if twitch_whitelisted:
                    whitelisted_platforms.append('twitch')
                    whitelisted_channels['twitch'] = u.twitch_username
            
            # Проверяем VK whitelist
            if u.vk_username:
                vk_whitelisted = db.query(WhitelistedChannel).filter(
                    WhitelistedChannel.channel_name == u.vk_username.lower(),
                    WhitelistedChannel.platform == 'vk'
                ).first()
                if vk_whitelisted:
                    whitelisted_platforms.append('vk')
                    whitelisted_channels['vk'] = u.vk_username
            
            is_whitelisted = len(whitelisted_platforms) > 0
            
            user_data.append({
                'id': u.id,
                'is_guest': False,
                'is_admin': u.is_admin,
                'is_active': u.is_active,
                'is_blocked': u.is_blocked,
                'blocked_reason': u.blocked_reason,
                'created_at': u.created_at.isoformat() if u.created_at else None,
                'twitch_username': u.twitch_username,
                'vk_username': u.vk_username,
                'vk_channel_name': u.vk_channel_name,
                'integrations': {
                    'twitch': {
                        'connected': twitch_connected,
                        'username': twitch_display_name,
                        'enabled': twitch_connected
                    },
                    'vk': {
                        'connected': vk_connected,
                        'username': vk_display_name,
                        'enabled': vk_connected
                    }
                },
                'total_integrations': (1 if twitch_connected else 0) + (1 if vk_connected else 0),
                'is_whitelisted': is_whitelisted,
                'whitelisted_platforms': whitelisted_platforms,  # Список платформ: ['twitch', 'vk']
                'whitelisted_channels': whitelisted_channels  # Объект: {'twitch': 'channel_name', 'vk': 'channel_name'}
            })
        
        # Добавляем гостевые сессии из GuestSession
        for guest_session in guest_sessions:
            # Теперь channel_name и platform хранятся прямо в таблице, не в JSON
            monitored_channel = guest_session.channel_name
            platform = guest_session.platform
            
            # Проверяем whitelist для гостевого канала
            whitelisted_platforms = []
            whitelisted_channels = {}
            
            if monitored_channel and platform:
                whitelisted = db.query(WhitelistedChannel).filter(
                    WhitelistedChannel.channel_name == monitored_channel.lower(),
                    WhitelistedChannel.platform == platform
                ).first()
                if whitelisted:
                    whitelisted_platforms.append(platform)
                    whitelisted_channels[platform] = monitored_channel
            
            # Определяем username в зависимости от платформы
            twitch_username = monitored_channel if platform == 'twitch' else None
            vk_username = monitored_channel if platform == 'vk' else None
            vk_channel_name = monitored_channel if platform == 'vk' else None
            
            user_data.append({
                'id': -1,  # Специальный ID для гостей
                'is_guest': True,
                'session_id': guest_session.session_id,
                'is_admin': False,
                'is_active': True,
                'is_blocked': False,
                'blocked_reason': None,
                'created_at': guest_session.created_at.isoformat() if guest_session.created_at else None,
                'last_activity': guest_session.last_activity.isoformat() if guest_session.last_activity else None,
                'twitch_username': twitch_username,
                'vk_username': vk_username,
                'vk_channel_name': vk_channel_name,
                'integrations': {
                    'twitch': {
                        'connected': platform == 'twitch',
                        'username': twitch_username,
                        'enabled': platform == 'twitch'
                    },
                    'vk': {
                        'connected': platform == 'vk',
                        'username': vk_username,
                        'enabled': platform == 'vk'
                    }
                },
                'total_integrations': 1 if platform else 0,
                'is_whitelisted': len(whitelisted_platforms) > 0,
                'whitelisted_platforms': whitelisted_platforms,
                'whitelisted_channels': whitelisted_channels
            })
        
        # Общее количество (обычные пользователи + гостевые сессии)
        total_count = total_users + total_guest_sessions
        
        return {
            "success": True,
            "users": user_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_users": total_users,
                "total_guests": total_guest_sessions,
                "pages": (total_count + limit - 1) // limit
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
        
        # ✅ NULL CHECK: Запрашиваем пользователя
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # ✅ SAFETY CHECK: Убеждаемся что user объект корректен
        if not hasattr(target_user, 'is_blocked') or not hasattr(target_user, 'blocked_reason'):
            raise HTTPException(status_code=500, detail="User object corrupted")
        
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
        
        # ✅ NULL CHECK: Запрашиваем пользователя
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # ✅ SAFETY CHECK: Убеждаемся что user объект корректен
        if not hasattr(target_user, 'is_blocked') or not hasattr(target_user, 'blocked_reason'):
            raise HTTPException(status_code=500, detail="User object corrupted")
        
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
    include_guests: bool = True,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список активных сессий (включая гостевые)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import GuestSession
        
        offset = (page - 1) * limit
        
        # Загружаем авторизованные сессии
        sessions = db.query(UserSession).offset(offset).limit(limit).all()
        total_sessions = db.query(UserSession).count()
        
        # Загружаем гостевые сессии
        guest_sessions = []
        total_guest_sessions = 0
        if include_guests:
            guest_sessions = db.query(GuestSession).filter(
                GuestSession.is_active == True
            ).all()
            total_guest_sessions = db.query(GuestSession).filter(
                GuestSession.is_active == True
            ).count()
        
        # Получаем все уникальные user_id из авторизованных сессий
        user_ids = {session.user_id for session in sessions if session.user_id}
        
        # Загружаем всех пользователей одним запросом (оптимизация N+1)
        users_dict = {}
        if user_ids:
            users = db.query(User).filter(User.id.in_(user_ids)).all()
            users_dict = {user.id: user for user in users}
        
        sessions_data = []
        
        # Добавляем авторизованные сессии
        for session in sessions:
            session_user = users_dict.get(session.user_id)
            sessions_data.append({
                'id': session.id,
                'user_id': session.user_id,
                'username': session_user.twitch_username if session_user else 'Unknown',
                'session_id': session.session_id,
                'created_at': session.created_at.isoformat() if session.created_at else None,
                'last_activity': session.last_activity.isoformat() if session.last_activity else None,
                'is_active': session.is_active,
                'is_guest': False
            })
        
        # Добавляем гостевые сессии
        for guest_session in guest_sessions:
            sessions_data.append({
                'id': f"guest_{guest_session.id}",
                'user_id': -1,
                'username': f"{guest_session.channel_name} (guest, {guest_session.platform})",
                'session_id': guest_session.session_id,
                'created_at': guest_session.created_at.isoformat() if guest_session.created_at else None,
                'last_activity': guest_session.last_activity.isoformat() if guest_session.last_activity else None,
                'is_active': guest_session.is_active,
                'is_guest': True
            })
        
        total_count = total_sessions + total_guest_sessions
        
        return {
            "success": True,
            "sessions": sessions_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_authenticated": total_sessions,
                "total_guest": total_guest_sessions,
                "pages": (total_count + limit - 1) // limit
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
        
        # ✅ NULL CHECK: Проверяем, не добавлен ли уже
        from core.database import WhitelistedChannel
        existing = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == username,
            WhitelistedChannel.platform == platform
        ).first()
        
        if existing:
            logger.warning(f"⚠️ WHITELIST: Попытка добавить уже существующий канал '{username}'")
            return JSONResponse(
                content={"success": False, "error": f"User {username} is already in whitelist"}, 
                status_code=400
            )
        
        # ✅ SAFETY: Добавляем в whitelist с обработкой ошибок
        try:
            whitelist_user = WhitelistedChannel(
                channel_name=username,
                platform=platform
            )
            if not whitelist_user:
                raise ValueError("Failed to create WhitelistedChannel object")
            
            db.add(whitelist_user)
            db.commit()
            db.refresh(whitelist_user)  # ✅ Обновляем объект из БД
        except Exception as db_error:
            db.rollback()
            logger.error(f"❌ WHITELIST: Error creating whitelist entry: {db_error}")
            raise
        
        # Инвалидируем кеш whitelist (передаем db для точной инвалидации кеша пользователей)
        from utils.whitelist_cache import invalidate_whitelist_cache
        invalidate_whitelist_cache(username, platform, db)
        
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
        for wl_entry in whitelist_users:
            whitelist_data.append({
                'id': wl_entry.id,
                'channel_name': wl_entry.channel_name,
                'platform': wl_entry.platform,
                'created_at': wl_entry.created_at.isoformat() if wl_entry.created_at else None
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
    platform: Optional[str] = Query(None, description="Platform to remove from (twitch or vk). If not specified, removes from all platforms."),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить пользователя из whitelist"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import WhitelistedChannel
        username = username.lower().strip()
        
        # Если указана платформа, удаляем только с неё
        if platform:
            platform = platform.lower().strip()
            if platform not in ("twitch", "vk"):
                return JSONResponse(content={"success": False, "error": "Invalid platform. Must be 'twitch' or 'vk'"}, status_code=400)
            
            whitelist_user = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == username,
                WhitelistedChannel.platform == platform
            ).first()
            
            if not whitelist_user:
                return JSONResponse(content={"success": False, "error": f"User {username} not found in whitelist for platform {platform}"}, status_code=404)
            
            db.delete(whitelist_user)
            db.commit()
            
            # Инвалидируем кеш whitelist (передаем db для точной инвалидации кеша пользователей)
            from utils.whitelist_cache import invalidate_whitelist_cache
            invalidate_whitelist_cache(username, platform, db)
            
            logger.info(f"🗑️ WHITELIST: Канал '{username}' удален из белого списка (платформа: {platform})")
            return JSONResponse(content={"success": True, "message": f"User {username} removed from whitelist (platform: {platform})"})
        else:
            # Если платформа не указана, удаляем все записи этого канала (для обратной совместимости)
            whitelist_users = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == username
            ).all()
            
            if not whitelist_users:
                return JSONResponse(content={"success": False, "error": f"User {username} not found in whitelist"}, status_code=404)
            
            platforms = []
            for wl_user in whitelist_users:
                platforms.append(wl_user.platform)
                db.delete(wl_user)
            
            db.commit()
            
            # Инвалидируем кеш для всех платформ (передаем db для точной инвалидации)
            from utils.whitelist_cache import invalidate_whitelist_cache
            for p in platforms:
                invalidate_whitelist_cache(username, p, db)
            
            logger.info(f"🗑️ WHITELIST: Канал '{username}' удален из белого списка (платформы: {', '.join(platforms)})")
            return JSONResponse(content={"success": True, "message": f"User {username} removed from whitelist (platforms: {', '.join(platforms)})"})
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
        
        # Проверяем готовность Twitch бота через наличие user_id (это устанавливается при event_ready)
        twitch_is_ready = False
        if bot_instance:
            twitch_is_ready = hasattr(bot_instance, 'user_id') and bot_instance.user_id is not None
        
        twitch_status = {
            "connected": bot_instance is not None,
            "channels": len(bot_instance.connected_channels) if bot_instance else 0,
            "is_ready": twitch_is_ready
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
        
        from constants import DEFAULT_TTS_SERVICE_URL
        import httpx
        
        tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{tts_service_url}/health", timeout=5.0)
                tts_data = response.json()
                
                # Определяем healthy на основе статуса ответа
                service_status = tts_data.get("status", "unknown")
                is_healthy = response.status_code == 200 and service_status in ["healthy", "ok", "up"]
                
            return {
                "success": True,
                "tts_service": {
                    "healthy": is_healthy,
                    "available": True,
                    "status": service_status,
                    "url": tts_service_url
                }
            }
        except Exception as e:
            return {
                "success": True,
                "tts_service": {
                    "healthy": False,
                    "available": False,
                    "error": str(e),
                    "status": "offline",
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
        
        # Сообщения за последние 24 часа и час
        day_ago = datetime.utcnow() - timedelta(days=1)
        hour_ago = datetime.utcnow() - timedelta(hours=1)
        messages_24h = db.query(ChatMessage).filter(
            ChatMessage.timestamp >= day_ago
        ).count()
        messages_1h = db.query(ChatMessage).filter(
            ChatMessage.timestamp >= hour_ago
        ).count()
        
        # Активные сессии
        active_sessions = db.query(UserSession).filter(
            UserSession.is_active == True
        ).count()
        
        # Подсчет активных интеграций
        from core.database import UserToken
        twitch_tokens = db.query(UserToken).filter(
            UserToken.platform == 'twitch',
            UserToken.is_active == True
        ).count()
        vk_tokens = db.query(UserToken).filter(
            UserToken.platform == 'vk',
            UserToken.is_active == True
        ).count()
        active_integrations = twitch_tokens + vk_tokens
        
        # Активные каналы через ConnectionManager
        from core.connection_manager import get_connection_manager
        connection_manager = get_connection_manager()
        active_channels = connection_manager.get_active_channels() if hasattr(connection_manager, 'get_active_channels') else []
        twitch_channels = [ch for ch in active_channels if not ch.isdigit()]
        vk_channels = [ch for ch in active_channels if ch.isdigit()]
        
        # TTS статистика
        tts_enabled_users = db.query(User).filter(User.tts_enabled == True).count()
        # Подсчитываем TTS-каналы из connection_manager
        tts_enabled_channels = len(connection_manager.tts_enabled_channels) if hasattr(connection_manager, 'tts_enabled_channels') else 0
        
        return {
            "success": True,
            "metrics": {
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "blocked": blocked_users
                },
                "messages": {
                    "last_24h": messages_24h,
                    "last_1h": messages_1h
                },
                "sessions": {
                    "active": active_sessions
                },
                "integrations": {
                    "active": active_integrations,
                    "twitch": twitch_tokens,
                    "vk": vk_tokens
                },
                "channels": {
                    "active": len(active_channels),
                    "twitch": len(twitch_channels),
                    "vk": len(vk_channels)
                },
                "tts": {
                    "enabled_channels": tts_enabled_channels,
                    "requests_24h": 0  # TODO: Добавить подсчет TTS запросов если есть таблица
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
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
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

@router.put("/voices/{voice_id}/settings")
async def update_voice_settings(
    voice_id: int,
    settings: dict = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить настройки голоса
    
    Для глобальных голосов: обновляет настройки самого голоса в TTS Service (reference_text, cfg_strength, speed_preset)
    Для пользовательских голосов: обновляет настройки в TTS Service
    Также создаёт/обновляет персональные настройки пользователя в bot_service (UserVoiceSettings)
    """
    try:
        # Проверяем права доступа (только админ может обновлять дефолты)
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from core.database import UserVoiceSettings
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        user_id = user['id']
        
        # Для глобальных голосов: обновляем сам голос в TTS Service (reference_text, cfg_strength, speed_preset)
        # Отправляем запрос в TTS Service для обновления настроек голоса
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.put(
                    f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/settings",
                    json=settings
                )
                if response.status_code == 200:
                    logger.info(f"✅ Voice {voice_id} settings updated in TTS Service")
                else:
                    logger.warning(f"⚠️ Failed to update voice {voice_id} in TTS Service: {response.status_code}")
        except Exception as e:
            logger.error(f"❌ Error updating voice in TTS Service: {e}")
        
        # Создаём/обновляем персональные настройки пользователя в bot_service
        voice_settings = db.query(UserVoiceSettings).filter(
            UserVoiceSettings.user_id == user_id,
            UserVoiceSettings.voice_id == voice_id
        ).first()
        
        if voice_settings:
            # Обновляем существующие настройки
            if 'cfg_strength' in settings:
                voice_settings.cfg_strength = settings['cfg_strength']
            if 'speed_preset' in settings:
                voice_settings.speed_preset = settings['speed_preset']
            if 'volume' in settings:
                voice_settings.volume = settings['volume']
            voice_settings.updated_at = datetime.utcnow()
        else:
            # Создаём новые настройки
            voice_settings = UserVoiceSettings(
                user_id=user_id,
                voice_id=voice_id,
                voice_name=settings.get('voice_name'),
                cfg_strength=settings.get('cfg_strength'),
                speed_preset=settings.get('speed_preset'),
                volume=settings.get('volume')
            )
            db.add(voice_settings)
        
        db.commit()
        db.refresh(voice_settings)
        
        logger.info(f"✅ Voice settings updated for user {user_id}, voice {voice_id}: {settings}")
        
        return {
            "status": "success",
            "message": "Настройки голоса обновлены",
            "settings": {
                "voice_id": voice_settings.voice_id,
                "cfg_strength": voice_settings.cfg_strength,
                "speed_preset": voice_settings.speed_preset,
                "volume": voice_settings.volume
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update voice settings error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обновления настроек: {str(e)}")

@router.post("/voices/test")
async def test_voice(
    voice_name: str = Body(...),
    user_id: int = Body(...),
    test_text: str = Body(...),
    cfg_strength: Optional[float] = Body(None),
    speed_preset: Optional[str] = Body(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Тестировать голос с заданным текстом и настройками (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут тестировать голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Проверяем, что user_id соответствует текущему пользователю
        if user.get('id') != user_id:
            raise HTTPException(status_code=403, detail="User ID mismatch")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Подготавливаем данные для FormData в TTS Service
        data = {
            'voice_name': voice_name,
            'user_id': str(user_id),
            'test_text': test_text,
        }
        if cfg_strength is not None:
            data['cfg_strength'] = str(cfg_strength)
        if speed_preset is not None:
            data['speed_preset'] = speed_preset
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/admin/voices/test",
                data=data
            )
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@router.get("/voices")
async def get_admin_voices(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех голосов (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут просматривать все голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        import httpx
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{TTS_SERVICE_URL}/api/admin/voices")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        # TTS сервис недоступен - возвращаем пустой список с предупреждением
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        logger.warning(f"TTS Service недоступен ({TTS_SERVICE_URL}): {e}. Возвращаю пустой список голосов.")
        return {
            "success": True,
            "voices": [],
            "global_voices": [],
            "user_voices": [],
            "warning": f"TTS сервис недоступен ({TTS_SERVICE_URL}). Убедитесь, что TTS сервис запущен.",
            "tts_service_url": TTS_SERVICE_URL
        }
    except Exception as e:
        logger.error(f"Get admin voices error: {e}", exc_info=True)
        # Для других ошибок тоже возвращаем пустой список вместо 500
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        return {
            "success": True,
            "voices": [],
            "global_voices": [],
            "user_voices": [],
            "warning": f"Ошибка подключения к TTS сервису: {str(e)}",
            "tts_service_url": TTS_SERVICE_URL
        }

@router.post("/voices/upload")
async def upload_voice_proxy(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Загрузить голос (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут загружать голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Читаем файл
        file_content = await file.read()
        file.seek(0)
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {
                'file': (file.filename, file_content, file.content_type)
            }
            data = {}
            if name:
                data['name'] = name
            
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/admin/voices/upload",
                files=files,
                data=data
            )
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upload voice: {str(e)}")

@router.delete("/voices/{voice_id}")
async def delete_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить голос (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут удалять голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete voice: {str(e)}")

@router.put("/voices/{voice_id}/rename")
async def rename_voice_proxy(
    voice_id: int,
    new_name: str = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Переименовать голос (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут переименовывать голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service (используем FormData как в оригинале)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.put(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/rename",
                data={'new_name': new_name}
            )
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rename voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to rename voice: {str(e)}")

@router.post("/voices/{voice_id}/transcribe")
async def transcribe_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Транскрибировать голос (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут транскрибировать голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service
        # Проверяем, есть ли такой endpoint в TTS Service
        # Если нет, используем retranscribe, который делает то же самое
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Попробуем найти endpoint для транскрибации в TTS Service
            # Если его нет, используем retranscribe
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/retranscribe")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcribe voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to transcribe voice: {str(e)}")

@router.post("/voices/{voice_id}/retranscribe")
async def retranscribe_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Перетранскрибировать голос (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут перетранскрибировать голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/retranscribe")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retranscribe voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retranscribe voice: {str(e)}")

@router.post("/voices/{voice_id}/toggle")
async def toggle_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Включить/выключить голос (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут включать/выключать голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/toggle")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to toggle voice: {str(e)}")

@router.get("/tts/stats")
async def get_tts_stats(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику TTS Service (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут просматривать статистику
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{TTS_SERVICE_URL}/api/admin/stats")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get TTS stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get TTS stats: {str(e)}")

@router.get("/tts/system/status")
async def get_tts_system_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус системы TTS Service (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут просматривать статус системы
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{TTS_SERVICE_URL}/api/admin/system/status")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get TTS system status error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get TTS system status: {str(e)}")

@router.post("/tts/system/restart")
async def restart_tts_system(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Перезапустить TTS Service (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут перезапускать систему
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        from constants import DEFAULT_TTS_SERVICE_URL
        TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        import httpx
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/system/restart")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restart TTS system error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to restart TTS system: {str(e)}")
