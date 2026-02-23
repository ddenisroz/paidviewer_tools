import logging
import httpx
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Form, File, UploadFile, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core.database import get_db
from auth.auth import get_current_user
from core.permissions import require_permission, Permission
from core.config import settings
from core.internal_service_auth import build_tts_auth_headers, build_tts_httpx_client_kwargs
from constants import DEFAULT_TTS_SERVICE_URL
from services.tts.tts_core import check_user_whitelisted
from services.voice_management_service import VoiceManagementService
from repositories.user_repository import UserRepository
from repositories.local_tts_repository import LocalTTSRepository
from services.tts.provider_utils import get_provider_service_url, normalize_provider
logger = logging.getLogger('bot_service')
voices_router = APIRouter(prefix='/api/voices', tags=['voices'])
user_voices_router = APIRouter(prefix='/api/user/voices', tags=['user_voices'])

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

def get_voice_service(db: Session=Depends(get_db)) -> VoiceManagementService:
    return VoiceManagementService(db)

def _current_user_id(user: dict) -> int:
    user_id = user.get('id', user.get('user_id'))
    if not isinstance(user_id, int) or user_id <= 0:
        raise HTTPException(status_code=401, detail='Authentication required')
    return user_id

def _tts_auth_headers() -> dict:
    return build_tts_auth_headers()

def _is_admin(user: dict) -> bool:
    return user.get('role') == 'admin' or bool(user.get('is_admin', False))

def _normalize_voice_provider(provider: Optional[str]) -> str:
    normalized = normalize_provider(provider or 'f5')
    return 'qwen' if normalized == 'qwen' else 'f5'

def _provider_base_url(provider: str) -> str:
    resolved_provider = _normalize_voice_provider(provider)
    return get_provider_service_url(resolved_provider) or settings.tts_service_url or DEFAULT_TTS_SERVICE_URL

@voices_router.get('/whitelist-status')
async def check_whitelist_status(user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Check whether the current user can manage advanced voices."""
    try:
        if not user or not user.get('id') or user.get('id') <= 0:
            return {'is_whitelisted': False, 'can_manage_voices': False, 'message': 'Authentication required'}
        user_repo = UserRepository(db)
        local_repo = LocalTTSRepository(db)
        db_user = user_repo.get_by_id(user['id'])
        if not db_user:
            return {'is_whitelisted': False, 'can_manage_voices': False}
        local_f5_endpoint = local_repo.get_active(user_id=user['id'], provider='f5')
        local_qwen_endpoint = local_repo.get_active(user_id=user['id'], provider='qwen')
        has_local_setup = bool(local_f5_endpoint and local_f5_endpoint.is_healthy or (local_qwen_endpoint and local_qwen_endpoint.is_healthy))
        if has_local_setup:
            logger.info('[LOCAL] User %s has local TTS setup, allowing voice management', user['id'])
            return {'is_whitelisted': True, 'can_manage_voices': True, 'has_local_setup': True}
        from utils.whitelist_cache import is_channel_whitelisted_cached, is_user_whitelisted_cached
        is_whitelisted = is_user_whitelisted_cached(db_user, db)
        if is_whitelisted:
            if db_user.twitch_username and is_channel_whitelisted_cached(db_user.twitch_username.lower(), 'twitch', db):
                logger.info('[OK] User %s (%s) whitelisted on Twitch', user['id'], db_user.twitch_username)
                return {'is_whitelisted': True, 'can_manage_voices': True, 'platform': 'twitch'}
            vk_channel = db_user.vk_channel_name or db_user.vk_username
            if vk_channel and is_channel_whitelisted_cached(vk_channel.lower(), 'vk', db):
                logger.info('[OK] User %s (%s) whitelisted on VK', user['id'], vk_channel)
                return {'is_whitelisted': True, 'can_manage_voices': True, 'platform': 'vk'}
            channel_name = db_user.twitch_username or db_user.vk_username or db_user.vk_channel_name or 'unknown'
            login_platform = user.get('login_platform')
            logger.warning('[WARN] User %s (%s) is_whitelisted=True but platform not found, allowing access anyway', user['id'], channel_name)
            return {'is_whitelisted': True, 'can_manage_voices': True, 'platform': login_platform or 'unknown'}
        channel_name = db_user.twitch_username or db_user.vk_username or db_user.vk_channel_name or 'unknown'
        logger.warning('[ERROR] User %s (%s) NOT whitelisted', user['id'], channel_name)
        return {'is_whitelisted': False, 'can_manage_voices': False}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error checking whitelist status')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.get('/', response_model=List[VoiceSchema])
async def get_all_voices(request: Request, user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Get merged voice list for selected provider."""
    try:
        resolved_provider = _normalize_voice_provider(provider)
        return await service.get_global_voices(provider=resolved_provider)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting voices')
        raise HTTPException(status_code=500, detail='Internal server error')

@user_voices_router.get('/{user_id}')
async def get_user_voices(user_id: int, request: Request, user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Text cleaned."""
    try:
        actor_id = _current_user_id(user)
        if actor_id != user_id and (not _is_admin(user)):
            raise HTTPException(status_code=403, detail='Access denied')
        resolved_provider = _normalize_voice_provider(provider)
        return await service.get_user_custom_voices(user_id, provider=resolved_provider)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting user voices')
        raise HTTPException(status_code=500, detail='Internal server error')

@user_voices_router.post('/upload')
async def upload_user_voice(request: Request, user_id: int, file: UploadFile=File(...), name: str=Form(...), user: dict=Depends(check_user_whitelisted), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Text cleaned."""
    try:
        if user['id'] != user_id and (not _is_admin(user)):
            raise HTTPException(status_code=403, detail='Operation failed.')
        file_content = await file.read()
        return await service.upload_user_voice(user_id=user_id, name=name, filename=file.filename, content=file_content, content_type=file.content_type, provider=_normalize_voice_provider(provider))
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error uploading voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@user_voices_router.get('/enabled/{user_id}')
async def get_user_enabled_voices(user_id: int, user: dict=Depends(get_current_user), db: Session=Depends(get_db), provider: str='f5'):
    """Text cleaned."""
    try:
        if user['id'] != user_id and (not _is_admin(user)):
            raise HTTPException(status_code=403, detail='Operation failed.')
        resolved_provider = _normalize_voice_provider(provider)
        tts_service_url = get_provider_service_url(resolved_provider) or settings.tts_service_url or DEFAULT_TTS_SERVICE_URL
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.get(f'{tts_service_url}/api/tts/user/voices/enabled/{user_id}', headers=_tts_auth_headers())
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail='Operation failed.')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting enabled voices')
        raise HTTPException(status_code=500, detail='Internal server error')

@user_voices_router.post('/enabled/{user_id}')
async def update_user_enabled_voices(user_id: int, voice_ids: List[int], user: dict=Depends(get_current_user), db: Session=Depends(get_db), provider: str='f5'):
    """Text cleaned."""
    try:
        if user['id'] != user_id and (not _is_admin(user)):
            raise HTTPException(status_code=403, detail='Operation failed.')
        resolved_provider = _normalize_voice_provider(provider)
        tts_service_url = get_provider_service_url(resolved_provider) or settings.tts_service_url or DEFAULT_TTS_SERVICE_URL
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(f'{tts_service_url}/api/tts/user/voices/enabled/{user_id}', json=voice_ids, headers=_tts_auth_headers())
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail='Operation failed.')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error updating enabled voices')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.get('/user/custom')
async def get_user_custom_voices(current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Get user's custom voices (user-uploaded voices)"""
    try:
        user_id = _current_user_id(current_user)
        voices = await service.get_user_custom_voices(user_id, provider=_normalize_voice_provider(provider))
        return {'success': True, 'voices': voices}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error fetching custom voices')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.get('/global')
async def get_global_voices(current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Get all global voices"""
    try:
        resolved_provider = _normalize_voice_provider(provider)
        voices_data = await service.get_global_voices(provider=resolved_provider)
        user_id = _current_user_id(current_user)
        user_settings = service.repository.get_by_user_id(user_id, tts_provider=resolved_provider)
        settings_map = {setting.voice_id: {'cfg_strength': setting.cfg_strength, 'speed_preset': setting.speed_preset, 'volume': setting.volume} for setting in user_settings}
        for voice in voices_data:
            voice_id = voice.get('id')
            if voice_id in settings_map:
                voice['user_settings'] = settings_map[voice_id]
            else:
                voice['user_settings'] = None
        return {'success': True, 'voices': voices_data}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error fetching global voices')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.put('/user/settings/{voice_id}')
async def update_user_voice_settings(voice_id: int, settings_data: dict, current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """
    Update user's personal settings for a voice.
    """
    try:
        user_id = _current_user_id(current_user)
        result = await service.update_user_voice_settings(user_id, voice_id, settings_data, provider=_normalize_voice_provider(provider))
        return {'success': True, 'message': 'Voice settings updated', 'settings': result}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error updating voice settings')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.delete('/user/custom/{voice_id}')
async def delete_custom_voice(voice_id: int, current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Delete a user's custom voice"""
    try:
        user_id = _current_user_id(current_user)
        await service.delete_custom_voice(user_id, voice_id, provider=_normalize_voice_provider(provider))
        return {'success': True, 'message': 'Custom voice deleted successfully'}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error deleting custom voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.post('/{voice_id}/test')
async def test_voice(voice_id: int, payload: dict=Body(default={}), current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Synthesize a short preview for selected voice."""
    try:
        actor_id = _current_user_id(current_user)
        resolved_provider = _normalize_voice_provider(provider)
        voice_info = await service.get_voice_info(voice_id, provider=resolved_provider)
        if not voice_info:
            raise HTTPException(status_code=404, detail='Voice not found')
        voice_name = voice_info.get('name')
        if not voice_name:
            raise HTTPException(status_code=400, detail='Voice metadata is invalid')
        owner_id_raw = voice_info.get('owner_id')
        owner_id = owner_id_raw if isinstance(owner_id_raw, int) and owner_id_raw > 0 else None
        is_global_voice = bool(voice_info.get('is_global')) or voice_info.get('type') == 'global' or owner_id is None
        if not is_global_voice and owner_id is not None and (owner_id != actor_id) and (not _is_admin(current_user)):
            raise HTTPException(status_code=403, detail='Access denied')
        test_text = str(payload.get('text') or payload.get('test_text') or '').strip()
        if not test_text:
            raise HTTPException(status_code=400, detail='text is required')
        upstream_data = {'voice_name': voice_name, 'user_id': str(owner_id or actor_id), 'test_text': test_text}
        if payload.get('cfg_strength') is not None:
            upstream_data['cfg_strength'] = str(payload['cfg_strength'])
        if payload.get('speed_preset') is not None:
            upstream_data['speed_preset'] = str(payload['speed_preset'])
        async with httpx.AsyncClient(timeout=30.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(f'{_provider_base_url(resolved_provider)}/api/admin/voices/test', data=upstream_data, headers=_tts_auth_headers())
        if response.status_code == 200:
            return response.json()
        detail = 'Failed to synthesize test voice'
        try:
            detail = response.json().get('detail', detail)
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error testing voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.put('/user/{voice_id}/rename')
async def rename_user_voice(voice_id: int, payload: dict=Body(default={}), current_user: dict=Depends(get_current_user), provider: str='f5'):
    """Rename a user voice in selected provider service."""
    try:
        actor_id = _current_user_id(current_user)
        user_id = payload.get('user_id')
        if not isinstance(user_id, int):
            raise HTTPException(status_code=400, detail='user_id is required')
        if actor_id != user_id and (not _is_admin(current_user)):
            raise HTTPException(status_code=403, detail='Access denied')
        new_name = str(payload.get('new_name') or '').strip()
        if not new_name:
            raise HTTPException(status_code=400, detail='new_name is required')
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.put(f'{_provider_base_url(provider)}/api/tts/user/voices/{voice_id}/rename', params={'user_id': user_id}, data={'new_name': new_name}, headers=_tts_auth_headers())
        if response.status_code == 200:
            return response.json()
        detail = 'Failed to rename voice'
        try:
            detail = response.json().get('detail', detail)
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error renaming user voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.post('/user/{voice_id}/retranscribe')
async def retranscribe_user_voice(voice_id: int, payload: dict=Body(default={}), current_user: dict=Depends(get_current_user), provider: str='f5'):
    """Retranscribe user voice in selected provider service."""
    try:
        actor_id = _current_user_id(current_user)
        payload_user_id = payload.get('user_id')
        user_id = payload_user_id if isinstance(payload_user_id, int) else actor_id
        if actor_id != user_id and (not _is_admin(current_user)):
            raise HTTPException(status_code=403, detail='Access denied')
        async with httpx.AsyncClient(timeout=60.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(f'{_provider_base_url(provider)}/api/tts/user/voices/{voice_id}/retranscribe', params={'user_id': user_id}, headers=_tts_auth_headers())
        if response.status_code == 200:
            return response.json()
        detail = 'Failed to retranscribe user voice'
        try:
            detail = response.json().get('detail', detail)
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error retranscribing user voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.get('/admin/global')
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_get_global_voices(current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Admin: Get all global voices"""
    try:
        voices = await service.admin_get_global_voices(provider=_normalize_voice_provider(provider))
        return {'success': True, 'voices': voices}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error fetching global voices')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.put('/admin/global/{voice_id}')
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_update_global_voice(voice_id: int, settings_data: dict, current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Admin: Update global voice settings (affects all users by default)"""
    try:
        resolved_provider = _normalize_voice_provider(provider)
        result = await service.admin_update_global_voice(voice_id, settings_data, provider=resolved_provider)
        return {'success': True, 'message': 'Global voice settings updated', 'settings': result}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error updating global voice settings')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.delete('/admin/global/{voice_id}')
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_delete_global_voice(voice_id: int, current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Admin: Delete a global voice"""
    try:
        resolved_provider = _normalize_voice_provider(provider)
        await service.admin_delete_global_voice(voice_id, provider=resolved_provider)
        service.repository.delete_by_voice_id(voice_id, tts_provider=resolved_provider)
        return {'success': True, 'message': 'Global voice deleted successfully'}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error deleting global voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.put('/admin/global/{voice_id}/rename')
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_rename_global_voice(voice_id: int, payload: dict=Body(default={}), new_name: Optional[str]=None, current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Admin: Rename a global voice"""
    try:
        resolved_name = (payload.get('new_name') if isinstance(payload, dict) else None) or new_name
        if not resolved_name:
            raise HTTPException(status_code=400, detail='new_name is required')
        await service.admin_rename_global_voice(voice_id, resolved_name, provider=_normalize_voice_provider(provider))
        return {'success': True, 'message': 'Global voice renamed successfully', 'new_name': resolved_name}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error renaming global voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.post('/admin/global/{voice_id}/transcribe')
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_transcribe_global_voice(voice_id: int, current_user: dict=Depends(get_current_user), provider: str='f5'):
    """Admin: transcribe a global voice (alias to retranscribe)."""
    try:
        async with httpx.AsyncClient(timeout=60.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(f'{_provider_base_url(provider)}/api/admin/voices/{voice_id}/retranscribe', headers=_tts_auth_headers())
        if response.status_code == 200:
            return response.json()
        detail = 'Failed to transcribe voice'
        try:
            detail = response.json().get('detail', detail)
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error transcribing global voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.post('/admin/global/{voice_id}/retranscribe')
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_retranscribe_global_voice(voice_id: int, current_user: dict=Depends(get_current_user), provider: str='f5'):
    """Admin: retranscribe a global voice."""
    try:
        async with httpx.AsyncClient(timeout=60.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(f'{_provider_base_url(provider)}/api/admin/voices/{voice_id}/retranscribe', headers=_tts_auth_headers())
        if response.status_code == 200:
            return response.json()
        detail = 'Failed to retranscribe voice'
        try:
            detail = response.json().get('detail', detail)
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error retranscribing global voice')
        raise HTTPException(status_code=500, detail='Internal server error')

@voices_router.post('/admin/upload')
@require_permission(Permission.MANAGE_GLOBAL_VOICES)
async def admin_upload_voice(request: Request, file: UploadFile=File(...), voice_name: str=Form(...), current_user: dict=Depends(get_current_user), service: VoiceManagementService=Depends(get_voice_service), provider: str='f5'):
    """Admin: Upload a global voice"""
    try:
        file_content = await file.read()
        result = await service.admin_upload_voice(name=voice_name, filename=file.filename, content=file_content, content_type=file.content_type, provider=_normalize_voice_provider(provider))
        return {'success': True, 'message': 'Global voice uploaded successfully', 'voice': result}
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error uploading global voice')
        raise HTTPException(status_code=500, detail='Internal server error')

