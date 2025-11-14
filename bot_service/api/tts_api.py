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
import logging
import time
import re
import shutil
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, validator
from fastapi import APIRouter, Depends, HTTPException, Request, Form, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

# Core imports
from core.database import get_db, User, WhitelistedChannel, LocalTTSEndpoint, TTSUserSettings
from auth.auth import get_current_user, get_current_user_optional
from constants import DEFAULT_TTS_SERVICE_URL

# Services
from services.tts_manager import get_tts_manager
from services.tts_service import TTSService
from services.user_identity_service import UserIdentityService, UserType
from services.memory_tts_queue import memory_tts_queue
from services.memory_websocket_manager import memory_websocket_manager
from services.advanced_rate_limiter import advanced_rate_limiter as database_rate_limiter
from core.security_modern import limiter

# Utils
from utils.enhanced_logger import log_request, log_response

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
    filterReplies: bool = Field(False)  # Фильтровать ответы
    filterMentions: bool = Field(False)  # Фильтровать упоминания
    version: int = Field(1, ge=1)  # ✅ Version для защиты от race conditions
    
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
    
    # Проверяем whitelist с кешированием
    from utils.whitelist_cache import is_user_whitelisted_cached
    if is_user_whitelisted_cached(db_user, db):
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
    """Получить настройки звука (поддерживает гостей и авторизованных)"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        settings = await tts_service.get_audio_settings(**user_filters)
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
    """Сохранить настройки звука (поддерживает гостей и авторизованных)"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        success = await tts_service.save_audio_settings(
            request.websiteVolume,
            **user_filters
        )
        
        if success:
            # Отправляем WebSocket уведомление для синхронизации фронтенда
            try:
                from services.memory_websocket_manager import memory_websocket_manager
                user_id = current_user.get('id')
                if user_id and user_id != -1:  # Только для авторизованных пользователей
                    cache_invalidation_event = {
                        "type": "cache_invalidate",
                        "cache_key": "tts_audio_settings",
                        "reason": "audio_settings_updated"
                    }
                    await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                    logger.debug(f"🔄 [AUDIO SETTINGS] Sent cache invalidation to user {user_id}")
            except Exception as ws_error:
                logger.warning(f"Failed to send WebSocket notification for audio settings: {ws_error}")
            
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
    from core.database import User, WhitelistedChannel
    
    try:
        body = await request.json()
        engine_type = body.get('engine_type', 'gtts')
        
        # Конвертируем engine_type в формат backend:
        # - 'local' -> f5tts (локальный F5-TTS через tts_service_simple)
        # - 'cloud' -> f5tts (облачный F5-TTS через основной tts_service, только для whitelist)
        # - 'gtts' -> gtts (базовый TTS через gTTS)
        engine = 'f5tts' if engine_type in ('local', 'cloud') else 'gtts'
        use_local_tts = engine_type == 'local'
        
        logger.info(f"🎙️ [TTS ENGINE] Switching to {engine_type} (engine={engine}, use_local_tts={use_local_tts})")
        
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        # Проверяем whitelist ТОЛЬКО для облачного F5-TTS
        # Для локального TTS (tts_service_simple) whitelist не требуется
        if engine_type == 'local':
            # Проверяем есть ли у пользователя настроенный локальный endpoint
            from core.database import LocalTTSEndpoint
            db_user = db.query(User).filter(User.id == current_user['id']).first()
            if not db_user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            
            # Проверяем наличие локального TTS endpoint
            local_endpoint = db.query(LocalTTSEndpoint).filter(
                LocalTTSEndpoint.user_id == current_user['id'],
                LocalTTSEndpoint.is_active == True
            ).first()
            
            if not local_endpoint or not local_endpoint.is_healthy:
                raise HTTPException(
                    status_code=403,
                    detail="Для использования локального TTS необходимо настроить и активировать локальный TTS endpoint. Перейдите в настройки локального TTS."
                )
        elif engine_type == 'cloud':
            # Для облачного F5-TTS проверяем whitelist
            db_user = db.query(User).filter(User.id == current_user['id']).first()
            if not db_user:
                raise HTTPException(status_code=404, detail="Пользователь не найден")
            
            # Проверяем whitelist с кешированием (независимо от login_platform)
            from utils.whitelist_cache import is_user_whitelisted_cached
            logger.info(f"🔍 [TTS ENGINE] Checking whitelist for cloud F5-TTS: user_id={db_user.id}, twitch={db_user.twitch_username}, vk={db_user.vk_username}, vk_channel={db_user.vk_channel_name}")
            is_whitelisted = is_user_whitelisted_cached(db_user, db)
            
            # Сохраняем is_whitelisted для использования после сохранения настроек
            is_whitelisted_engine = is_whitelisted
            
            if not is_whitelisted:
                channel_name = db_user.twitch_username or db_user.vk_username or db_user.vk_channel_name or 'неизвестен'
                logger.warning(f"❌ [TTS ENGINE] User {current_user['id']} ({channel_name}) NOT whitelisted, cannot enable cloud F5-TTS")
                
                # Дополнительная диагностика
                from core.database import WhitelistedChannel
                if db_user.twitch_username:
                    twitch_check = db.query(WhitelistedChannel).filter(
                        WhitelistedChannel.channel_name == db_user.twitch_username.lower(),
                        WhitelistedChannel.platform == 'twitch'
                    ).first()
                    logger.warning(f"🔍 [TTS ENGINE DEBUG] Direct DB check Twitch '{db_user.twitch_username.lower()}': found={twitch_check is not None}")
                if db_user.vk_username:
                    vk_check = db.query(WhitelistedChannel).filter(
                        WhitelistedChannel.channel_name == db_user.vk_username.lower(),
                        WhitelistedChannel.platform == 'vk'
                    ).first()
                    logger.warning(f"🔍 [TTS ENGINE DEBUG] Direct DB check VK username '{db_user.vk_username.lower()}': found={vk_check is not None}")
                if db_user.vk_channel_name:
                    vk_channel_check = db.query(WhitelistedChannel).filter(
                        WhitelistedChannel.channel_name == db_user.vk_channel_name.lower(),
                        WhitelistedChannel.platform == 'vk'
                    ).first()
                    logger.warning(f"🔍 [TTS ENGINE DEBUG] Direct DB check VK channel '{db_user.vk_channel_name.lower()}': found={vk_channel_check is not None}")
                
                raise HTTPException(
                    status_code=403,
                    detail="Облачный F5-TTS доступен только для пользователей из whitelist. Для использования локального TTS настройте tts_service_simple."
                )
            
            logger.info(f"✅ [TTS ENGINE] User {current_user['id']} whitelisted, enabling cloud F5-TTS")
        else:
            # Для local режима is_whitelisted_engine не нужен
            is_whitelisted_engine = False
        
        tts_service = TTSService(db)
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        # ✅ NULL CHECK: Получаем текущие настройки
        settings = await tts_service.get_tts_settings(**user_filters)
        if not settings or not isinstance(settings, dict):
            logger.warning(f"⚠️ [TTS ENGINE] Got invalid settings: {settings}, using defaults")
            settings = {
                'enable_7tv': True,
                'enable_twitch': True,
                'enable_lexicon_filter': True,
                'enable_custom_lexicon': False,
                'voice': 'female_1',
                'listening_mode': 'website',
                'max_message_length': 500,
                'skip_commands': True
            }
        
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
            # ВАЖНО: При переключении на F5-TTS (local или cloud) НЕ включаем TTS автоматически
            # Базовая TTS должна быть включена отдельно через /enable
            # Это позволяет работать F5-TTS и базовой TTS независимо
            # F5-TTS использует базовую TTS как fallback при ошибках
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
        
        result = await tts_service.save_tts_settings(
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
            filter_replies=request.filterReplies,
            filter_mentions=request.filterMentions,
            client_version=getattr(request, 'version', None),  # ✅ Получаем версию от клиента
            **user_filters
        )
        
        # ✅ Проверяем есть ли конфликт версии
        if not result.get("success", False):
            if result.get("error") == "Version conflict":
                # Возвращаем 409 Conflict
                logger.warning(f"Version conflict for user {user_filters}: {result}")
                raise HTTPException(
                    status_code=409, 
                    detail=f"Data was updated. Current version: {result.get('current_version', 1)}"
                )
            else:
                raise HTTPException(status_code=400, detail=result.get("error", "Ошибка сохранения настроек TTS"))
        
        # Отправляем WebSocket уведомление для синхронизации фронтенда
        try:
            from services.memory_websocket_manager import memory_websocket_manager
            from utils.websocket_broadcast import broadcast_settings_change
            
            user_id = current_user.get('id')
            if user_id and user_id != -1:  # Только для авторизованных пользователей
                # Legacy cache invalidation event
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": "tts_settings",
                    "reason": "tts_settings_updated",
                    "version": result.get("version", 1)  # ✅ Отправляем новую версию
                }
                await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                
                # New state sync broadcast
                settings_data = {
                    "enable7TV": request.enable7TV,
                    "enableTwitch": request.enableTwitch,
                    "enableLexiconFilter": request.enableLexiconFilter,
                    "enableCustomLexicon": request.enableCustomLexicon,
                    "engine": request.engine,
                    "voice": request.voice,
                    "listeningMode": request.listeningMode,
                    "maxMessageLength": request.maxMessageLength,
                    "skipCommands": request.skipCommands,
                    "useLocalTTS": request.useLocalTTS,
                    "filterReplies": request.filterReplies,
                    "filterMentions": request.filterMentions,
                }
                await broadcast_settings_change(user_id, "tts_settings", settings_data)
                logger.debug(f"🔄 [TTS SETTINGS] Sent cache invalidation to user {user_id} with version {result.get('version')}")
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification for TTS settings: {ws_error}")
        
        return {"success": True, "message": "Настройки TTS сохранены", "version": result.get("version", 1)}
            
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
            return JSONResponse(content={"enabled": False, "authenticated": False, "is_whitelisted": False})
        
        if not UserIdentityService.validate_user_data(current_user):
            return JSONResponse(content={"enabled": False, "authenticated": False, "is_whitelisted": False})
        
        user_type = UserIdentityService.get_user_type(current_user)
        
        # Для гостей проверяем локальный TTS endpoint
        if user_type == UserType.GUEST:
            from core.database import LocalTTSEndpoint
            session_id = current_user.get('session_id')
            local_endpoint = None
            
            if session_id:
                local_endpoint = db.query(LocalTTSEndpoint).filter(
                    LocalTTSEndpoint.session_id == session_id,
                    LocalTTSEndpoint.is_active == True
                ).first()
            
            has_local_setup = local_endpoint and local_endpoint.is_healthy
            is_whitelisted = has_local_setup  # Гости используют локальный TTS без whitelist
            
            # Проверяем engine_type из настроек гостя
            from core.database import TTSUserSettings
            tts_settings = None
            if session_id:
                tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.session_id == session_id).first()
            
            engine_type = 'local' if (tts_settings and (tts_settings.use_local_tts or tts_settings.engine == 'f5tts')) else 'cloud'
            
            return JSONResponse(content={
                "enabled": True, 
                "authenticated": True, 
                "user_type": "guest", 
                "is_whitelisted": is_whitelisted,
                "engine_type": engine_type,
                "has_local_setup": has_local_setup
            })
        
        user_id = current_user['id']
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return JSONResponse(content={"enabled": False, "authenticated": True, "is_whitelisted": False})
        
        # Также получаем engine_type из настроек TTS и проверяем локальный endpoint
        from core.database import LocalTTSEndpoint, TTSUserSettings, WhitelistedChannel
        tts_settings = db.query(TTSUserSettings).filter(TTSUserSettings.user_id == user_id).first()
        local_endpoint = db.query(LocalTTSEndpoint).filter(
            LocalTTSEndpoint.user_id == user_id,
            LocalTTSEndpoint.is_active == True
        ).first()
        
        if tts_settings:
            # Определяем engine_type на основе настроек:
            # - use_local_tts = True → 'local' (локальный F5-TTS через tts_service_simple)
            # - engine = 'f5tts' И use_local_tts = False → 'cloud' (облачный F5-TTS, только для whitelist)
            # - engine = 'gtts' → 'gtts' (базовый gTTS)
            if tts_settings.use_local_tts:
                engine_type = 'local'
            elif tts_settings.engine == 'f5tts':
                engine_type = 'cloud'  # Облачный F5-TTS (для whitelisted пользователей)
            else:
                engine_type = 'gtts'  # Базовый gTTS
        else:
            engine_type = 'gtts'  # По умолчанию базовый gTTS
        
        # Если есть локальный endpoint, считаем что пользователь может использовать локальный TTS без whitelist
        has_local_setup = local_endpoint and local_endpoint.is_healthy
        
        # Проверяем whitelist статус (с кешированием)
        # ВАЖНО: Проверяем обе платформы, так как пользователь может быть в whitelist на любой из них
        from utils.whitelist_cache import is_user_whitelisted_cached
        login_platform = current_user.get('login_platform')
        
        # Детальная проверка whitelist для логирования
        logger.debug(f"🔍 [TTS STATUS] Checking whitelist for user {user_id}: twitch={user.twitch_username}, vk={user.vk_username}, login_platform={login_platform}")
        
        is_whitelisted = is_user_whitelisted_cached(user, db)
        
        # Детальное логирование для диагностики - только на DEBUG уровне чтобы не спамить логи
        logger.debug(f"🔍 [TTS STATUS] User {user_id} whitelist check: twitch={user.twitch_username}, vk={user.vk_username}, vk_channel={user.vk_channel_name}, is_whitelisted={is_whitelisted}, has_local_setup={has_local_setup}")
        
        if is_whitelisted:
            platform_name = user.twitch_username if user.twitch_username else (user.vk_username or user.vk_channel_name)
            logger.debug(f"✅ [TTS STATUS] User {user_id} ({platform_name}) whitelisted")
        elif not has_local_setup:
            logger.warning(f"❌ [TTS STATUS] User {user_id} (twitch: {user.twitch_username}, vk: {user.vk_username}, vk_channel: {user.vk_channel_name}) NOT whitelisted, login_platform: {login_platform}")
            
            # Дополнительная диагностика: проверяем напрямую в БД (без кеша)
            from core.database import WhitelistedChannel
            if user.twitch_username:
                twitch_check = db.query(WhitelistedChannel).filter(
                    WhitelistedChannel.channel_name == user.twitch_username.lower(),
                    WhitelistedChannel.platform == 'twitch'
                ).first()
                logger.warning(f"🔍 [TTS STATUS DEBUG] Direct DB check Twitch '{user.twitch_username.lower()}': found={twitch_check is not None}, platform={twitch_check.platform if twitch_check else None}")
            if user.vk_username:
                vk_check = db.query(WhitelistedChannel).filter(
                    WhitelistedChannel.channel_name == user.vk_username.lower(),
                    WhitelistedChannel.platform == 'vk'
                ).first()
                logger.warning(f"🔍 [TTS STATUS DEBUG] Direct DB check VK username '{user.vk_username.lower()}': found={vk_check is not None}, platform={vk_check.platform if vk_check else None}")
            if user.vk_channel_name:
                vk_channel_check = db.query(WhitelistedChannel).filter(
                    WhitelistedChannel.channel_name == user.vk_channel_name.lower(),
                    WhitelistedChannel.platform == 'vk'
                ).first()
                logger.warning(f"🔍 [TTS STATUS DEBUG] Direct DB check VK channel '{user.vk_channel_name.lower()}': found={vk_channel_check is not None}, platform={vk_channel_check.platform if vk_channel_check else None}")
        
        return JSONResponse(content={
            "enabled": user.tts_enabled or False, 
            "authenticated": True, 
            "user_type": "user",
            "is_whitelisted": is_whitelisted or has_local_setup,  # Whitelist не требуется если есть локальный TTS
            "engine_type": engine_type,
            "has_local_setup": has_local_setup
        })
    except Exception as e:
        logger.error(f"Error getting TTS status: {e}")
        return JSONResponse(content={"enabled": False, "is_whitelisted": False, "error": str(e)}, status_code=500)

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
    """Сохранить настройки YouTube (поддерживает гостей и авторизованных)"""
    try:
        if not UserIdentityService.validate_user_data(current_user):
            raise HTTPException(status_code=400, detail="Invalid user data")
        
        user_filters = UserIdentityService.get_database_filters(current_user)
        
        from core.database import UserSettings
        user_settings = db.query(UserSettings).filter_by(**user_filters).first()
        
        if not user_settings:
            settings_data = UserIdentityService.create_settings_record_data(current_user)
            user_settings = UserSettings(**settings_data)
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
        
        # Отправляем WebSocket уведомление для синхронизации фронтенда
        try:
            from services.memory_websocket_manager import memory_websocket_manager
            user_id = current_user.get('id')
            if user_id and user_id != -1:  # Только для авторизованных пользователей
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": "youtube_settings",
                    "reason": "youtube_settings_updated"
                }
                await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                logger.debug(f"🔄 [YOUTUBE SETTINGS] Sent cache invalidation to user {user_id}")
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification for YouTube settings: {ws_error}")
        
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
            logger.debug(f"💾 [TTS SETTINGS] Creating NEW settings for user {user_id}")
            tts_settings = TTSUserSettings(
                user_id=user_id if user_id != -1 else None,
                session_id=session_id if user_id == -1 else None,
                enabled_platforms=enabled_platforms if enabled_platforms else ['twitch', 'vk']
            )
            db.add(tts_settings)
        else:
            # Обновляем существующие
            old_value = tts_settings.enabled_platforms
            tts_settings.enabled_platforms = enabled_platforms if enabled_platforms else ['twitch', 'vk']
            # Логируем только если значение изменилось
            if old_value != tts_settings.enabled_platforms:
                logger.debug(f"💾 [TTS SETTINGS] User {user_id}: {old_value} → {tts_settings.enabled_platforms}")
        
        db.commit()
        db.refresh(tts_settings)
        
        # Один лог вместо трех
        logger.debug(f"✅ [TTS SETTINGS] User {user_id} platforms: {tts_settings.enabled_platforms}")
        
        # Отправляем WebSocket уведомление для синхронизации фронтенда
        try:
            from services.memory_websocket_manager import memory_websocket_manager
            if user_id != -1:  # Только для авторизованных пользователей
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": "tts_platform_settings",
                    "reason": "platform_settings_updated"
                }
                await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                logger.debug(f"🔄 [PLATFORM SETTINGS] Sent cache invalidation to user {user_id}")
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification for platform settings: {ws_error}")
        
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
            enabled_platforms = ['twitch', 'vk']
        else:
            enabled_platforms = tts_settings.enabled_platforms or ['twitch', 'vk']
        
        # Логируем только если произошло изменение (не логируем при каждом запросе)
        # logger.debug(f"📖 [TTS SETTINGS] Loaded for user {user_id}: {enabled_platforms}")
        
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
        
        # Проверяем наличие локального TTS endpoint
        from core.database import LocalTTSEndpoint
        local_endpoint = db.query(LocalTTSEndpoint).filter(
            LocalTTSEndpoint.user_id == user['id'],
            LocalTTSEndpoint.is_active == True
        ).first()
        has_local_setup = local_endpoint and local_endpoint.is_healthy
        
        # Если есть локальный endpoint - разрешаем доступ к управлению голосами без whitelist
        if has_local_setup:
            logger.info(f"🏠 User {user['id']} has local TTS setup, allowing voice management")
            return {"is_whitelisted": True, "can_manage_voices": True, "has_local_setup": True}
        
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
        # Проверяем whitelist с кешированием (проверяем обе платформы)
        from utils.whitelist_cache import is_user_whitelisted_cached
        is_whitelisted = is_user_whitelisted_cached(db_user, db)
        
        if is_whitelisted:
            # Определяем платформу для которой пользователь в whitelist
            platform = None
            channel_name = None
            
            # Проверяем Twitch whitelist
            if db_user.twitch_username:
                from utils.whitelist_cache import is_channel_whitelisted_cached
                if is_channel_whitelisted_cached(db_user.twitch_username.lower(), 'twitch', db):
                    platform = "twitch"
                    channel_name = db_user.twitch_username
                    logger.info(f"✅ User {user['id']} ({channel_name}) whitelisted on Twitch")
                    return {"is_whitelisted": True, "can_manage_voices": True, "platform": platform}
            
            # Проверяем VK whitelist (username или channel_name)
            if db_user.vk_username or db_user.vk_channel_name:
                from utils.whitelist_cache import is_channel_whitelisted_cached
                vk_channel = db_user.vk_channel_name or db_user.vk_username
                if vk_channel and is_channel_whitelisted_cached(vk_channel.lower(), 'vk', db):
                    platform = "vk"
                    channel_name = vk_channel
                    logger.info(f"✅ User {user['id']} ({channel_name}) whitelisted on VK")
                    return {"is_whitelisted": True, "can_manage_voices": True, "platform": platform}
            
            # Если is_whitelisted вернул True, но platform не определился - все равно разрешаем
            # (может быть ситуация когда пользователь в whitelist, но username не совпадает)
            channel_name = db_user.twitch_username or db_user.vk_username or db_user.vk_channel_name or 'неизвестен'
            logger.warning(f"⚠️ User {user['id']} ({channel_name}) is_whitelisted=True but platform not found, allowing access anyway")
            return {"is_whitelisted": True, "can_manage_voices": True, "platform": login_platform or "unknown"}
        
        channel_name = db_user.twitch_username or db_user.vk_username or db_user.vk_channel_name or 'неизвестен'
        logger.warning(f"❌ User {user['id']} ({channel_name}) NOT whitelisted")
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
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{tts_service_url}/api/voices")
        
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
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{tts_service_url}/api/user/voices/{user_id}")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка получения голосов")
    except Exception as e:
        logger.error(f"Error getting user voices: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения голосов")

@user_voices_router.post("/upload")
@limiter.limit("10/minute")
async def upload_user_voice(
    request: Request,
    user_id: int,
    file: UploadFile = File(...),
    name: str = Form(...),
    user: dict = Depends(check_user_whitelisted),
    db: Session = Depends(get_db)
):
    """Загрузить пользовательский голос"""
    try:
        if user['id'] != user_id and not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Вы можете загружать голоса только для себя")
        
        tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        
        # Читаем файл в память для асинхронной отправки
        file_content = await file.read()
        files = {'file': (file.filename, file_content, file.content_type)}
        data = {'name': name, 'user_id': user_id}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
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
# USER VOICE ENABLED ENDPOINTS - /api/user/voices/enabled
# ============================================================================

@user_voices_router.get("/enabled/{user_id}")
async def get_user_enabled_voices(
    user_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список ID включенных голосов для пользователя"""
    try:
        # Проверка доступа
        if user['id'] != user_id and not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Нет доступа")
        
        tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{tts_service_url}/api/tts/user/voices/enabled/{user_id}")
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка получения включенных голосов")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting enabled voices: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения включенных голосов")

@user_voices_router.post("/enabled/{user_id}")
async def update_user_enabled_voices(
    user_id: int,
    voice_ids: List[int],
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить список включенных голосов для пользователя"""
    try:
        # Проверка доступа
        if user['id'] != user_id and not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Нет доступа")
        
        tts_service_url = os.getenv("TTS_SERVICE_URL", DEFAULT_TTS_SERVICE_URL)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{tts_service_url}/api/tts/user/voices/enabled/{user_id}",
                json=voice_ids
            )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Ошибка обновления включенных голосов")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating enabled voices: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления включенных голосов")

# ============================================================================
# LOCAL TTS ENDPOINTS - /api/local-tts
# ============================================================================

@local_tts_router.get("/config")
async def get_local_tts_config(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить конфигурацию локального TTS"""
    try:
        # Определяем тип пользователя
        is_guest = (not user or user.get('id') == -1)
        user_id = user.get('id') if user and user.get('id') != -1 else None
        session_id = user.get('session_id') if is_guest and user else None
        
        # Локальный TTS доступен всем пользователям (не требует whitelist)
        # Это локальный сервис, работающий на машине пользователя
        can_manage_voices = True
        
        # Ищем конфиг по user_id или session_id
        if is_guest and session_id:
            config = db.query(LocalTTSEndpoint).filter(
                LocalTTSEndpoint.session_id == session_id
            ).first()
        elif user_id:
            config = db.query(LocalTTSEndpoint).filter(
                LocalTTSEndpoint.user_id == user_id
            ).first()
        else:
            config = None
        
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
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Сохранить конфигурацию локального TTS"""
    try:
        # Локальный TTS доступен всем пользователям (не требует whitelist)
        # Определяем тип пользователя
        is_guest = (not user or user.get('id') == -1)
        user_id = user.get('id') if user and user.get('id') != -1 else None
        session_id = user.get('session_id') if is_guest and user else None
        
        # Ищем существующий конфиг
        if is_guest and session_id:
            config = db.query(LocalTTSEndpoint).filter(
                LocalTTSEndpoint.session_id == session_id
            ).first()
        elif user_id:
            config = db.query(LocalTTSEndpoint).filter(
                LocalTTSEndpoint.user_id == user_id
            ).first()
        else:
            raise HTTPException(status_code=400, detail="Не удалось определить пользователя")
        
        if config:
            config.endpoint_url = request.endpoint_url
            config.api_key = request.api_key
            config.use_local = request.use_local
            config.updated_at = datetime.utcnow()
            message = "Конфигурация обновлена"
        else:
            config = LocalTTSEndpoint(
                user_id=user_id,
                session_id=session_id,
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
        from core.database import User, WhitelistedChannel
        
        # Проверяем whitelist перед переключением
        db_user = db.query(User).filter(User.id == user["id"]).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        login_platform = user.get('login_platform')
        is_whitelisted = False
        
        if login_platform == 'twitch' and db_user.twitch_username:
            whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == db_user.twitch_username.lower(),
                WhitelistedChannel.platform == 'twitch'
            ).first()
            is_whitelisted = bool(whitelisted)
        elif login_platform == 'vk' and db_user.vk_username:
            whitelisted = db.query(WhitelistedChannel).filter(
                WhitelistedChannel.channel_name == db_user.vk_username.lower(),
                WhitelistedChannel.platform == 'vk'
            ).first()
            is_whitelisted = bool(whitelisted)
        
        if not is_whitelisted:
            channel_name = db_user.twitch_username or db_user.vk_username or 'неизвестен'
            logger.warning(f"❌ User {channel_name} NOT whitelisted, cannot toggle local TTS")
            raise HTTPException(
                status_code=403,
                detail="Локальный TTS доступен только для пользователей из whitelist. Обратитесь к администратору для добавления в whitelist."
            )
        
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
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Проверить подключение к локальному TTS"""
    try:
        # Локальный TTS доступен всем пользователям без whitelist (это их локальный сервис)
        
        # Проверяем health endpoint
        headers = {}
        if request.api_key:
            headers['Authorization'] = f'Bearer {request.api_key}'
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Получаем health данные
            health_response = await client.get(f"{request.endpoint_url}/health", headers=headers)
            
            if health_response.status_code != 200:
                return {
                    "success": False,
                    "error": f"Сервер вернул код {health_response.status_code}"
                }
            
            health_data = health_response.json()
            
            # Получаем status данные
            try:
                status_response = await client.get(f"{request.endpoint_url}/api/status", headers=headers)
                status_data = status_response.json() if status_response.status_code == 200 else None
            except Exception:
                status_data = None
            
            return {
                "success": True,
                "message": "Подключение установлено",
                "health_data": health_data,
                "status_data": status_data
            }
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "Timeout: сервис не отвечает. Убедитесь что он запущен."
        }
    except httpx.ConnectError:
        return {
            "success": False,
            "error": "Не удалось подключиться. Проверьте что сервис запущен и URL корректен."
        }
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        return {
            "success": False,
            "error": f"Ошибка подключения: {str(e)}"
        }

@local_tts_router.post("/sync-global-voices")
async def sync_global_voices_to_local(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Обнаружить голоса в локальном TTS и загрузить их на сайт"""
    try:
        # Получаем конфиг локального TTS
        is_guest = (not user or user.get('id') == -1)
        user_id = user.get('id') if user and user.get('id') != -1 else None
        session_id = user.get('session_id') if is_guest and user else None
        
        if is_guest and session_id:
            config = db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.session_id == session_id).first()
        elif user_id:
            config = db.query(LocalTTSEndpoint).filter(LocalTTSEndpoint.user_id == user_id).first()
        else:
            raise HTTPException(status_code=404, detail="Локальный TTS не настроен")
        
        if not config:
            raise HTTPException(status_code=404, detail="Локальный TTS не настроен")
        
        # Подготавливаем заголовки для локального TTS
        headers = {}
        if config.api_key:
            headers['Authorization'] = f'Bearer {config.api_key}'
        
        # Получаем список голосов в локальном TTS
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                local_voices_response = await client.get(f"{config.endpoint_url}/api/voices/list", headers=headers)
                if local_voices_response.status_code != 200:
                    raise HTTPException(status_code=local_voices_response.status_code, detail="Не удалось подключиться к локальному TTS")
                
                local_voices_data = local_voices_response.json()
                local_voices = local_voices_data.get('voices', [])
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Ошибка подключения к локальному TTS: {str(e)}")
        
        # Возвращаем список обнаруженных голосов
        result = {
            "success": True,
            "message": f"Обнаружено голосов в локальном TTS: {len(local_voices)}",
            "voices": local_voices
        }
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing global voices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка синхронизации голосов: {str(e)}")

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
# TTS CHANNEL POINTS MODE ENDPOINTS (NEW!)
# ============================================================================

@tts_router.get("/mode-settings")
async def get_tts_mode_settings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки режима TTS (все сообщения / за баллы)"""
    try:
        from core.database import TTSUserSettings, User, UserToken
        from api.points_api_endpoints import _decrypt_access_token, _get_vk_channel_name
        from api.twitch_api import TwitchAPI
        from api.vk_api import vk_api
        from core.connection_manager import get_connection_manager
        
        # Получаем настройки пользователя
        settings = db.query(TTSUserSettings).filter(
            TTSUserSettings.user_id == user['id']
        ).first()
        
        if not settings:
            # Создаем дефолтные настройки
            settings = TTSUserSettings(
                user_id=user['id'],
                tts_mode='all_messages',
                tts_reward_ids={}
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        # ✅ СИНХРОНИЗАЦИЯ: Проверяем существование наград на платформах
        tts_reward_ids = settings.tts_reward_ids or {}
        updated_reward_ids = dict(tts_reward_ids)
        needs_update = False
        
        # Проверяем Twitch награду (ВСЕГДА если режим channel_points, даже если нет награды в БД)
        if settings.tts_mode == 'channel_points':
            try:
                twitch_token = db.query(UserToken).filter(
                    UserToken.user_id == user['id'],
                    UserToken.platform == 'twitch',
                    UserToken.is_active == True
                ).first()
                
                if twitch_token and twitch_token.platform_user_id:
                    connection_manager = get_connection_manager()
                    twitch_api = TwitchAPI(connection_manager)
                    
                    # Получаем все награды Twitch (игнорируем 403 ошибки)
                    rewards = None
                    try:
                        rewards = await twitch_api.get_custom_rewards(
                            broadcaster_id=twitch_token.platform_user_id,
                            access_token=_decrypt_access_token(twitch_token.access_token),
                            only_manageable=True
                        )
                        logger.info(f"🔍 [TTS SYNC] Twitch rewards fetched: {len(rewards) if rewards else 0} rewards")
                    except ValueError as e:
                        # Если 403 (не партнер/аффилейт) - используем сохраненный ID если есть
                        error_str = str(e)
                        if '403' in error_str:
                            stored_reward_id = tts_reward_ids.get('twitch')
                            if stored_reward_id:
                                logger.info(f"⚠️ [TTS SYNC] Twitch API недоступен (403), но есть сохраненный ID: {stored_reward_id}")
                                # Оставляем сохраненный ID, не обновляем - пропускаем синхронизацию
                                rewards = None  # None означает что API недоступен, не ищем дальше
                            else:
                                logger.warning(f"⚠️ [TTS SYNC] Twitch API недоступен (403) и нет сохраненного ID")
                                rewards = None
                        else:
                            raise  # Пробрасываем другие ошибки
                    
                    if rewards is not None and rewards:
                        # Twitch API может вернуть {'data': [...]} или просто список
                        rewards_list = rewards.get('data', []) if isinstance(rewards, dict) else rewards
                        if not isinstance(rewards_list, list):
                            rewards_list = []
                        
                        logger.info(f"🔍 [TTS SYNC] Processing {len(rewards_list)} Twitch rewards")
                        
                        # Ищем награду TTS по названию или по сохраненному ID
                        stored_reward_id = tts_reward_ids.get('twitch')
                        found_reward = None
                        
                        # Сначала проверяем по ID
                        if stored_reward_id:
                            found_reward = next((r for r in rewards_list if str(r.get('id')) == str(stored_reward_id)), None)
                            if found_reward:
                                logger.info(f"✅ [TTS SYNC] Found Twitch reward by ID: {stored_reward_id}")
                        
                        # Если не нашли по ID, ищем по названию (TTS, озвучка, etc.)
                        if not found_reward:
                            # Расширенный список ключевых слов для поиска
                            tts_keywords = [
                                'tts', 'озвуч', 'voice', 'voiceover', 'озвучить', 
                                'озвучить сообщение', 'голос', 'speech', 'say',
                                'озвучка', 'озвучить сообщение', 'озвучить моё сообщение',
                                'озвучить мое сообщение', 'tts озвучка', 'tts озвучить'
                            ]
                            for reward in rewards_list:
                                title = reward.get('title', '').lower()
                                logger.debug(f"🔍 [TTS SYNC] Checking reward: '{title}'")
                                # Проверяем все ключевые слова
                                if any(keyword in title for keyword in tts_keywords):
                                    found_reward = reward
                                    logger.info(f"✅ [TTS SYNC] Found Twitch TTS reward by name: '{title}' (ID: {reward.get('id')})")
                                    break
                            
                            # Если все еще не нашли, проверяем описание награды
                            if not found_reward:
                                for reward in rewards_list:
                                    description = reward.get('prompt', '') or reward.get('description', '') or ''
                                    description_lower = description.lower()
                                    if any(keyword in description_lower for keyword in tts_keywords):
                                        found_reward = reward
                                        logger.info(f"✅ [TTS SYNC] Found Twitch TTS reward by description: '{description[:50]}...' (ID: {reward.get('id')})")
                                        break
                        
                        if found_reward:
                            reward_id = str(found_reward.get('id'))
                            if reward_id != stored_reward_id:
                                updated_reward_ids['twitch'] = reward_id
                                needs_update = True
                                logger.info(f"✅ [TTS SYNC] Updated Twitch reward ID: {stored_reward_id} -> {reward_id}")
                        elif stored_reward_id:
                            # Награда была в БД, но не найдена на платформе - удаляем из БД
                            logger.warning(f"⚠️ [TTS SYNC] Twitch reward {stored_reward_id} not found on platform, removing from DB")
                            if 'twitch' in updated_reward_ids:
                                del updated_reward_ids['twitch']
                            needs_update = True
                    else:
                        logger.warning(f"⚠️ [TTS SYNC] No Twitch rewards returned from API")
            except Exception as e:
                logger.error(f"❌ [TTS SYNC] Error syncing Twitch rewards: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        # Проверяем VK награду (ВСЕГДА если режим channel_points, даже если нет награды в БД)
        if settings.tts_mode == 'channel_points':
            try:
                vk_token = db.query(UserToken).filter(
                    UserToken.user_id == user['id'],
                    UserToken.platform == 'vk',
                    UserToken.is_active == True
                ).first()
                
                if vk_token:
                    channel_name = _get_vk_channel_name(user['id'], db)
                    if channel_name:
                        # Получаем все награды VK (используем manage_info для получения всех наград)
                        rewards = None
                        try:
                            # Используем get_rewards_manage_info для получения всех наград (включая управляемые)
                            rewards = await vk_api.get_rewards_manage_info(
                                channel_url=channel_name,
                                access_token=_decrypt_access_token(vk_token.access_token)
                            )
                            logger.info(f"🔍 [TTS SYNC] VK rewards fetched: {len(rewards) if rewards else 0} rewards")
                        except Exception as vk_error:
                            # Если 403 (нет scope) - используем сохраненный ID если есть
                            error_str = str(vk_error)
                            if '403' in error_str or 'scope' in error_str.lower():
                                stored_reward_id = tts_reward_ids.get('vk')
                                if stored_reward_id:
                                    logger.info(f"⚠️ [TTS SYNC] VK API недоступен (403), но есть сохраненный ID: {stored_reward_id}")
                                    # Оставляем сохраненный ID, не обновляем - пропускаем синхронизацию
                                    rewards = None  # None означает что API недоступен, не ищем дальше
                                else:
                                    logger.warning(f"⚠️ [TTS SYNC] VK API недоступен (403) и нет сохраненного ID")
                                    rewards = None
                            else:
                                raise  # Пробрасываем другие ошибки
                        
                        if rewards is not None and rewards:
                            # VK API может вернуть список или объект
                            rewards_list = rewards if isinstance(rewards, list) else (rewards.get('data', []) or rewards.get('rewards', []) or [])
                            if not isinstance(rewards_list, list):
                                rewards_list = []
                            
                            logger.info(f"🔍 [TTS SYNC] Processing {len(rewards_list)} VK rewards")
                            # Логируем все награды для отладки
                            for idx, reward in enumerate(rewards_list):
                                logger.debug(f"🔍 [TTS SYNC] VK Reward #{idx}: {reward}")
                            
                            # Ищем награду TTS по названию или по сохраненному ID
                            stored_reward_id = tts_reward_ids.get('vk')
                            found_reward = None
                            
                            # Сначала проверяем по ID (проверяем все возможные поля)
                            if stored_reward_id:
                                for reward in rewards_list:
                                    # Проверяем все возможные поля для ID
                                    reward_id_candidate = reward.get('id') or reward.get('reward_id') or reward.get('_id')
                                    if reward_id_candidate and str(reward_id_candidate) == str(stored_reward_id):
                                        found_reward = reward
                                        logger.info(f"✅ [TTS SYNC] Found VK reward by ID: {stored_reward_id}")
                                        break
                            
                            # Если не нашли по ID, ищем по названию (даже если есть stored_reward_id - награда могла быть пересоздана)
                            if not found_reward:
                                # Расширенный список ключевых слов для поиска
                                tts_keywords = [
                                    'tts', 'озвуч', 'voice', 'voiceover', 'озвучить', 
                                    'озвучить сообщение', 'голос', 'speech', 'say',
                                    'озвучка', 'озвучить сообщение', 'озвучить моё сообщение',
                                    'озвучить мое сообщение', 'tts озвучка', 'tts озвучить',
                                    'озвучь', 'озвучь сообщение', 'озвучь моё сообщение'
                                ]
                                # Сначала ищем точное совпадение по ключевым словам
                                for reward in rewards_list:
                                    # Проверяем все возможные поля для названия
                                    title = reward.get('title', '') or reward.get('name', '') or reward.get('label', '')
                                    title_lower = title.lower()
                                    logger.debug(f"🔍 [TTS SYNC] Checking VK reward: '{title}' (ID: {reward.get('id') or reward.get('reward_id')})")
                                    # Проверяем все ключевые слова
                                    if any(keyword in title_lower for keyword in tts_keywords):
                                        found_reward = reward
                                        reward_id = str(reward.get('id') or reward.get('reward_id') or 'unknown')
                                        logger.info(f"✅ [TTS SYNC] Found VK TTS reward by name: '{title}' (ID: {reward_id})")
                                        break
                                
                                # Если все еще не нашли, проверяем описание награды
                                if not found_reward:
                                    for reward in rewards_list:
                                        # Проверяем все возможные поля для описания
                                        description = reward.get('description', '') or reward.get('text', '') or reward.get('desc', '')
                                        description_lower = description.lower()
                                        if any(keyword in description_lower for keyword in tts_keywords):
                                            found_reward = reward
                                            reward_id = str(reward.get('id') or reward.get('reward_id') or 'unknown')
                                            logger.info(f"✅ [TTS SYNC] Found VK TTS reward by description: '{description[:50]}...' (ID: {reward_id})")
                                            break
                                
                                # Если все еще не нашли, но есть сохраненный ID - проверяем, может награда просто не в списке manage_info
                                # В этом случае оставляем сохраненный ID (награда может быть создана, но не управляемая)
                                if not found_reward and stored_reward_id:
                                    logger.warning(f"⚠️ [TTS SYNC] VK reward {stored_reward_id} not found in manage_info list, but keeping it (may be non-manageable reward)")
                                    # Не удаляем из БД - награда может существовать, но не быть в списке управляемых
                                    found_reward = None  # Не обновляем, но и не удаляем
                            
                            if found_reward:
                                # Извлекаем ID из всех возможных полей
                                reward_id = str(found_reward.get('id') or found_reward.get('reward_id') or found_reward.get('_id') or '')
                                if reward_id and reward_id != stored_reward_id:
                                    updated_reward_ids['vk'] = reward_id
                                    needs_update = True
                                    logger.info(f"✅ [TTS SYNC] Updated VK reward ID: {stored_reward_id} -> {reward_id}")
                                elif reward_id == stored_reward_id:
                                    logger.info(f"✅ [TTS SYNC] VK reward ID unchanged: {reward_id}")
                            elif stored_reward_id and not found_reward:
                                # Награда была в БД, но не найдена на платформе
                                # НЕ удаляем сразу - возможно награда существует, но не в списке manage_info
                                # Удаляем только если точно уверены, что награды нет (например, после нескольких попыток)
                                logger.warning(f"⚠️ [TTS SYNC] VK reward {stored_reward_id} not found in manage_info, but keeping in DB (may exist but not manageable)")
                                # Не удаляем из БД - оставляем сохраненный ID
                    else:
                        logger.warning(f"⚠️ [TTS SYNC] VK channel name not found for user {user['id']}")
                else:
                    logger.warning(f"⚠️ [TTS SYNC] VK token not found for user {user['id']}")
            except Exception as e:
                logger.error(f"❌ [TTS SYNC] Error syncing VK rewards: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        # Обновляем БД если нашли изменения
        if needs_update:
            settings.tts_reward_ids = updated_reward_ids
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(settings, 'tts_reward_ids')
            db.commit()
            db.refresh(settings)
            logger.info(f"✅ [TTS SYNC] Updated reward IDs: {updated_reward_ids}")
        
        return {
            "success": True,
            "tts_mode": settings.tts_mode,
            "tts_reward_ids": updated_reward_ids
        }
    except Exception as e:
        logger.error(f"Error getting TTS mode settings: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения настроек TTS режима")

class UpdateTtsModeRequest(BaseModel):
    tts_mode: str

@tts_router.post("/mode-settings")
async def update_tts_mode_settings(
    request: UpdateTtsModeRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить режим TTS"""
    try:
        from core.database import TTSUserSettings
        
        tts_mode = request.tts_mode
        
        if tts_mode not in ['all_messages', 'channel_points']:
            raise HTTPException(status_code=400, detail="Неверный режим TTS. Допустимые: all_messages, channel_points")
        
        settings = db.query(TTSUserSettings).filter(
            TTSUserSettings.user_id == user['id']
        ).first()
        
        if not settings:
            settings = TTSUserSettings(
                user_id=user['id'],
                tts_mode=tts_mode,
                tts_reward_ids={}
            )
            db.add(settings)
        else:
            settings.tts_mode = tts_mode
            
            # Если переключаемся на all_messages - очищаем награды
            if tts_mode == 'all_messages':
                settings.tts_reward_ids = {}
        
        db.commit()
        db.refresh(settings)
        
        logger.info(f"✅ User {user['id']} changed TTS mode to: {tts_mode}")
        
        return {
            "success": True,
            "tts_mode": settings.tts_mode,
            "message": f"Режим TTS изменен на: {'Озвучивать все сообщения' if tts_mode == 'all_messages' else 'Озвучивать за баллы канала'}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating TTS mode: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка обновления режима TTS")

class CreateTtsRewardRequest(BaseModel):
    platform: str
    title: str
    cost: int
    cooldown: int = 0

@tts_router.post("/create-reward")
async def create_tts_reward(
    request: CreateTtsRewardRequest,
    starlette_request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Создать награду TTS для платформы
    
    Эта награда будет использоваться для озвучки сообщений через Channel Points
    """
    try:
        from core.database import TTSUserSettings
        
        # Проверяем что пользователь в режиме channel_points
        settings = db.query(TTSUserSettings).filter(
            TTSUserSettings.user_id == user['id']
        ).first()
        
        if not settings or settings.tts_mode != 'channel_points':
            raise HTTPException(
                status_code=400, 
                detail="Для создания TTS награды сначала переключите режим на 'Озвучивать за баллы канала'"
            )
        
        platform = request.platform
        title = request.title
        cost = request.cost
        cooldown = request.cooldown
        
        # Формируем данные для награды
        reward_data = {
            'platform': platform,
            'channel_name': '',
            'title': title or f'TTS Озвучка ({platform.upper()})',
            'description': 'Ваше сообщение будет озвучено голосовым синтезатором!',
            'cost': cost,
            'is_user_input_required': True  # Обязательно требуем сообщение!
        }
        
        # Добавляем платформо-специфичные поля
        if platform == 'vk':
            reward_data.update({
                'repair_timeout': cooldown,
                'max_uses_count': 0,
                'max_uses_count_per_user': 0,
                'is_message_required': True
            })
        elif platform == 'twitch':
            reward_data.update({
                'global_cooldown_seconds': cooldown,
                'max_per_stream': 0,
                'max_per_user_per_stream': 0,
                'should_redemptions_skip_request_queue': True  # Автовыполнение для TTS
            })
        
        # Создаем награду через существующий API
        from api.points_api_endpoints import create_vk_reward, create_twitch_reward
        
        if platform == 'vk':
            from api.points_api_endpoints import CreateRewardRequest
            
            reward_request = CreateRewardRequest(**reward_data)
            result = await create_vk_reward(starlette_request, reward_request, user, db)
        elif platform == 'twitch':
            from api.points_api_endpoints import CreateRewardRequest
            
            reward_request = CreateRewardRequest(**reward_data)
            result = await create_twitch_reward(starlette_request, reward_request, user, db)
        else:
            raise HTTPException(status_code=400, detail="Неподдерживаемая платформа")
        
        # Сохраняем ID награды в настройках
        if result.get('success'):
            logger.info(f"🔍 [TTS REWARD] Result from create_{platform}_reward: {result}")
            reward_data_obj = result.get('reward')
            logger.info(f"🔍 [TTS REWARD] reward_data_obj: {reward_data_obj}")
            
            # Извлекаем ID награды из разных возможных структур
            reward_id = None
            if reward_data_obj:
                # Для VK: {'reward': {'id': '...'}} 
                if isinstance(reward_data_obj, dict) and 'reward' in reward_data_obj:
                    nested_reward = reward_data_obj.get('reward')
                    if isinstance(nested_reward, dict):
                        reward_id = nested_reward.get('id')
                # Для Twitch: {'id': '...'}
                else:
                    reward_id = reward_data_obj.get('id') or reward_data_obj.get('reward_id')
            
            # Обновляем reward_ids (создаем новый dict чтобы SQLAlchemy увидел изменения)
            current_reward_ids = settings.tts_reward_ids or {}
            current_reward_ids[platform] = reward_id
            settings.tts_reward_ids = current_reward_ids
            
            # Помечаем поле как измененное для SQLAlchemy
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(settings, 'tts_reward_ids')
            
            db.commit()
            db.refresh(settings)
            
            logger.info(f"✅ Created TTS reward for {platform}: {reward_id}")
            logger.info(f"✅ Current tts_reward_ids in DB: {settings.tts_reward_ids}")
            
            return {
                "success": True,
                "reward_id": reward_id,
                "platform": platform,
                "message": f"TTS награда создана для {platform.upper()}"
            }
        else:
            raise HTTPException(status_code=500, detail="Не удалось создать награду")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating TTS reward: {e}")
        import traceback
        logger.error(traceback.format_exc())
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка создания TTS награды: {str(e)}")

@tts_router.delete("/reward/{platform}")
async def delete_tts_reward(
    platform: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить TTS награду для платформы"""
    try:
        from core.database import TTSUserSettings
        
        settings = db.query(TTSUserSettings).filter(
            TTSUserSettings.user_id == user['id']
        ).first()
        
        if not settings or not settings.tts_reward_ids or platform not in settings.tts_reward_ids:
            raise HTTPException(status_code=404, detail=f"TTS награда для {platform} не найдена")
        
        reward_id = settings.tts_reward_ids[platform]
        
        # Удаляем награду через существующий API
        from api.points_api_endpoints import delete_vk_reward, delete_twitch_reward
        
        if platform == 'vk':
            await delete_vk_reward(reward_id, user, db)
        elif platform == 'twitch':
            await delete_twitch_reward(reward_id, user, db)
        
        # Удаляем из настроек (создаем новый dict чтобы SQLAlchemy увидел изменения)
        current_reward_ids = dict(settings.tts_reward_ids or {})
        if platform in current_reward_ids:
            del current_reward_ids[platform]
        settings.tts_reward_ids = current_reward_ids
        
        # Помечаем поле как измененное для SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(settings, 'tts_reward_ids')
        
        db.commit()
        db.refresh(settings)
        
        logger.info(f"✅ Deleted TTS reward for {platform}: {reward_id}")
        logger.info(f"✅ Current tts_reward_ids in DB: {settings.tts_reward_ids}")
        
        return {
            "success": True,
            "message": f"TTS награда для {platform.upper()} удалена"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting TTS reward: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка удаления TTS награды")

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

