# bot_service/api/tts_api_unified.py
"""
Объединенный TTS API
Содержит все endpoints для работы с TTS:
- Базовые настройки TTS
- Управление голосами
- Локальный TTS движок
- Очередь и синтез
"""
import os
import aiohttp
import httpx
import requests
import logging
import time
import re
import zipfile
import shutil
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, validator
from fastapi import APIRouter, Depends, HTTPException, Request, Form, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

# Core imports
from core.database import get_db, User, WhitelistedChannel, LocalTTSEndpoint
from auth.auth import get_current_user, get_current_user_optional
from constants import DEFAULT_TTS_SERVICE_URL

# Services
from services.tts_manager import get_tts_manager
from services.tts_service import TTSService
from services.user_identity_service import UserIdentityService, UserType
from services.memory_tts_queue import memory_tts_queue
from services.memory_websocket_manager import memory_websocket_manager
from services.advanced_rate_limiter import advanced_rate_limiter as database_rate_limiter

# Utils
from utils.enhanced_logger import log_request, log_response, tts_logger

logger = logging.getLogger('bot_service')

# ============================================================================
# ROUTERS
# ============================================================================

tts_router = APIRouter(prefix="/api/tts", tags=["tts"])
voices_router = APIRouter(prefix="/api/voices", tags=["voices"])
user_voices_router = APIRouter(prefix="/api/user/voices", tags=["user_voices"])
local_tts_router = APIRouter(prefix="/api/local-tts", tags=["local-tts"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class FilteredWord(BaseModel):
    id: Optional[int] = None
    word: str
    platform: str  # 'all', 'twitch', 'vk'
    created_at: Optional[str] = None

class AddWordRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    platform: str = Field('all', pattern="^(twitch|vk|all)$")
    
    @validator('word')
    def sanitize_word_field(cls, v):
        if not v:
            return v
        clean_word = re.sub(r'<[^>]+>', '', v)
        clean_word = re.sub(r'[<>]', '', clean_word)
        return clean_word.strip().lower()

class AudioSettingsRequest(BaseModel):
    websiteVolume: int = Field(..., ge=0, le=100)

class TtsSettingsRequest(BaseModel):
    enable7TV: bool = Field(True)
    enableTwitch: bool = Field(True)
    enableLexiconFilter: bool = Field(True)
    enableCustomLexicon: bool = Field(False)
    engine: str = Field('gtts')
    voice: str = Field('female_1')
    listeningMode: str = Field('website')
    maxMessageLength: int = Field(500, ge=50, le=2000)
    skipCommands: bool = Field(True)
    useLocalTTS: bool = Field(False)
    
    @validator('engine')
    def validate_engine(cls, v):
        if v not in ['gtts', 'f5tts']:
            raise ValueError('engine must be either "gtts" or "f5tts"')
        return v
    
    @validator('listeningMode')
    def validate_listening_mode(cls, v):
        if v not in ['website', 'obs']:
            raise ValueError('listeningMode must be either "website" or "obs"')
        return v

class BlockUserRequest(BaseModel):
    channel_name: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(..., pattern="^(twitch|vk)$")
    username: str = Field(..., min_length=1, max_length=100)

class UnblockUserRequest(BaseModel):
    channel_name: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(..., pattern="^(twitch|vk)$")
    username: str = Field(..., min_length=1, max_length=100)

class ListeningModeRequest(BaseModel):
    listeningMode: str = Field(...)
    
    @validator('listeningMode')
    def validate_listening_mode(cls, v):
        if v not in ['website', 'obs']:
            raise ValueError('listeningMode must be either "website" or "obs"')
        return v

class PlatformSettingsRequest(BaseModel):
    enabled_platforms: List[str] = Field(...)

class VoiceSchema(BaseModel):
    id: int
    name: str
    file_path: str
    voice_type: str
    owner_id: Optional[int] = None
    is_public: bool = False
    is_active: bool = True
    reference_text: Optional[str] = None
    created_at: Optional[str] = None

class TranscriptionResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    message: str

class LocalTTSConfigRequest(BaseModel):
    endpoint_url: str
    api_key: Optional[str] = None
    use_local: bool = False

class LocalTTSConfigResponse(BaseModel):
    success: bool
    message: str
    config: Optional[dict] = None

# ============================================================================
# TTS API CLASS (для работы с TTS Manager)
# ============================================================================

class TTSAPI:
    def __init__(self):
        self.tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        self.tts_manager = get_tts_manager()

    async def send_tts_request(
        self, 
        channel_name: str, 
        text: str, 
        author: str, 
        user_id: int = None,
        volume_level: float = 50.0, 
        connection_manager=None,
        use_ai_tts: bool = False,
        use_basic_tts: bool = True,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None
    ) -> dict:
        """Отправить запрос на озвучку через TTS Manager"""
        try:
            result = await self.tts_manager.synthesize_tts(
                channel_name=channel_name,
                text=text,
                author=author,
                volume_level=volume_level,
                use_ai_tts=use_ai_tts,
                use_basic_tts=use_basic_tts,
                connection_manager=connection_manager,
                tts_settings=tts_settings,
                word_filter=word_filter,
                blocked_users=blocked_users
            )
            
            if result.get("success"):
                tts_type = result.get("tts_type", "unknown")
                voice = result.get("voice", "unknown")
                logger.info(f"✅ TTS синтез успешен: type={tts_type}, voice={voice}, channel={channel_name}")
            else:
                logger.error(f"❌ TTS синтез не удался: {result.get('error')}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке TTS запроса: {e}")
            return {"success": False, "error": str(e)}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def check_user_whitelisted(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Проверяет whitelist для управления голосами"""
    if user.get('is_guest', False):
        raise HTTPException(
            status_code=403, 
            detail="Гостевые пользователи не имеют доступа к управлению голосами"
        )
    
    db_user = db.query(User).filter(User.id == user['id']).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем по Twitch username
    if db_user.twitch_username:
        twitch_whitelisted = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == db_user.twitch_username.lower()
        ).first()
        if twitch_whitelisted:
            return user
    
    # Проверяем по VK username
    if db_user.vk_username:
        vk_whitelisted = db.query(WhitelistedChannel).filter(
            WhitelistedChannel.channel_name == db_user.vk_username.lower()
        ).first()
        if vk_whitelisted:
            return user
    
    raise HTTPException(
        status_code=403, 
        detail="У вас нет доступа к управлению голосами. Обратитесь к администратору."
    )

async def check_local_tts_health(endpoint_url: str, api_key: Optional[str] = None) -> dict:
    """Проверить здоровье локального TTS сервиса"""
    try:
        headers = {}
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{endpoint_url}/health", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "healthy": True,
                    "version": data.get('version'),
                    "gpu_info": data.get('gpu_info')
                }
            else:
                return {"healthy": False, "error": f"HTTP {response.status_code}"}
                
    except httpx.TimeoutException:
        return {"healthy": False, "error": "Timeout: сервис не отвечает"}
    except Exception as e:
        return {"healthy": False, "error": str(e)}

# ============================================================================
# TTS ENDPOINTS - /api/tts
# ============================================================================

@tts_router.get("/filtered-words")
async def get_filtered_words(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список отфильтрованных слов"""
    try:
        tts_service = TTSService(db)
        words = await tts_service.get_filtered_words(current_user['id'])
        return {"success": True, "filtered_words": words}
    except Exception as e:
        logger.error(f"Error getting filtered words: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения списка слов")

@tts_router.post("/filtered-words")
async def add_filtered_word(
    request: AddWordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить слово в фильтр"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.add_filtered_word(
            current_user['id'], 
            request.word, 
            request.platform
        )
        
        if success:
            return {"success": True, "message": f"Слово '{request.word}' добавлено в фильтр"}
        else:
            raise HTTPException(status_code=400, detail="Слово уже существует в фильтре")
            
    except Exception as e:
        logger.error(f"Error adding filtered word: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления слова")

@tts_router.delete("/filtered-words/{word_id}")
async def delete_filtered_word(
    word_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить слово из фильтра"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.remove_filtered_word(current_user['id'], word_id)
        
        if success:
            return {"success": True, "message": "Слово удалено из фильтра"}
        else:
            raise HTTPException(status_code=404, detail="Слово не найдено")
            
    except Exception as e:
        logger.error(f"Error deleting filtered word: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления слова")

@tts_router.get("/audio-settings")
async def get_audio_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки звука"""
    try:
        tts_service = TTSService(db)
        settings = await tts_service.get_audio_settings(current_user['id'])
        return {"success": True, **settings}
    except Exception as e:
        logger.error(f"Error getting audio settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек звука")

@tts_router.post("/audio-settings")
async def save_audio_settings(
    request: AudioSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить настройки звука"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.save_audio_settings(
            current_user['id'],
            request.websiteVolume
        )
        
        if success:
            return {"success": True, "message": "Настройки звука сохранены"}
        else:
            raise HTTPException(status_code=400, detail="Ошибка сохранения настроек звука")
            
    except Exception as e:
        logger.error(f"Error saving audio settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сохранения настроек звука")

@tts_router.get("/settings")
async def get_tts_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки TTS"""
    from fastapi.responses import JSONResponse
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        UserIdentityService.log_user_operation("get_tts_settings", current_user)
        
        settings = await tts_service.get_tts_settings(**user_filters)
        return JSONResponse(content={"success": True, **settings})
    except Exception as e:
        logger.error(f"Error getting TTS settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек TTS")

@tts_router.post("/engine")
async def update_tts_engine(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Быстрое переключение TTS движка"""
    from fastapi.responses import JSONResponse
    try:
        body = await request.json()
        engine_type = body.get('engine_type', 'cloud')
        
        # Конвертируем engine_type в формат backend
        engine = 'f5tts' if engine_type == 'local' else 'gtts'
        use_local_tts = engine_type == 'local'
        
        logger.info(f"🎙️ [TTS ENGINE] Switching to {engine_type} (engine={engine}, use_local_tts={use_local_tts})")
        
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        # Получаем текущие настройки
        settings = await tts_service.get_tts_settings(**user_filters)
        
        # Обновляем только engine и use_local_tts
        success = await tts_service.save_tts_settings(
            enable_7tv=settings.get('enable_7tv', True),
            enable_twitch=settings.get('enable_twitch', True),
            enable_lexicon_filter=settings.get('enable_lexicon_filter', True),
            enable_custom_lexicon=settings.get('enable_custom_lexicon', False),
            engine=engine,
            voice=settings.get('voice', 'female_1'),
            listening_mode=settings.get('listening_mode', 'website'),
            max_message_length=settings.get('max_message_length', 500),
            skip_commands=settings.get('skip_commands', True),
            use_local_tts=use_local_tts,
            **user_filters
        )
        
        if success:
            logger.info(f"✅ [TTS ENGINE] Successfully switched to {engine_type}")
            return JSONResponse(content={"success": True, "message": f"Движок переключен на {engine_type}"})
        else:
            raise HTTPException(status_code=400, detail="Ошибка переключения движка")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [TTS ENGINE] Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@tts_router.post("/settings")
async def save_tts_settings(
    request: TtsSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить настройки TTS"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        success = await tts_service.save_tts_settings(
            enable_7tv=request.enable7TV,
            enable_twitch=request.enableTwitch,
            enable_lexicon_filter=request.enableLexiconFilter,
            enable_custom_lexicon=request.enableCustomLexicon,
            engine=request.engine,
            voice=request.voice,
            listening_mode=request.listeningMode,
            max_message_length=request.maxMessageLength,
            skip_commands=request.skipCommands,
            use_local_tts=request.useLocalTTS,
            **user_filters
        )
        
        if success:
            return {"success": True, "message": "Настройки TTS сохранены"}
        else:
            raise HTTPException(status_code=400, detail="Ошибка сохранения настроек TTS")
            
    except Exception as e:
        logger.error(f"Error saving TTS settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка сохранения настроек TTS")

@tts_router.get("/blocked-users")
async def get_blocked_users(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список заблокированных пользователей"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_identifier = UserIdentityService.get_user_identifier(current_user)
        blocked_users = await tts_service.get_blocked_users(user_identifier)
        return {"success": True, "blocked_users": blocked_users}
    except Exception as e:
        logger.error(f"Error getting blocked users: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения черного списка")

@tts_router.post("/block")
async def block_user(
    request: BlockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Заблокировать пользователя"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.block_user(
            current_user['id'],
            request.channel_name,
            request.platform,
            request.username
        )
        
        if success:
            return {"success": True, "message": f"Пользователь {request.username} заблокирован"}
        else:
            raise HTTPException(status_code=400, detail="Ошибка блокировки пользователя")
            
    except Exception as e:
        logger.error(f"Error blocking user: {e}")
        raise HTTPException(status_code=500, detail="Ошибка блокировки пользователя")

@tts_router.post("/unblock")
async def unblock_user(
    request: UnblockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Разблокировать пользователя"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.unblock_user(
            current_user['id'],
            request.channel_name,
            request.platform,
            request.username
        )
        
        if success:
            return {"success": True, "message": f"Пользователь {request.username} разблокирован"}
        else:
            raise HTTPException(status_code=400, detail="Ошибка разблокировки пользователя")
            
    except Exception as e:
        logger.error(f"Error unblocking user: {e}")
        raise HTTPException(status_code=500, detail="Ошибка разблокировки пользователя")

@tts_router.get("/status")
async def get_tts_status(
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить статус TTS"""
    from fastapi.responses import JSONResponse
    try:
        if not current_user:
            # Not authenticated - return default disabled status
            return JSONResponse(content={"enabled": False, "authenticated": False})
        
        if not UserIdentityService.validate_user_data(current_user):
            return JSONResponse(content={"enabled": False, "authenticated": False})
        
        user_type = UserIdentityService.get_user_type(current_user)
        if user_type == UserType.GUEST:
            return JSONResponse(content={"enabled": True, "authenticated": True, "user_type": "guest"})
        
        user_id = current_user['id']
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return JSONResponse(content={"enabled": False, "authenticated": True})
        
        return JSONResponse(content={"enabled": user.tts_enabled or False, "authenticated": True, "user_type": "user"})
    except Exception as e:
        logger.error(f"Error getting TTS status: {e}")
        return JSONResponse(content={"enabled": False, "error": str(e)}, status_code=500)

@tts_router.post("/enable")
async def enable_tts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Включить TTS"""
    try:
        from fastapi.responses import JSONResponse
        
        logger.info(f"🎙️ [TTS ENABLE] Request from user: {current_user.get('id')}")
        
        if not UserIdentityService.validate_user_data(current_user):
            logger.warning(f"❌ [TTS ENABLE] Invalid user data: {current_user}")
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        logger.info(f"📊 [TTS ENABLE] User filters: {user_filters}")
        
        UserIdentityService.log_user_operation("enable_tts", current_user)
        
        logger.info(f"🔄 [TTS ENABLE] Calling enable_tts with filters: {user_filters}")
        success = await tts_service.enable_tts(**user_filters)
        logger.info(f"✅ [TTS ENABLE] enable_tts returned: {success}")
        
        if success:
            logger.info(f"✅ [TTS ENABLE] Successfully enabled TTS")
            return JSONResponse(content={"success": True, "message": "TTS включен"})
        else:
            logger.error(f"❌ [TTS ENABLE] enable_tts returned False")
            raise HTTPException(status_code=400, detail="Ошибка включения TTS")
            
    except HTTPException:
        logger.error(f"❌ [TTS ENABLE] HTTPException raised")
        raise
    except Exception as e:
        logger.error(f"❌ [TTS ENABLE] Error enabling TTS: {e}")
        logger.error(f"❌ [TTS ENABLE] Exception type: {type(e)}")
        import traceback
        logger.error(f"❌ [TTS ENABLE] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка включения TTS: {str(e)}")

@tts_router.post("/disable")
async def disable_tts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    
    """Отключить TTS"""
    try:
        from fastapi.responses import JSONResponse
        
        logger.info(f"🎙️ [TTS DISABLE] Request from user: {current_user.get('id')}")
        
        if not UserIdentityService.validate_user_data(current_user):
            logger.warning(f"❌ [TTS DISABLE] Invalid user data: {current_user}")
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        logger.info(f"📊 [TTS DISABLE] User filters: {user_filters}")
        
        UserIdentityService.log_user_operation("disable_tts", current_user)
        
        logger.info(f"🔄 [TTS DISABLE] Calling disable_tts with filters: {user_filters}")
        success = await tts_service.disable_tts(**user_filters)
        logger.info(f"✅ [TTS DISABLE] disable_tts returned: {success}")
        
        if success:
            logger.info(f"✅ [TTS DISABLE] Successfully disabled TTS")
            return JSONResponse(content={"success": True, "message": "TTS отключен"})
        else:
            logger.error(f"❌ [TTS DISABLE] disable_tts returned False")
            raise HTTPException(status_code=400, detail="Ошибка отключения TTS")
            
    except HTTPException:
        logger.error(f"❌ [TTS DISABLE] HTTPException raised")
        raise
    except Exception as e:
        logger.error(f"❌ [TTS DISABLE] Error disabling TTS: {e}")
        logger.error(f"❌ [TTS DISABLE] Exception type: {type(e)}")
        import traceback
        logger.error(f"❌ [TTS DISABLE] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка отключения TTS: {str(e)}")

@tts_router.post("/synthesize")
async def synthesize_speech(
    request: Request,
    text: str,
    voice: str = "female_1",
    channel: str = None,
    platform: str = "twitch",
    priority: int = 1,
    user: dict = Depends(get_current_user)
):
    """Добавить TTS задачу в очередь"""
    log_request("/tts/synthesize", "POST", {"text_length": len(text), "voice": voice}, user.get('id'))
    start_time = time.time()
    try:
        if not UserIdentityService.validate_user_data(user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        if not channel:
            channel = UserIdentityService.get_tts_channel_name(user)
        
        rate_limit_id = UserIdentityService.get_rate_limit_id(user)
        
        rate_limit_result = await database_rate_limiter.check_tts_rate_limit(
            user_id=rate_limit_id,
            text_length=len(text)
        )
        
        if not rate_limit_result['allowed']:
            logger.warning(f"Rate limit exceeded for user {rate_limit_id}")
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after": 10
                }
            )
        
        task_id = await memory_tts_queue.add_tts_task(
            user_id=rate_limit_id,
            text=text,
            voice=voice,
            channel=channel,
            platform=platform,
            priority=priority,
            metadata={
                "requested_at": time.time(),
                "is_guest": UserIdentityService.get_user_type(user) == UserType.GUEST
            }
        )
        
        await database_rate_limiter.add_tts_request(rate_limit_id, len(text))
        
        logger.info(f"TTS task queued: {task_id}")
        
        result = {
            "success": True,
            "task_id": task_id,
            "message": "TTS задача добавлена в очередь"
        }
        log_response("/tts/synthesize", 200, result, time.time() - start_time)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS queue error: {e}")
        return {"success": False, "error": str(e)}

@tts_router.post("/generate-obs-url")
async def generate_obs_url(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сгенерировать URL для OBS"""
    try:
        tts_service = TTSService(db)
        obs_token = await tts_service.generate_obs_token(current_user['id'])
        
        if obs_token:
            return {"success": True, "obs_token": obs_token}
        else:
            raise HTTPException(status_code=400, detail="Ошибка генерации OBS URL")
            
    except Exception as e:
        logger.error(f"Error generating OBS URL: {e}")
        raise HTTPException(status_code=500, detail="Ошибка генерации OBS URL")

# ============================================================================
# YOUTUBE SETTINGS ENDPOINTS
# ============================================================================

@tts_router.get("/local-config")
async def get_local_tts_config(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить конфигурацию локального TTS"""
    try:
        config = db.query(LocalTTSEndpoint).filter(
            LocalTTSEndpoint.user_id == user['id']
        ).first()
        
        if not config:
            return {
                "success": True,
                "configured": False,
                "config": None,
                "message": "Локальный TTS не настроен"
            }
        
        return {
            "success": True,
            "configured": True,
            "config": {
                "id": config.id,
                "endpoint_url": config.endpoint_url,
                "is_active": config.is_active,
                "use_local": config.use_local,
                "is_healthy": config.is_healthy
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting local TTS config: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения конфигурации")

@tts_router.get("/youtube-settings")
async def get_youtube_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки YouTube"""
    try:
        user_id = current_user.get('id')
        
        # Получаем или создаем настройки YouTube для пользователя
        from core.database import UserSettings
        user_settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        
        if not user_settings:
            return {
                "autoplay": False,
                "volume": 50,
                "loop": False,
                "shuffle": False
            }
        
        youtube_settings = getattr(user_settings, 'youtube_settings', {}) or {}
        
        return {
            "autoplay": youtube_settings.get('autoplay', False),
            "volume": youtube_settings.get('volume', 50),
            "loop": youtube_settings.get('loop', False),
            "shuffle": youtube_settings.get('shuffle', False)
        }
            
    except Exception as e:
        logger.error(f"Error getting YouTube settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек YouTube")

@tts_router.post("/youtube-settings")
async def save_youtube_settings(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить настройки YouTube"""
    try:
        user_id = current_user.get('id')
        
        from core.database import UserSettings
        user_settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        
        if not user_settings:
            user_settings = UserSettings(user_id=user_id)
            db.add(user_settings)
        
        # Сохраняем настройки YouTube
        youtube_settings = {
            "autoplay": request.get('autoplay', False),
            "volume": request.get('volume', 50),
            "loop": request.get('loop', False),
            "shuffle": request.get('shuffle', False)
        }
        
        user_settings.youtube_settings = youtube_settings
        db.commit()
        
        return {
            "success": True,
            "message": "Настройки YouTube сохранены"
        }
            
    except Exception as e:
        logger.error(f"Error saving YouTube settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка сохранения настроек YouTube")

@tts_router.post("/set-tts-engine")
async def set_tts_engine(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Установить предпочтение TTS (cloud или локальный)"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        engine_preference = request.get('engine_preference')
        if engine_preference not in ['cloud', 'local']:
            raise HTTPException(status_code=400, detail="Неверное значение engine_preference. Должно быть 'cloud' или 'local'.")
        
        success = await tts_service.set_tts_engine_preference(
            engine_preference=engine_preference,
            **user_filters
        )
        
        if success:
            return {"success": True, "message": f"Предпочтение TTS установлено на: {engine_preference}"}
        else:
            raise HTTPException(status_code=400, detail="Ошибка установки предпочтения TTS")
            
    except Exception as e:
        logger.error(f"Error setting TTS engine preference: {e}")
        raise HTTPException(status_code=500, detail="Ошибка установки предпочтения TTS")

@tts_router.post("/engine-config")
async def set_engine_config(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Установить конфиг TTS движка (cloud или local) - alias для /set-tts-engine"""
    try:
        from fastapi.responses import JSONResponse
        
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        # Поддерживаем оба формата: 'engine' и 'engine_preference'
        engine = request.get('engine') or request.get('engine_preference')
        
        if engine not in ['cloud', 'local']:
            raise HTTPException(status_code=400, detail="Неверное значение. Должно быть 'cloud' или 'local'.")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        success = await tts_service.set_tts_engine_preference(
            engine_preference=engine,
            **user_filters
        )
        
        if success:
            logger.info(f"User {current_user.get('id')} set TTS engine to: {engine}")
            return JSONResponse(content={
                "success": True,
                "message": f"TTS движок установлен на: {engine}",
                "engine": engine
            })
        else:
            raise HTTPException(status_code=400, detail="Ошибка установки TTS движка")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting TTS engine config: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка установки TTS движка")

@tts_router.post("/listening-mode")
async def set_listening_mode(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Установить способ озвучки: website (браузер) или obs (OBS Source)"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        listening_mode = request.get('listening_mode') or request.get('listeningMode')
        if listening_mode not in ['website', 'obs']:
            raise HTTPException(status_code=400, detail="Неверное значение. Должно быть 'website' или 'obs'.")
        
        user_id = current_user.get('id')
        session_id = current_user.get('session_id') if user_id == -1 else None
        
        # Импортируем необходимые модели
        from core.database import User, TTSUserSettings
        
        # Проверяем существование пользователя для обычных пользователей
        if user_id != -1:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
        
        # Получаем или создаем TTSUserSettings
        if user_id != -1:
            tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == user_id).first()
        else:
            tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.session_id == session_id).first()
        
        if not tts_settings:
            # Создаем новые настройки
            tts_settings = TTSUserSettings(
                user_id=user_id if user_id != -1 else None,
                session_id=session_id if user_id == -1 else None,
                listening_mode=listening_mode
            )
            db.add(tts_settings)
        else:
            # Обновляем существующие
            tts_settings.listening_mode = listening_mode
        
        db.commit()
        
        logger.info(f"User {user_id} set listening mode to: {listening_mode}")
        return {
            "success": True,
            "message": f"Способ озвучки установлен на: {listening_mode}",
            "listening_mode": listening_mode
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting listening mode: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка установки способа озвучки")

@tts_router.post("/platform-settings")
async def set_platform_settings(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Установить включенные платформы для озвучки"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        enabled_platforms = request.get('enabled_platforms', [])
        
        # Валидируем платформы
        valid_platforms = {'twitch', 'vk'}
        if not all(p in valid_platforms for p in enabled_platforms):
            raise HTTPException(status_code=400, detail="Invalid platform(s). Allowed: twitch, vk")
        
        user_id = current_user.get('id')
        session_id = current_user.get('session_id') if user_id == -1 else None
        
        from core.database import User, TTSUserSettings
        
        # Проверяем существование пользователя
        if user_id != -1:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
        
        # Получаем или создаем TTSUserSettings
        if user_id != -1:
            tts_settings = db.query(TTSUserSettings).filter(
                TTSUserSettings.user_id == user_id
            ).first()
        else:
            tts_settings = db.query(TTSUserSettings).filter(
                TTSUserSettings.session_id == session_id
            ).first()
        
        if not tts_settings:
            # Создаем новые настройки с выбранными платформами
            logger.info(f"💾 [TTS SETTINGS] Creating NEW settings for user {user_id}")
            tts_settings = TTSUserSettings(
                user_id=user_id if user_id != -1 else None,
                session_id=session_id if user_id == -1 else None,
                enabled_platforms=enabled_platforms if enabled_platforms else ['twitch', 'vk']
            )
            db.add(tts_settings)
        else:
            # Обновляем существующие
            logger.info(f"💾 [TTS SETTINGS] Updating EXISTING settings for user {user_id}")
            logger.info(f"💾 [TTS SETTINGS] OLD value: {tts_settings.enabled_platforms}")
            tts_settings.enabled_platforms = enabled_platforms if enabled_platforms else ['twitch', 'vk']
            logger.info(f"💾 [TTS SETTINGS] NEW value: {tts_settings.enabled_platforms}")
        
        db.commit()
        db.refresh(tts_settings)
        
        logger.info(f"✅ [TTS SETTINGS] User {user_id} set enabled platforms to: {enabled_platforms}")
        logger.info(f"✅ [TTS SETTINGS] Saved to DB: {tts_settings.enabled_platforms}")
        return {
            "success": True,
            "message": "Платформы для озвучки обновлены",
            "enabled_platforms": enabled_platforms
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting platform settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка установки настроек платформ")

@tts_router.get("/platform-settings")
async def get_platform_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить текущие настройки платформ для озвучки"""
    try:
        user_id = current_user.get('id')
        session_id = current_user.get('session_id') if user_id == -1 else None
        
        from core.database import TTSUserSettings
        
        # Получаем текущие настройки
        if user_id != -1:
            tts_settings = db.query(TTSUserSettings).filter(
                TTSUserSettings.user_id == user_id
            ).first()
        else:
            tts_settings = db.query(TTSUserSettings).filter(
                TTSUserSettings.session_id == session_id
            ).first()
        
        if not tts_settings:
            # Возвращаем дефолтные настройки
            logger.info(f"📖 [TTS SETTINGS] No settings found for user {user_id}, returning defaults")
            enabled_platforms = ['twitch', 'vk']
        else:
            enabled_platforms = tts_settings.enabled_platforms or ['twitch', 'vk']
            logger.info(f"📖 [TTS SETTINGS] Loaded for user {user_id}: {enabled_platforms}")
        
        return {
            "success": True,
            "enabled_platforms": enabled_platforms,
            "global_enabled": True  # Можно расширить позже
        }
            
    except Exception as e:
        logger.error(f"Error getting platform settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек платформ")

# ============================================================================
# VOICES ENDPOINTS - /api/voices
# ============================================================================

@voices_router.get("/whitelist-status")
async def check_whitelist_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Проверить статус whitelist для управления голосами
    ВАЖНО: 
    1. Для гостей проверяется ник + платформа из device_info
    2. Для OAuth пользователей проверяется login_platform из сессии
    """
    try:
        # Для ГОСТЕЙ проверяем ник из device_info
        if user.get('is_guest', False):
            device_info = user.get('device_info', {})
            if not device_info:
                logger.warning(f"Guest user has no device_info")
                return {
                    "is_whitelisted": False,
                    "can_manage_voices": False,
                    "message": "Не удалось определить данные гостевой сессии"
                }
            
            monitored_channel = device_info.get('monitored_channel')
            platform = device_info.get('platform')
            
            if not monitored_channel or not platform:
                logger.warning(f"Guest user has incomplete device_info: {device_info}")
                return {
                    "is_whitelisted": False,
                    "can_manage_voices": False,
                    "message": "Не удалось определить канал или платформу"
                }
            
            # Проверяем whitelist для гостевого канала
            guest_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == monitored_channel.lower(),
                WhitelistedChannel.platform == platform
            ).first()
            
            if guest_whitelisted:
                logger.info(f"✅ Guest user {monitored_channel} ({platform}) is whitelisted")
                return {"is_whitelisted": True, "can_manage_voices": True, "platform": platform}
            else:
                logger.info(f"❌ Guest user {monitored_channel} ({platform}) NOT in whitelist")
                return {
                    "is_whitelisted": False,
                    "can_manage_voices": False,
                    "message": f"Канал '{monitored_channel}' не в whitelist для платформы {platform}"
                }
        
        db_user = db.query(User).filter(User.id == user['id']).first()
        if not db_user:
            return {"is_whitelisted": False, "can_manage_voices": False}
        
        # Получаем платформу, через которую пользователь АВТОРИЗОВАЛСЯ
        login_platform = user.get('login_platform')
        
        if not login_platform:
            logger.warning(f"User {user['id']} has no login_platform in session")
            return {
                "is_whitelisted": False, 
                "can_manage_voices": False,
                "message": "Не удалось определить платформу авторизации"
            }
        
        # Проверяем whitelist ТОЛЬКО для платформы авторизации
        if login_platform == 'twitch':
            if not db_user.twitch_username:
                return {"is_whitelisted": False, "can_manage_voices": False}
                
            twitch_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == db_user.twitch_username.lower(),
                WhitelistedChannel.platform == 'twitch'
            ).first()
            
            if twitch_whitelisted:
                logger.info(f"✅ User {db_user.twitch_username} whitelisted on Twitch")
                return {"is_whitelisted": True, "can_manage_voices": True, "platform": "twitch"}
            else:
                logger.warning(f"❌ User {db_user.twitch_username} NOT whitelisted on Twitch")
                return {"is_whitelisted": False, "can_manage_voices": False}
        
        elif login_platform == 'vk':
            if not db_user.vk_username:
                return {"is_whitelisted": False, "can_manage_voices": False}
                
            vk_whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == db_user.vk_username.lower(),
                WhitelistedChannel.platform == 'vk'
            ).first()
            
            if vk_whitelisted:
                logger.info(f"✅ User {db_user.vk_username} whitelisted on VK")
                return {"is_whitelisted": True, "can_manage_voices": True, "platform": "vk"}
            else:
                logger.warning(f"❌ User {db_user.vk_username} NOT whitelisted on VK")
                return {"is_whitelisted": False, "can_manage_voices": False}
        
        else:
            logger.error(f"Unknown login_platform: {login_platform}")
            return {"is_whitelisted": False, "can_manage_voices": False}
            
    except Exception as e:
        logger.error(f"Error checking whitelist status: {e}")
        raise HTTPException(status_code=500, detail="Ошибка проверки whitelist")

@voices_router.get("/", response_model=List[VoiceSchema])
async def get_all_voices(
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все голоса"""
    try:
        tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        response = requests.get(f"{tts_service_url}/api/voices")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка получения голосов")
    except Exception as e:
        logger.error(f"Error getting voices: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения голосов")

# ============================================================================
# USER VOICES ENDPOINTS - /api/user/voices
# ============================================================================

@user_voices_router.get("/{user_id}")
async def get_user_voices(
    user_id: int,
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все голоса пользователя"""
    try:
        tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        response = requests.get(f"{tts_service_url}/api/user/voices/{user_id}")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка получения голосов")
    except Exception as e:
        logger.error(f"Error getting user voices: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения голосов")

@user_voices_router.post("/upload")
async def upload_user_voice(
    user_id: int,
    file: UploadFile = File(...),
    name: str = Form(...),
    request: Request = None,
    user: dict = Depends(check_user_whitelisted),
    db: Session = Depends(get_db)
):
    """Загрузить пользовательский голос"""
    try:
        if user['id'] != user_id and not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Вы можете загружать голоса только для себя")
        
        tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        
        files = {'file': (file.filename, file.file, file.content_type)}
        data = {'name': name, 'user_id': user_id}
        
        response = requests.post(
            f"{tts_service_url}/api/user/voices/upload?user_id={user_id}",
            files=files,
            data=data
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка загрузки голоса")
    except Exception as e:
        logger.error(f"Error uploading voice: {e}")
        raise HTTPException(status_code=500, detail="Ошибка загрузки голоса")

# ============================================================================
# LOCAL TTS ENDPOINTS - /api/local-tts
# ============================================================================

@local_tts_router.get("/config")
async def get_local_tts_config(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить конфигурацию локального TTS"""
    try:
        # Проверяем whitelist
        user_obj = db.query(WhitelistedChannel).filter(
            (WhitelistedChannel.channel_name == user.get('twitch_name')) |
            (WhitelistedChannel.channel_name == user.get('vk_username'))
        ).first()
        
        can_manage_voices = user_obj is not None
        
        config = db.query(LocalTTSEndpoint).filter(
            LocalTTSEndpoint.user_id == user['id']
        ).first()
        
        if not config:
            return {
                "success": True,
                "configured": False,
                "config": None,
                "healthy": False,
                "can_manage_voices": can_manage_voices,
                "message": "Локальный TTS не настроен"
            }
        
        return {
            "success": True,
            "configured": True,
            "healthy": config.is_healthy,
            "can_manage_voices": can_manage_voices,
            "config": {
                "id": config.id,
                "endpoint_url": config.endpoint_url,
                "is_active": config.is_active,
                "use_local": config.use_local,
                "is_healthy": config.is_healthy
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting local TTS config: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения конфигурации")

@local_tts_router.post("/config")
async def save_local_tts_config(
    request: LocalTTSConfigRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить конфигурацию локального TTS"""
    try:
        # Проверяем whitelist
        user_obj = db.query(WhitelistedChannel).filter(
            (WhitelistedChannel.channel_name == user.get('twitch_name')) |
            (WhitelistedChannel.channel_name == user.get('vk_username'))
        ).first()
        
        if not user_obj:
            raise HTTPException(
                status_code=403, 
                detail="Доступ к локальному TTS требует whitelist"
            )
        
        config = db.query(LocalTTSEndpoint).filter(
            LocalTTSEndpoint.user_id == user['id']
        ).first()
        
        if config:
            config.endpoint_url = request.endpoint_url
            config.api_key = request.api_key
            config.use_local = request.use_local
            config.updated_at = datetime.utcnow()
            message = "Конфигурация обновлена"
        else:
            config = LocalTTSEndpoint(
                user_id=user['id'],
                endpoint_url=request.endpoint_url,
                api_key=request.api_key,
                use_local=request.use_local,
                is_active=True
            )
            db.add(config)
            message = "Конфигурация создана"
        
        db.commit()
        db.refresh(config)
        
        # Проверяем здоровье
        health_status = await check_local_tts_health(config.endpoint_url, config.api_key)
        config.is_healthy = health_status['healthy']
        config.last_health_check = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "message": message,
            "config": {"id": config.id, "endpoint_url": config.endpoint_url}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving local TTS config: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка сохранения конфигурации")

@local_tts_router.post("/toggle")
async def toggle_local_tts(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Переключить использование локального TTS"""
    try:
        # Получаем конфигурацию локального TTS
        config = db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.user_id == user["id"]).first()
        
        if not config:
            raise HTTPException(status_code=404, detail="Конфигурация локального TTS не найдена. Сначала настройте подключение.")
        
        # Переключаем use_local
        config.use_local = not config.use_local
        db.commit()
        db.refresh(config)
        
        # Если включаем локальный TTS, проверяем здоровье
        if config.use_local:
            health_status = await check_local_tts_health(config.endpoint_url, config.api_key)
            if not health_status['healthy']:
                config.use_local = False
                db.commit()
                return {
                    "success": False,
                    "message": "Локальный TTS недоступен. Проверьте подключение.",
                    "use_local": False
                }
        
        return {
            "success": True,
            "message": f"Локальный TTS {'включен' if config.use_local else 'выключен'}",
            "use_local": config.use_local
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling local TTS: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка переключения локального TTS")

@local_tts_router.post("/test-connection")
async def test_local_tts_connection(
    request: LocalTTSConfigRequest,
    user: dict = Depends(get_current_user)
):
    """Проверить подключение к локальному TTS"""
    try:
        health_status = await check_local_tts_health(request.endpoint_url, request.api_key)
        
        if health_status['healthy']:
            return {
                "success": True,
                "message": "Подключение успешно",
                "version": health_status.get('version')
            }
        else:
            return {
                "success": False,
                "message": f"Не удалось подключиться: {health_status.get('error')}"
            }
            
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        return {"success": False, "message": str(e)}

# ============================================================================
# FILTERS AND BLOCKED USERS MANAGEMENT
# ============================================================================

@tts_router.get("/filters/list")
async def get_filters_list(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех фильтров пользователя"""
    try:
        user_id = current_user.get('id')
        from core.database import FilteredWord
        
        filters = db.query(FilteredWord).filter(
            FilteredWord.user_id == user_id,
            FilteredWord.is_active == True
        ).all()
        
        filters_data = [
            {
                "id": f.id,
                "word": f.word,
                "platform": f.platform,
                "created_at": f.created_at.isoformat() if f.created_at else None
            }
            for f in filters
        ]
        
        return {
            "success": True,
            "filters": filters_data,
            "total": len(filters_data)
        }
    except Exception as e:
        logger.error(f"Error getting filters list: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения списка фильтров")

@tts_router.post("/filters/add")
async def add_filter(
    request: AddWordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить слово в фильтр"""
    try:
        user_id = current_user.get('id')
        from core.database import FilteredWord
        
        # Проверяем что слово не пусто
        if not request.word or len(request.word.strip()) == 0:
            raise HTTPException(status_code=400, detail="Слово не может быть пустым")
        
        # Проверяем дублирование
        existing = db.query(FilteredWord).filter(
            FilteredWord.user_id == user_id,
            FilteredWord.word == request.word.lower(),
            FilteredWord.platform == request.platform
        ).first()
        
        if existing:
            if existing.is_active:
                raise HTTPException(status_code=400, detail="Это слово уже в фильтре")
            else:
                # Реактивируем
                existing.is_active = True
                db.commit()
                return {"success": True, "message": "Слово добавлено в фильтр"}
        
        # Создаем новый фильтр
        new_filter = FilteredWord(
            user_id=user_id,
            word=request.word.lower(),
            platform=request.platform,
            is_active=True
        )
        db.add(new_filter)
        db.commit()
        
        logger.info(f"User {user_id} added filter: {request.word}")
        return {"success": True, "message": "Слово добавлено в фильтр", "filter_id": new_filter.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding filter: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка добавления фильтра")

@tts_router.delete("/filters/{filter_id}")
async def remove_filter(
    filter_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить слово из фильтра"""
    try:
        user_id = current_user.get('id')
        from core.database import FilteredWord
        
        filter_obj = db.query(FilteredWord).filter(
            FilteredWord.id == filter_id,
            FilteredWord.user_id == user_id
        ).first()
        
        if not filter_obj:
            raise HTTPException(status_code=404, detail="Фильтр не найден")
        
        filter_obj.is_active = False
        db.commit()
        
        logger.info(f"User {user_id} removed filter: {filter_obj.word}")
        return {"success": True, "message": "Фильтр удален"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing filter: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления фильтра")

@tts_router.get("/blocked-users/list")
async def get_blocked_users_list(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех заблокированных пользователей от TTS"""
    try:
        user_id = current_user.get('id')
        from core.database import TTSBlockedUser
        
        blocked_users = db.query(TTSBlockedUser).filter(
            TTSBlockedUser.user_id == user_id
        ).all()
        
        blocked_data = [
            {
                "id": bu.id,
                "username": bu.username,
                "platform": bu.platform,
                "channel_name": bu.channel_name,
                "reason": bu.reason,
                "blocked_at": bu.blocked_at.isoformat() if bu.blocked_at else None
            }
            for bu in blocked_users
        ]
        
        return {
            "success": True,
            "blocked_users": blocked_data,
            "total": len(blocked_data)
        }
    except Exception as e:
        logger.error(f"Error getting blocked users list: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения списка заблокированных")

@tts_router.post("/blocked-users/add")
async def add_blocked_user(
    request: BlockUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить пользователя в черный список TTS"""
    try:
        user_id = current_user.get('id')
        from core.database import TTSBlockedUser
        
        # Проверяем дублирование
        existing = db.query(TTSBlockedUser).filter(
            TTSBlockedUser.user_id == user_id,
            TTSBlockedUser.username == request.username.lower(),
            TTSBlockedUser.platform == request.platform,
            TTSBlockedUser.channel_name == request.channel_name
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь уже в черном списке")
        
        blocked_user = TTSBlockedUser(
            user_id=user_id,
            username=request.username.lower(),
            platform=request.platform,
            channel_name=request.channel_name,
            reason=f"Added via TTS settings"
        )
        db.add(blocked_user)
        db.commit()
        
        logger.info(f"User {user_id} blocked TTS for: {request.username} ({request.platform})")
        return {"success": True, "message": "Пользователь добавлен в черный список", "blocked_user_id": blocked_user.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding blocked user: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка добавления в черный список")

@tts_router.delete("/blocked-users/{blocked_user_id}")
async def remove_blocked_user(
    blocked_user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить пользователя из черного списка TTS"""
    try:
        user_id = current_user.get('id')
        from core.database import TTSBlockedUser
        
        blocked_user = db.query(TTSBlockedUser).filter(
            TTSBlockedUser.id == blocked_user_id,
            TTSBlockedUser.user_id == user_id
        ).first()
        
        if not blocked_user:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        
        db.delete(blocked_user)
        db.commit()
        
        logger.info(f"User {user_id} unblocked TTS for: {blocked_user.username}")
        return {"success": True, "message": "Пользователь удален из черного списка"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing blocked user: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления из черного списка")

# ============================================================================
# AUDIO SERVING ENDPOINT
# ============================================================================

@tts_router.get("/audio/{filename}")
async def serve_tts_audio(filename: str):
    """Обслуживает сгенерированные TTS аудио файлы"""
    try:
        from pathlib import Path
        from core.project_paths import TEMP_DIR
        
        # Безопасность: только разрешаем файлы из temp директории
        temp_dir = TEMP_DIR / "tts_audio"
        file_path = temp_dir / filename
        
        # Проверяем что файл находится в нужной директории
        if not str(file_path.resolve()).startswith(str(temp_dir.resolve())):
            logger.warning(f"❌ Attempt to access file outside temp directory: {filename}")
            raise HTTPException(status_code=403, detail="Forbidden")
        
        if not file_path.exists():
            logger.warning(f"❌ Audio file not found: {filename}")
            logger.warning(f"❌ Expected path: {file_path.resolve()}")
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        logger.info(f"✅ Serving audio file: {filename}")
        return FileResponse(
            path=str(file_path),
            media_type="audio/wav",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error serving audio file {filename}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Error serving audio")

# ============================================================================
# EXPORT TTS API INSTANCE
# ============================================================================

# Create global instance for use in bots
tts_api_instance = TTSAPI()

# List of routers to include in main app
tts_routers = [
    tts_router,
    voices_router,
    user_voices_router,
    local_tts_router
]

