# bot_service/api/moderation_api.py
"""API для модерации чатов и управления пользователями"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from core.database import get_db, User, UserToken
from auth.auth import get_current_user

logger = logging.getLogger('bot_service')

router = APIRouter(prefix="/api/moderation", tags=["moderation"])

# ===== Pydantic Models =====

class TTSBlockRequest(BaseModel):
    """Запрос на блокировку/разблокировку TTS для пользователя"""
    username: str
    platform: str  # 'twitch' or 'vk'
    channel_name: str

class TimeoutRequest(BaseModel):
    """Запрос на таймаут пользователя"""
    username: str
    user_id: Optional[str] = None  # ID пользователя на платформе
    platform: str  # 'twitch' or 'vk'
    channel_name: str
    duration: int = 600  # Длительность в секундах (по умолчанию 10 минут)
    reason: Optional[str] = None

class BanRequest(BaseModel):
    """Запрос на бан пользователя"""
    username: str
    user_id: Optional[str] = None  # ID пользователя на платформе
    platform: str  # 'twitch' or 'vk'
    channel_name: str
    reason: Optional[str] = None

class RoleRequest(BaseModel):
    """Запрос на изменение роли пользователя"""
    username: str
    user_id: Optional[str] = None  # ID пользователя на платформе
    platform: str  # 'twitch' or 'vk'
    channel_name: str
    role: str  # 'moderator', 'vip', 'founder' (Twitch) | 'moderator' (VK)
    action: str  # 'add' or 'remove'

class BlockedUser(BaseModel):
    """Модель заблокированного пользователя"""
    username: str
    platform: str
    channel_name: str
    blocked_at: str

# ===== In-Memory Storage (можно заменить на БД) =====
# Ключ: (channel_name, platform, username)
tts_blocked_users: dict = {}

def is_user_blocked_from_tts(channel_name: str, platform: str, username: str) -> bool:
    """Проверяет, заблокирован ли пользователь для TTS"""
    key = (channel_name.lower(), platform.lower(), username.lower())
    return key in tts_blocked_users

def block_user_from_tts(channel_name: str, platform: str, username: str):
    """Блокирует пользователя от использования TTS"""
    from datetime import datetime
    key = (channel_name.lower(), platform.lower(), username.lower())
    tts_blocked_users[key] = {
        'username': username,
        'platform': platform,
        'channel_name': channel_name,
        'blocked_at': datetime.utcnow().isoformat()
    }
    logger.info(f"🚫 User {username} blocked from TTS on {platform} channel {channel_name}")

def unblock_user_from_tts(channel_name: str, platform: str, username: str):
    """Разблокирует пользователя для использования TTS"""
    key = (channel_name.lower(), platform.lower(), username.lower())
    if key in tts_blocked_users:
        del tts_blocked_users[key]
        logger.info(f"✅ User {username} unblocked from TTS on {platform} channel {channel_name}")
        return True
    return False

# ===== API Endpoints =====

@router.post("/tts/block")
async def block_user_tts(
    request: TTSBlockRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Заблокировать пользователя от использования TTS"""
    try:
        # Проверяем права: пользователь должен быть владельцем канала или админом
        if not current_user.get("is_admin"):
            # Проверяем, что текущий пользователь - владелец канала
            user = db.query(User).filter(User.id == current_user["id"]).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Проверка владения каналом
            user_channel = None
            if request.platform == 'twitch':
                # Получаем Twitch username из токенов
                twitch_token = db.query(UserToken).filter(
                    UserToken.user_id == user.id,
                    UserToken.platform == 'twitch'
                ).first()
                # Получаем имя канала через Twitch API
                user_channel = None
                if twitch_token:
                    try:
                        from api.twitch_api import TwitchAPI
                        from core.connection_manager import get_connection_manager
                        connection_manager = get_connection_manager()
                        twitch_api = TwitchAPI(connection_manager)
                        user_info = await twitch_api.get_user_by_id(twitch_token.platform_user_id)
                        if user_info and user_info.get('login'):
                            user_channel = user_info['login']
                    except Exception as e:
                        logger.error(f"Error getting Twitch user info: {e}")
            elif request.platform == 'vk':
                # Получаем VK username из токенов
                vk_token = db.query(UserToken).filter(
                    UserToken.user_id == user.id,
                    UserToken.platform == 'vk'
                ).first()
                # Для VK пока используем platform_user_id как имя канала
                user_channel = vk_token.platform_user_id if vk_token else None
            
            if not user_channel or user_channel.lower() != request.channel_name.lower():
                raise HTTPException(status_code=403, detail="You don't have permission to moderate this channel")
        
        block_user_from_tts(request.channel_name, request.platform, request.username)
        
        return {
            "success": True,
            "message": f"User {request.username} blocked from TTS on {request.platform}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking user from TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tts/unblock")
async def unblock_user_tts(
    request: TTSBlockRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Разблокировать пользователя для использования TTS"""
    try:
        # Проверяем права (аналогично block)
        if not current_user.get("is_admin"):
            user = db.query(User).filter(User.id == current_user["id"]).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_channel = None
            if request.platform == 'twitch':
                user_channel = user.twitch_name
            elif request.platform == 'vk':
                user_channel = user.vk_username
            
            if not user_channel or user_channel.lower() != request.channel_name.lower():
                raise HTTPException(status_code=403, detail="You don't have permission to moderate this channel")
        
        success = unblock_user_from_tts(request.channel_name, request.platform, request.username)
        
        if not success:
            return {
                "success": False,
                "message": f"User {request.username} was not blocked"
            }
        
        return {
            "success": True,
            "message": f"User {request.username} unblocked from TTS on {request.platform}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking user from TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tts/blocked")
async def get_blocked_users_tts(
    channel_name: str,
    platform: str,
    current_user: dict = Depends(get_current_user)
):
    """Получить список заблокированных пользователей для TTS"""
    try:
        blocked = []
        for key, data in tts_blocked_users.items():
            ch_name, plat, username = key
            if ch_name == channel_name.lower() and plat == platform.lower():
                blocked.append(BlockedUser(**data))
        
        return {
            "success": True,
            "blocked_users": [b.dict() for b in blocked]
        }
    
    except Exception as e:
        logger.error(f"Error getting blocked users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/timeout")
async def timeout_user(
    request: TimeoutRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Выдать таймаут пользователю"""
    from main import bot_instance, vk_live_bot_instance
    
    try:
        # Проверяем права
        if not current_user.get("is_admin"):
            user = db.query(User).filter(User.id == current_user["id"]).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_channel = None
            if request.platform == 'twitch':
                user_channel = user.twitch_name
            elif request.platform == 'vk':
                user_channel = user.vk_username
            
            if not user_channel or user_channel.lower() != request.channel_name.lower():
                raise HTTPException(status_code=403, detail="You don't have permission to moderate this channel")
        
        # Выполняем таймаут в зависимости от платформы
        success = False
        if request.platform == 'twitch':
            if bot_instance:
                # Twitch timeout через TwitchIO
                try:
                    channel = bot_instance.get_channel(request.channel_name)
                    if channel:
                        await channel.timeout(request.username, duration=request.duration, reason=request.reason)
                        success = True
                except Exception as e:
                    logger.error(f"Twitch timeout error: {e}")
            
        elif request.platform == 'vk':
            if vk_live_bot_instance and request.user_id:
                # VK Live mute через API
                success = await vk_live_bot_instance.mute_user(
                    request.channel_name,
                    int(request.user_id),
                    request.duration
                )
        
        if success:
            return {
                "success": True,
                "message": f"User {request.username} timed out for {request.duration} seconds"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to timeout user")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error timing out user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ban")
async def ban_user(
    request: BanRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Забанить пользователя"""
    from main import bot_instance, vk_live_bot_instance
    
    try:
        # Проверяем права
        if not current_user.get("is_admin"):
            user = db.query(User).filter(User.id == current_user["id"]).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_channel = None
            if request.platform == 'twitch':
                user_channel = user.twitch_name
            elif request.platform == 'vk':
                user_channel = user.vk_username
            
            if not user_channel or user_channel.lower() != request.channel_name.lower():
                raise HTTPException(status_code=403, detail="You don't have permission to moderate this channel")
        
        # Выполняем бан
        success = False
        if request.platform == 'twitch':
            if bot_instance:
                try:
                    channel = bot_instance.get_channel(request.channel_name)
                    if channel:
                        await channel.ban(request.username, reason=request.reason)
                        success = True
                except Exception as e:
                    logger.error(f"Twitch ban error: {e}")
            
        elif request.platform == 'vk':
            if vk_live_bot_instance and request.user_id:
                success = await vk_live_bot_instance.ban_user(
                    request.channel_name,
                    int(request.user_id),
                    duration=0  # Permanent ban
                )
        
        if success:
            return {
                "success": True,
                "message": f"User {request.username} banned"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to ban user")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error banning user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/role")
async def manage_user_role(
    request: RoleRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Управление ролями пользователя (VIP, Moderator)"""
    from main import bot_instance
    from api.twitch_api import twitch_api
    
    try:
        # Проверяем права
        if not current_user.get("is_admin"):
            user = db.query(User).filter(User.id == current_user["id"]).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_channel = None
            if request.platform == 'twitch':
                user_channel = user.twitch_name
            elif request.platform == 'vk':
                user_channel = user.vk_username
            
            if not user_channel or user_channel.lower() != request.channel_name.lower():
                raise HTTPException(status_code=403, detail="You don't have permission to moderate this channel")
        
        # Управление ролями
        success = False
        if request.platform == 'twitch':
            # Получаем broadcaster_id и user_id для Twitch API
            user = db.query(User).filter(User.id == current_user["id"]).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            from core.database import UserToken
            twitch_token = db.query(UserToken).filter(
                UserToken.user_id == user.id,
                UserToken.platform == 'twitch'
            ).first()
            
            if not twitch_token:
                raise HTTPException(status_code=400, detail="Twitch token not found")
            
            # Получаем broadcaster_id
            broadcaster_data = await twitch_api.get_user_from_token(twitch_token.access_token)
            if not broadcaster_data:
                raise HTTPException(status_code=400, detail="Failed to get broadcaster data")
            
            broadcaster_id = broadcaster_data['id']
            
            # Получаем user_id целевого пользователя
            if request.user_id:
                target_user_id = request.user_id
            else:
                # Ищем по username
                target_user_data = await twitch_api.get_user_by_username(request.username, twitch_token.access_token)
                if not target_user_data:
                    raise HTTPException(status_code=404, detail=f"User {request.username} not found")
                target_user_id = target_user_data['id']
            
            # Выполняем действие с ролью
            if request.role == 'moderator':
                if request.action == 'add':
                    success = await twitch_api.add_channel_moderator(
                        broadcaster_id,
                        target_user_id,
                        twitch_token.access_token
                    )
                elif request.action == 'remove':
                    success = await twitch_api.remove_channel_moderator(
                        broadcaster_id,
                        target_user_id,
                        twitch_token.access_token
                    )
            
            elif request.role == 'vip':
                if request.action == 'add':
                    success = await twitch_api.add_channel_vip(
                        broadcaster_id,
                        target_user_id,
                        twitch_token.access_token
                    )
                elif request.action == 'remove':
                    success = await twitch_api.remove_channel_vip(
                        broadcaster_id,
                        target_user_id,
                        twitch_token.access_token
                    )
        
        elif request.platform == 'vk':
            # VK Live роли (если поддерживаются API)
            raise HTTPException(status_code=501, detail="VK Live role management not implemented yet")
        
        if success:
            action_text = "добавлена" if request.action == 'add' else "удалена"
            return {
                "success": True,
                "message": f"Роль {request.role} {action_text} для {request.username}"
            }
        else:
            raise HTTPException(status_code=500, detail=f"Failed to {request.action} role {request.role}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error managing user role: {e}")
        raise HTTPException(status_code=500, detail=str(e))





