# bot_service/api/guest_api.py
"""API для гостевого доступа к каналам"""
import asyncio
import logging
import random
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from core.session_manager import session_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat/guest", tags=["guest"])

# In-memory хранилище кодов верификации
guest_verification_codes = {}

class GuestConnectRequest(BaseModel):
    channel_name: str
    platform: str  # 'twitch' или 'vk'

class GuestVerifyRequest(BaseModel):
    channel_name: str

# === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
# 
# ❌ УДАЛЕНО: _normalize_channel_name() - платформа теперь выбирается пользователем явно в UI!

def _check_code_expired(channel_name: str) -> dict:
    """
    Проверяет существование и валидность кода
    
    Returns:
        stored_data dict
        
    Raises:
        HTTPException если код не найден или истек
    """
    if channel_name not in guest_verification_codes:
        raise HTTPException(status_code=404, detail="No verification request found")
    
    stored_data = guest_verification_codes[channel_name]
    
    if datetime.utcnow() > stored_data["expires_at"]:
        del guest_verification_codes[channel_name]
        raise HTTPException(status_code=408, detail="Verification code expired")
    
    return stored_data

@router.post("/connect")
async def guest_connect(request: GuestConnectRequest):
    """Генерация кода для гостевого доступа владельца канала"""
    try:
        # ✅ Валидация платформы
        if request.platform not in ['twitch', 'vk']:
            raise HTTPException(status_code=400, detail="Platform must be 'twitch' or 'vk'")
        
        # ✅ Нормализуем имя канала (без определения платформы - она уже есть)
        channel_name = request.channel_name.strip().lower()
        if not channel_name:
            raise HTTPException(status_code=400, detail="Channel name is required")
        
        platform = request.platform  # ✅ Используем платформу от клиента
        
        # ПРОВЕРКА: Заблокирован ли канал?
        from core.database import get_db, SessionLocal
        from api.admin_api import is_channel_blocked
        db = SessionLocal()
        try:
            is_blocked, reason = is_channel_blocked(channel_name, db)
            if is_blocked:
                logger.warning(f"🚫 Blocked channel attempted to connect: {channel_name} ({platform}) (reason: {reason})")
                raise HTTPException(
                    status_code=403,
                    detail=f"This channel is blocked. Reason: {reason or 'No reason provided'}"
                )
        finally:
            db.close()
        
        # Генерируем 6-значный код
        code = ''.join(random.choices(string.digits, k=6))
        expires_at = datetime.utcnow() + timedelta(minutes=1)
        
        # Сохраняем код (с платформой!)
        guest_verification_codes[channel_name] = {
            "code": code,
            "expires_at": expires_at,
            "confirmed": False,
            "platform": platform  # ✅ Сохраняем платформу
        }
        
        # ВАЖНО: Подключаем бота к каналу для прослушки
        if platform == 'twitch':
            from main import bot_instance
            if bot_instance:
                try:
                    logger.info(f"🔌 Connecting Twitch bot to {channel_name} for guest verification...")
                    await bot_instance.join_channel(channel_name)
                    logger.info(f"✅ Twitch bot connected to {channel_name}")
                except Exception as e:
                    logger.error(f"❌ Failed to connect Twitch bot to {channel_name}: {e}", exc_info=True)
            else:
                logger.warning(f"⚠️ Twitch bot not available (bot_instance is None)")
        elif platform == 'vk':
            from main import vk_live_bot_instance
            if vk_live_bot_instance:
                # VK бот уже слушает все каналы через streaming API
                logger.info(f"🎧 VK bot ready to listen {channel_name}")
            else:
                logger.warning(f"⚠️ VK bot not available")
        
        logger.info(f"✅ Guest code generated: {channel_name} ({platform}) -> {code}")
        
        return {
            "success": True,
            "verification_code": code,
            "channel_name": channel_name,
            "platform": platform,
            "expires_in_seconds": 60
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in guest connect: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/check")
async def guest_check(request: GuestVerifyRequest):
    """Проверка подтверждения кода владельцем (для polling)"""
    try:
        # ✅ Нормализуем имя канала (платформа будет в stored_data)
        channel_name = request.channel_name.strip().lower()
        
        # Проверяем наличие кода (без HTTPException)
        if channel_name not in guest_verification_codes:
            logger.debug(f"No verification request found for {channel_name}")
            return {
                "success": False,
                "confirmed": False,
                "error": "No verification request found"
            }
        
        stored_data = guest_verification_codes[channel_name]
        
        # Проверяем срок действия
        if datetime.utcnow() > stored_data["expires_at"]:
            logger.info(f"Verification code expired for {channel_name}")
            del guest_verification_codes[channel_name]
            return {
                "success": False,
                "confirmed": False,
                "error": "Verification code expired"
            }
        
        # Проверяем подтверждение
        if stored_data.get("confirmed", False):
            return {
                "success": True,
                "confirmed": True,
                "message": "Code confirmed by channel owner"
            }
        
        # Код еще не подтвержден
        remaining_seconds = int((stored_data["expires_at"] - datetime.utcnow()).total_seconds())
        return {
            "success": True,
            "confirmed": False,
            "remaining_seconds": remaining_seconds
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in guest check: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/disconnect")
async def guest_disconnect(request: GuestVerifyRequest):
    """Отключение гостевого режима и очистка кода верификации"""
    try:
        # ✅ Нормализуем имя канала
        channel_name = request.channel_name.strip().lower()
        
        # ✅ Получаем платформу из сохранённого кода (если есть)
        platform = None
        if channel_name in guest_verification_codes:
            platform = guest_verification_codes[channel_name].get('platform', 'twitch')
            del guest_verification_codes[channel_name]
            logger.info(f"🗑️ [GUEST] Removed verification code for {channel_name} ({platform})")
        
        # Отключаем бота от канала
        try:
            from main import bot_instance, vk_live_bot_instance
        except ImportError:
            logger.warning("Bot instances not available for disconnect")
            bot_instance = None
            vk_live_bot_instance = None
        
        if platform == 'twitch' and bot_instance:
            try:
                await bot_instance.leave_channel(channel_name)
                logger.info(f"✅ [GUEST] Disconnected Twitch bot from {channel_name}")
            except Exception as e:
                logger.error(f"Failed to disconnect Twitch bot: {e}")
        elif platform == 'vk' and vk_live_bot_instance:
            try:
                await vk_live_bot_instance.disconnect_from_channel(channel_name)
                logger.info(f"✅ [GUEST] Disconnected VK bot from {channel_name}")
            except Exception as e:
                logger.error(f"Failed to disconnect VK bot: {e}")
        
        return {
            "success": True,
            "message": "Guest mode disconnected"
        }
        
    except Exception as e:
        logger.error(f"Error in guest disconnect: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/finalize")
async def guest_finalize(request: GuestVerifyRequest, http_request: Request):
    """Создание гостевой сессии после подтверждения кода"""
    try:
        # ✅ Нормализуем имя канала
        channel_name = request.channel_name.strip().lower()
        stored_data = _check_code_expired(channel_name)
        
        # ✅ Получаем платформу из сохранённого кода
        platform = stored_data.get("platform", "twitch")
        
        # Проверяем что код подтвержден владельцем
        if not stored_data.get("confirmed", False):
            raise HTTPException(status_code=403, detail="Code not confirmed by channel owner")
        
        # Удаляем использованный код
        del guest_verification_codes[channel_name]
        
        # Проверяем есть ли уже активная гостовая сессия для этого канала
        device_info = {
            "user_agent": http_request.headers.get("user-agent"),
            "ip": getattr(http_request.client, 'host', 'unknown'),
            "monitored_channel": channel_name,
            "platform": platform,
            "guest_mode": True
        }
        
        # Ищем существующую гостевую сессию для этого канала
        existing_session = None
        try:
            from core.database import SessionLocal, UserSession
            db = SessionLocal()
            existing_session = db.query(UserSession).filter(
                UserSession.user_id == -1,
                UserSession.is_active == True,
                UserSession.device_info.contains({"monitored_channel": channel_name})
            ).first()
            db.close()
        except Exception as e:
            logger.warning(f"Error checking existing guest session: {e}")
        
        if existing_session:
            # Обновляем существующую сессию
            logger.info(f"🔄 Updating existing guest session for {channel_name}")
            session_manager.update_session(existing_session.id, device_info=device_info)
            session_id = existing_session.id
        else:
            # Создаем новую гостевую сессию
            session_id = session_manager.create_session(user_id=-1, device_info=device_info)
            logger.info(f"✅ New guest session created: {channel_name} ({platform}) -> {session_id}")
            
            # Создаем настройки для гостя
            try:
                from core.database import SessionLocal, UserSettings, TTSUserSettings
                db = SessionLocal()
                
                # Создаем UserSettings для гостя
                guest_user_settings = UserSettings(session_id=session_id)
                db.add(guest_user_settings)
                
                # Создаем TTSUserSettings для гостя
                guest_tts_settings = TTSUserSettings(session_id=session_id)
                db.add(guest_tts_settings)
                
                db.commit()
                logger.info(f"✅ Guest settings created for session {session_id}")
                db.close()
            except Exception as e:
                logger.error(f"❌ Failed to create guest settings: {e}")
                if 'db' in locals():
                    db.close()
        
        # Подключаем бота к каналу для TTS (если еще не подключен)
        if platform == 'twitch':
            from main import bot_instance
            logger.info(f"🔍 [GUEST_FINALIZE] Checking bot connection for {channel_name}")
            logger.info(f"🔍 [GUEST_FINALIZE] Bot instance available: {bot_instance is not None}")
            
            if bot_instance:
                try:
                    # Получаем список подключенных каналов
                    connected_channel_names = [ch.name for ch in bot_instance.connected_channels]
                    logger.info(f"🔍 [GUEST_FINALIZE] Currently connected channels: {connected_channel_names}")
                    
                    # Проверяем, подключен ли уже бот к каналу
                    if channel_name not in connected_channel_names:
                        logger.info(f"🔌 [GUEST_FINALIZE] Connecting Twitch bot to {channel_name} for TTS...")
                        await bot_instance.join_channel(channel_name)
                        logger.info(f"✅ [GUEST_FINALIZE] Twitch bot connected to {channel_name} for TTS")
                        
                        # Проверяем подключение после join_channel
                        await asyncio.sleep(1)  # Даем время на подключение
                        new_connected_channels = [ch.name for ch in bot_instance.connected_channels]
                        logger.info(f"🔍 [GUEST_FINALIZE] Channels after join: {new_connected_channels}")
                    else:
                        logger.info(f"✅ [GUEST_FINALIZE] Twitch bot already connected to {channel_name}")
                except Exception as e:
                    logger.error(f"❌ [GUEST_FINALIZE] Failed to connect Twitch bot to {channel_name}: {e}", exc_info=True)
            else:
                logger.warning(f"⚠️ [GUEST_FINALIZE] Twitch bot not available for TTS")
        
        response = JSONResponse(content={
            "success": True,
            "message": "Guest session created successfully",
            "channel_name": channel_name
        })
        
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            samesite="lax",
            max_age=86400 * 7
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in guest finalize: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# === ФУНКЦИЯ ДЛЯ БОТОВ ===

def confirm_guest_code(channel_name: str, code: str, username: str, is_owner: bool) -> bool:
    """
    Подтверждение гостевого кода владельцем канала
    Вызывается ботом при получении сообщения в чате
    
    Returns:
        True если код успешно подтвержден
    """
    channel_name = channel_name.strip().lower()
    code = code.strip()
    
    logger.info(f"🔍 [GUEST_CODE] Checking: channel={channel_name}, code={code}, user={username}, is_owner={is_owner}")
    
    # Проверяем наличие pending кода
    if channel_name not in guest_verification_codes:
        logger.info(f"❌ [GUEST_CODE] No pending code for channel {channel_name}")
        logger.info(f"📋 [GUEST_CODE] Active channels: {list(guest_verification_codes.keys())}")
        return False
    
    stored_data = guest_verification_codes[channel_name]
    
    # Проверяем срок действия
    if datetime.utcnow() > stored_data["expires_at"]:
        logger.info(f"[GUEST_CODE] Code expired for {channel_name}")
        del guest_verification_codes[channel_name]
        return False
    
    # Проверяем совпадение кода
    if stored_data["code"] != code:
        logger.info(f"❌ [GUEST_CODE] Code mismatch: got '{code}', expected '{stored_data['code']}'")
        return False
    
    # БЕЗОПАСНОСТЬ: только owner может подтвердить
    if not is_owner:
        logger.warning(f"⚠️ [GUEST_CODE] Rejected: {username} is not owner of {channel_name}")
        return False
    
    # Подтверждаем код
    stored_data["confirmed"] = True
    logger.info(f"✅ [GUEST_CODE] CONFIRMED: {channel_name} by {username}")
    return True

