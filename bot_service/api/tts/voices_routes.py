import logging
import httpx
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Form, File, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from auth.auth import get_current_user
from core.permissions import require_permission, Permission
from core.config import settings
from constants import DEFAULT_TTS_SERVICE_URL
from services.user_identity_service import UserIdentityService
from services.tts.tts_core import check_user_whitelisted
from services.voice_management_service import VoiceManagementService
from repositories.user_repository import UserRepository
from repositories.local_tts_repository import LocalTTSRepository

logger = logging.getLogger('bot_service')

voices_router = APIRouter(prefix="/api/voices", tags=["voices"])
user_voices_router = APIRouter(prefix="/api/user/voices", tags=["user_voices"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

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

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_voice_service(db: Session = Depends(get_db)) -> VoiceManagementService:
    return VoiceManagementService(db)


# ============================================================================
# VOICES ENDPOINTS - /api/voices
# ============================================================================

@voices_router.get("/whitelist-status")
async def check_whitelist_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Проверить статус whitelist для управления голосами (только для авторизованных пользователей)
    """
    try:
        if not user or not user.get('id') or user.get('id') <= 0:
            return {
                "is_whitelisted": False,
                "can_manage_voices": False,
                "message": "Требуется авторизация"
            }

        user_repo = UserRepository(db)
        local_repo = LocalTTSRepository(db)
        
        db_user = user_repo.get_by_id(user['id'])
        if not db_user:
            return {"is_whitelisted": False, "can_manage_voices": False}

        # Проверяем наличие локального TTS endpoint
        local_endpoint = local_repo.get_active(user_id=user['id'])
        has_local_setup = local_endpoint and local_endpoint.is_healthy

        # Если есть локальный endpoint - разрешаем доступ к управлению голосами без whitelist
        if has_local_setup:
            logger.info(f"[LOCAL] User {user['id']} has local TTS setup, allowing voice management")
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
            
            # Проверяем Twitch whitelist
            if db_user.twitch_username:
                from utils.whitelist_cache import is_channel_whitelisted_cached
                if is_channel_whitelisted_cached(db_user.twitch_username.lower(), 'twitch', db):
                    platform = "twitch"
                    logger.info(f"[OK] User {user['id']} ({db_user.twitch_username}) whitelisted on Twitch")
                    return {"is_whitelisted": True, "can_manage_voices": True, "platform": platform}

            # Проверяем VK whitelist (username или channel_name)
            if db_user.vk_username or db_user.vk_channel_name:
                from utils.whitelist_cache import is_channel_whitelisted_cached
                vk_channel = db_user.vk_channel_name or db_user.vk_username
                if vk_channel and is_channel_whitelisted_cached(vk_channel.lower(), 'vk', db):
                    platform = "vk"
                    logger.info(f"[OK] User {user['id']} ({vk_channel}) whitelisted on VK")
                    return {"is_whitelisted": True, "can_manage_voices": True, "platform": platform}

            # Если is_whitelisted вернул True, но platform не определился - все равно разрешаем
            channel_name = db_user.twitch_username or db_user.vk_username or db_user.vk_channel_name or 'неизвестен'
            logger.warning(f"[WARN] User {user['id']} ({channel_name}) is_whitelisted=True but platform not found, allowing access anyway")
            return {"is_whitelisted": True, "can_manage_voices": True, "platform": login_platform or "unknown"}

        channel_name = db_user.twitch_username or db_user.vk_username or db_user.vk_channel_name or 'неизвестен'
        logger.warning(f"[ERROR] User {user['id']} ({channel_name}) NOT whitelisted")
        return {"is_whitelisted": False, "can_manage_voices": False}

    except Exception as e:
        logger.error(f"Error checking whitelist status: {e}")
        raise HTTPException(status_code=500, detail="Ошибка проверки whitelist")

@voices_router.get("/", response_model=List[VoiceSchema])
async def get_all_voices(
    request: Request,
    user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Получить все голоса"""
    try:
        # NOTE: This seems to duplicate get_global_voices functionality or intends to get ALL voices?
        # Based on previous implementation: it called TTS_SERVICE_URL/api/voices
        # Let's use the service method for global voices as that seems to be the intent from similar endpoints,
        # OR better, if TTS service has a general endpoint, we should expose it via service.
        # But looking at pydantic model, it expects list of voices. 
        # Making it consistent: usually this endpoint returns global voices available to everyone.
        return await service.get_global_voices() 
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
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Получить все голоса пользователя"""
    try:
        return await service.get_user_custom_voices(user_id)
    except Exception as e:
        logger.error(f"Error getting user voices: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения голосов")

@user_voices_router.post("/upload")
async def upload_user_voice(
    request: Request,
    user_id: int,
    file: UploadFile = File(...),
    name: str = Form(...),
    user: dict = Depends(check_user_whitelisted),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Загрузить пользовательский голос"""
    try:
        if user['id'] != user_id and not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Вы можете загружать голоса только для себя")

        # Read file content
        file_content = await file.read()

        # Delegate to service
        return await service.upload_user_voice(
            user_id=user_id,
            name=name,
            filename=file.filename,
            content=file_content,
            content_type=file.content_type
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading voice: {e}")
        raise HTTPException(status_code=500, detail="Ошибка загрузки голоса")

@user_voices_router.get("/enabled/{user_id}")
async def get_user_enabled_voices(
    user_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список ID включенных голосов для пользователя"""
    try:
        # TODO: Move to service
        if user['id'] != user_id and not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Нет доступа")

        tts_service_url = settings.tts_service_url or DEFAULT_TTS_SERVICE_URL
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
        # TODO: Move to service
        if user['id'] != user_id and not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Нет доступа")

        tts_service_url = settings.tts_service_url or DEFAULT_TTS_SERVICE_URL
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
# VOICE MANAGEMENT ENDPOINTS (Custom and Global Voices)
# ============================================================================

@voices_router.get("/user/custom")
async def get_user_custom_voices(
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Get user's custom voices (user-uploaded voices)"""
    try:
        user_id = current_user.get("user_id")
        voices = await service.get_user_custom_voices(user_id)
        return {"success": True, "voices": voices}
    except Exception as e:
        logger.error(f"Error fetching custom voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@voices_router.get("/global")
async def get_global_voices(
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Get all global voices"""
    try:
        # NOTE: logic for merging local settings is NOT in the service get_global_voices method I saw?
        # WAIT. In step 353 (original voices_api.py), get_global_voices did merging logic.
        # In step 362 (VoiceManagementService), get_global_voices ONLY calls the external API.
        # This is a regression if I don't move the merging logic to Service or keep it here.
        # Ideally, Service.get_global_voices should take user_id and do the merging.
        # I cannot edit Service in this step easily (best practice).
        # I will IMPLEMENT the merging logic here using the Service to fetch raw data+Repo, 
        # OR honestly, I should have updated the Service to handle this.
        # Given the instruction "Replace... with service", I must be careful not to lose feature.
        # I will fetch data from service and do the merging using Repo here (clean-ish controller logic)
        # OR update the Service later. 
        # Let's check if I can use the same logic as before but using Service for the external call.
        
        voices_data = await service.get_global_voices()
        
        # We still need DB for user settings merging
        # Accessing repo through service? service.repository exists.
        
        user_id = current_user.get("user_id")
        user_settings = service.repository.get_by_user_id(user_id)
        
        settings_map = {
            setting.voice_id: {
                "cfg_strength": setting.cfg_strength,
                "speed_preset": setting.speed_preset,
                "volume": setting.volume
            }
            for setting in user_settings
        }

        for voice in voices_data:
            voice_id = voice.get("id")
            if voice_id in settings_map:
                voice["user_settings"] = settings_map[voice_id]
            else:
                voice["user_settings"] = None

        return {
            "success": True,
            "voices": voices_data
        }

    except Exception as e:
        logger.error(f"Error fetching global voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@voices_router.put("/user/settings/{voice_id}")
async def update_user_voice_settings(
    voice_id: int,
    settings_data: dict, 
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """
    Update user's personal settings for a voice.
    """
    try:
        user_id = current_user.get("user_id")
        
        # Service handles the logic of checking global vs custom and updating repo vs external
        result = await service.update_user_voice_settings(user_id, voice_id, settings_data)
        
        # Construct message based on result (Service returns the settings object/dict)
        # The service returns the updated settings dict.
        
        return {
            "success": True,
            "message": "Voice settings updated",
            "settings": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating voice settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@voices_router.delete("/user/custom/{voice_id}")
async def delete_custom_voice(
    voice_id: int,
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Delete a user's custom voice"""
    try:
        user_id = current_user.get("user_id")
        await service.delete_custom_voice(user_id, voice_id)
        
        return {
            "success": True,
            "message": "Custom voice deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting custom voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints for global voice management

@voices_router.get("/admin/global")
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_get_global_voices(
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Admin: Get all global voices"""
    try:
        voices = await service.admin_get_global_voices()
        return {"success": True, "voices": voices}
    except Exception as e:
        logger.error(f"Error fetching global voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@voices_router.put("/admin/global/{voice_id}")
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_update_global_voice(
    voice_id: int,
    settings_data: dict,
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Admin: Update global voice settings (affects all users by default)"""
    try:
        result = await service.admin_update_global_voice(voice_id, settings_data)
        return {
            "success": True,
            "message": "Global voice settings updated",
            "settings": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating global voice settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@voices_router.delete("/admin/global/{voice_id}")
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_delete_global_voice(
    voice_id: int,
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service),
    db: Session = Depends(get_db) 
):
    """Admin: Delete a global voice"""
    try:
        # We need to delete local settings too. API did `delete_voice_settings(db, voice_id)`
        # Service `admin_delete_global_voice` DOES NOT seem to delete local settings in DB?
        # I need to check service code again. 
        # checked: `admin_delete_global_voice` in service ONLY calls external API.
        # It does NOT clean up local UserVoiceSettings.
        # So I must do it here or update Service.
        # I will do it here using service.repository
        
        await service.admin_delete_global_voice(voice_id)
        
        # Clean up local settings
        service.repository.delete_by_voice_id(voice_id)
        
        return {
            "success": True,
            "message": "Global voice deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting global voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@voices_router.put("/admin/global/{voice_id}/rename")
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_rename_global_voice(
    voice_id: int,
    new_name: str,
    current_user: dict = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Admin: Rename a global voice"""
    try:
        await service.admin_rename_global_voice(voice_id, new_name)
        return {
            "success": True,
            "message": "Global voice renamed successfully",
            "new_name": new_name
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming global voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))
