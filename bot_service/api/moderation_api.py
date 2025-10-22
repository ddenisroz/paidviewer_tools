# bot_service/api/moderation_api.py
"""API РґР»СЏ РјРѕРґРµСЂР°С†РёРё РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РІ С‡Р°С‚Рµ"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db, TTSBlockedUser, User
from auth.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/moderation", tags=["moderation"])


def is_user_blocked_from_tts(channel_name: str, platform: str, username: str) -> bool:
    """
    Проверить, заблокирован ли пользователь от TTS в данном канале
    
    Args:
        channel_name: Имя канала
        platform: Платформа ('twitch' или 'vk')
        username: Имя пользователя (без @)
    
    Returns:
        True если пользователь заблокирован, False иначе
    """
    try:
        from core.database import SessionLocal
        
        db = SessionLocal()
        try:
            blocked = db.query(TTSBlockedUser).filter(
                TTSBlockedUser.channel_name == channel_name.lower(),
                TTSBlockedUser.platform == platform.lower(),
                TTSBlockedUser.username == username.lower()
            ).first()
            
            return blocked is not None
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error checking if user is blocked from TTS: {e}")
        return False  # В случае ошибки не блокируем пользователя


class ToggleMuteRequest(BaseModel):
    username: str
    platform: str  # 'twitch' or 'vk'
    channel_name: str
    duration_seconds: Optional[int] = 600  # РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 10 РјРёРЅСѓС‚ РґР»СЏ РїР»Р°С‚С„РѕСЂРјРµРЅРЅРѕРіРѕ РјСѓС‚Р°
    reason: Optional[str] = "Р—Р°РіР»СѓС€РµРЅ РјРѕРґРµСЂР°С‚РѕСЂРѕРј"


class MuteStatusResponse(BaseModel):
    success: bool
    action: str  # 'muted' or 'unmuted'
    username: str
    platform: str
    platform_mute_applied: bool = False  # РџСЂРёРјРµРЅС‘РЅ Р»Рё РјСѓС‚ РЅР° РїР»Р°С‚С„РѕСЂРјРµ (Twitch timeout)
    message: str


@router.post("/toggle-mute", response_model=MuteStatusResponse)
async def toggle_mute_user(
    request: ToggleMuteRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Р—Р°РіР»СѓС€РёС‚СЊ/СЂР°Р·РіР»СѓС€РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ TTS
    
    - РџРµСЂРµРєР»СЋС‡Р°РµС‚ СЃС‚Р°С‚СѓСЃ РІ С‚Р°Р±Р»РёС†Рµ TTSBlockedUser (РІРЅСѓС‚СЂРµРЅРЅРёР№ РјСѓС‚)
    - Р”Р»СЏ Twitch: РїСЂРёРјРµРЅСЏРµС‚ timeout/untimeout РЅР° РїР»Р°С‚С„РѕСЂРјРµ
    - Р”Р»СЏ VK Live: С‚РѕР»СЊРєРѕ РІРЅСѓС‚СЂРµРЅРЅРёР№ РјСѓС‚ (API РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ timeout)
    """
    try:
        user_id = current_user.get('id')
        username = request.username.lower().strip('@')
        platform = request.platform.lower()
        channel_name = request.channel_name.lower()
        
        logger.info(f"рџ”‡ [MODERATION] Toggle mute request: user={username}, platform={platform}, channel={channel_name}")
        
        # РџСЂРѕРІРµСЂСЏРµРј, Р·Р°РіР»СѓС€С‘РЅ Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІ РґР°РЅРЅС‹Р№ РјРѕРјРµРЅС‚
        existing_block = db.query(TTSBlockedUser).filter(
            TTSBlockedUser.user_id == user_id,
            TTSBlockedUser.username == username,
            TTSBlockedUser.platform == platform,
            TTSBlockedUser.channel_name == channel_name
        ).first()
        
        platform_mute_applied = False
        
        if existing_block:
            # Р РђР—РњРЈРўРРўР¬
            logger.info(f"рџ”Љ [MODERATION] Unmuting user {username} on {platform}")
            
            db.delete(existing_block)
            db.commit()
            
            # Р”Р»СЏ Twitch - СЃРЅРёРјР°РµРј timeout РЅР° РїР»Р°С‚С„РѕСЂРјРµ
            if platform == 'twitch':
                try:
                    from api.twitch_api import TwitchAPI
                    from core.connection_manager import get_connection_manager
                    
                    connection_manager = get_connection_manager()
                    twitch_api = TwitchAPI(connection_manager)
                    
                    success = await twitch_api.untimeout_user(user_id, channel_name, username, db=db)
                    platform_mute_applied = success
                    
                    if success:
                        logger.info(f"вњ… [TWITCH] Timeout removed for {username} in {channel_name}")
                    else:
                        logger.warning(f"вљ пёЏ [TWITCH] Failed to remove timeout for {username}")
                except Exception as e:
                    logger.error(f"вќЊ [TWITCH] Error removing timeout: {e}")
            
            return MuteStatusResponse(
                success=True,
                action="unmuted",
                username=username,
                platform=platform,
                platform_mute_applied=platform_mute_applied,
                message=f"РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ {username} СЂР°Р·РіР»СѓС€РµРЅ"
            )
        
        else:
            # Р—РђРњРЈРўРРўР¬
            logger.info(f"рџ”‡ [MODERATION] Muting user {username} on {platform}")
            
            new_block = TTSBlockedUser(
                user_id=user_id,
                username=username,
                platform=platform,
                channel_name=channel_name,
                blocked_by=user_id,
                reason=request.reason
            )
            
            db.add(new_block)
            db.commit()
            
            # Р”Р»СЏ Twitch - РїСЂРёРјРµРЅСЏРµРј timeout РЅР° РїР»Р°С‚С„РѕСЂРјРµ
            if platform == 'twitch':
                try:
                    from api.twitch_api import TwitchAPI
                    from core.connection_manager import get_connection_manager
                    
                    connection_manager = get_connection_manager()
                    twitch_api = TwitchAPI(connection_manager)
                    
                    success = await twitch_api.timeout_user(
                        user_id, 
                        channel_name, 
                        username, 
                        request.duration_seconds,
                        request.reason,
                        db=db
                    )
                    platform_mute_applied = success
                    
                    if success:
                        logger.info(f"вњ… [TWITCH] Timeout applied for {username} ({request.duration_seconds}s)")
                    else:
                        logger.warning(f"вљ пёЏ [TWITCH] Failed to apply timeout for {username}")
                except Exception as e:
                    logger.error(f"вќЊ [TWITCH] Error applying timeout: {e}")
            
            # VK Live РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ timeout С‡РµСЂРµР· API
            elif platform == 'vk':
                logger.info(f"в„№пёЏ [VK LIVE] Platform timeout not available, only internal TTS mute applied")
            
            return MuteStatusResponse(
                success=True,
                action="muted",
                username=username,
                platform=platform,
                platform_mute_applied=platform_mute_applied,
                message=f"РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ {username} Р·Р°РіР»СѓС€РµРЅ"
            )
        
    except Exception as e:
        logger.error(f"вќЊ [MODERATION] Error toggling mute: {e}")
        raise HTTPException(status_code=500, detail=f"РћС€РёР±РєР° РёР·РјРµРЅРµРЅРёСЏ СЃС‚Р°С‚СѓСЃР° РјСѓС‚Р°: {str(e)}")


@router.get("/muted-users")
async def get_muted_users(
    platform: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє Р·Р°РіР»СѓС€С'РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№"""
    try:
        user_id = current_user.get('id')
        
        query = db.query(TTSBlockedUser).filter(TTSBlockedUser.user_id == user_id)
        
        if platform:
            query = query.filter(TTSBlockedUser.platform == platform.lower())
        
        blocked_users = query.all()
        
        return {
            "success": True,
            "blocked_users": [
                {
                    "id": user.id,
                    "username": user.username,
                    "platform": user.platform,
                    "channel_name": user.channel_name,
                    "blocked_at": user.blocked_at.isoformat() if user.blocked_at else None,
                    "reason": user.reason
                }
                for user in blocked_users
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting muted users: {e}")
        raise HTTPException(status_code=500, detail=str(e))
