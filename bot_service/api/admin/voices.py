from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from core.config import settings
from core.internal_service_auth import build_tts_auth_headers, build_tts_httpx_client_kwargs
from repositories.user_voice_settings_repository import UserVoiceSettingsRepository
from typing import Optional
import logging
import httpx
import os
import tempfile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _tts_unavailable_error(tts_url: str) -> HTTPException:
    detail = {
        "error": "tts_service_unavailable",
        "message": "TTS service is unavailable",
        "tts_service_url": tts_url,
    }
    return HTTPException(status_code=503, detail=detail)


def _tts_auth_headers() -> dict:
    return build_tts_auth_headers()


def _raise_tts_upstream_error(response: httpx.Response, operation: str) -> None:
    status_code = response.status_code
    raw_body = (response.text or "").strip()
    if raw_body:
        logger.warning(
            "TTS upstream error during %s: status=%s body=%s",
            operation,
            status_code,
            raw_body[:500],
        )
    else:
        logger.warning("TTS upstream error during %s: status=%s", operation, status_code)

    if status_code == 400:
        detail = "Invalid request to TTS service"
    elif status_code in (401, 403):
        detail = "TTS service authorization failed"
    elif status_code == 404:
        detail = "Resource not found in TTS service"
    else:
        detail = "TTS service request failed"

    raise HTTPException(status_code=status_code, detail=detail)

@router.put("/voices/{voice_id}/settings")
async def update_voice_settings(
    voice_id: int,
    settings_dict: dict = Body(..., embed=False, description="Voice settings"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±РЅРѕРІРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё РіРѕР»РѕСЃР°
    
    Р”Р»СЏ РіР»РѕР±Р°Р»СЊРЅС‹С… РіРѕР»РѕСЃРѕРІ: РѕР±РЅРѕРІР»СЏРµС‚ РЅР°СЃС‚СЂРѕР№РєРё СЃР°РјРѕРіРѕ РіРѕР»РѕСЃР° РІ TTS Service (reference_text, cfg_strength, speed_preset)
    Р”Р»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РіРѕР»РѕСЃРѕРІ: РѕР±РЅРѕРІР»СЏРµС‚ РЅР°СЃС‚СЂРѕР№РєРё РІ TTS Service
    РўР°РєР¶Рµ СЃРѕР·РґР°С‘С‚/РѕР±РЅРѕРІР»СЏРµС‚ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹Рµ РЅР°СЃС‚СЂРѕР№РєРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ bot_service (UserVoiceSettings)
    """
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° (С‚РѕР»СЊРєРѕ Р°РґРјРёРЅ РјРѕР¶РµС‚ РѕР±РЅРѕРІР»СЏС‚СЊ РґРµС„РѕР»С‚С‹)
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        user_id = user['id']
        
        # Р”Р»СЏ РіР»РѕР±Р°Р»СЊРЅС‹С… РіРѕР»РѕСЃРѕРІ: РѕР±РЅРѕРІР»СЏРµРј СЃР°Рј РіРѕР»РѕСЃ РІ TTS Service (reference_text, cfg_strength, speed_preset)
        # РћС‚РїСЂР°РІР»СЏРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє РіРѕР»РѕСЃР°
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.put(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/settings",
                json=settings_dict,
                headers=_tts_auth_headers(),
            )
        if response.status_code != 200:
            _raise_tts_upstream_error(response, "update voice settings")
        logger.info(f"[OK] Voice {voice_id} settings updated in TTS Service")
        
        # РЎРѕР·РґР°С‘Рј/РѕР±РЅРѕРІР»СЏРµРј РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹Рµ РЅР°СЃС‚СЂРѕР№РєРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ bot_service
        repo = UserVoiceSettingsRepository(db)
        voice_settings = repo.update_or_create_by_voice_id(user_id, voice_id, settings_dict)
        
        logger.info(f"[OK] Voice settings updated for user {user_id}, voice {voice_id}: {settings_dict}")
        
        return {
            "status": "success",
            "message": "РќР°СЃС‚СЂРѕР№РєРё РіРѕР»РѕСЃР° РѕР±РЅРѕРІР»РµРЅС‹",
            "settings": {
                "voice_id": voice_settings.voice_id,
                "cfg_strength": voice_settings.cfg_strength,
                "speed_preset": voice_settings.speed_preset,
                "volume": voice_settings.volume
            }
        }
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while updating voice settings: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Update voice settings error")
        raise HTTPException(status_code=500, detail="Internal server error")

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
    """РўРµСЃС‚РёСЂРѕРІР°С‚СЊ РіРѕР»РѕСЃ СЃ Р·Р°РґР°РЅРЅС‹Рј С‚РµРєСЃС‚РѕРј Рё РЅР°СЃС‚СЂРѕР№РєР°РјРё (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ С‚РµСЃС‚РёСЂРѕРІР°С‚СЊ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ user_id СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ С‚РµРєСѓС‰РµРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ
        if user.get('id') != user_id:
            raise HTTPException(status_code=403, detail="User ID mismatch")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџРѕРґРіРѕС‚Р°РІР»РёРІР°РµРј РґР°РЅРЅС‹Рµ РґР»СЏ FormData РІ TTS Service
        data = {
            'voice_name': voice_name,
            'user_id': str(user_id),
            'test_text': test_text,
        }
        if cfg_strength is not None:
            data['cfg_strength'] = str(cfg_strength)
        if speed_preset is not None:
            data['speed_preset'] = speed_preset
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        async with httpx.AsyncClient(timeout=30.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/admin/voices/test",
                data=data,
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "test voice")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while testing voice: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Test voice error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/voices")
async def get_admin_voices(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РІСЃРµС… РіРѕР»РѕСЃРѕРІ (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ РїСЂРѕСЃРјР°С‚СЂРёРІР°С‚СЊ РІСЃРµ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.get(
                f"{TTS_SERVICE_URL}/api/admin/voices",
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "list admin voices")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        # TTS СЃРµСЂРІРёСЃ РЅРµРґРѕСЃС‚СѓРїРµРЅ - РІРѕР·РІСЂР°С‰Р°РµРј РїСѓСЃС‚РѕР№ СЃРїРёСЃРѕРє СЃ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµРј
        TTS_SERVICE_URL = settings.tts_service_url
        logger.warning(f"TTS Service РЅРµРґРѕСЃС‚СѓРїРµРЅ ({TTS_SERVICE_URL}): {e}. Р’РѕР·РІСЂР°С‰Р°СЋ РїСѓСЃС‚РѕР№ СЃРїРёСЃРѕРє РіРѕР»РѕСЃРѕРІ.")
        return {
            "success": True,
            "voices": [],
            "global_voices": [],
            "user_voices": [],
            "warning": f"TTS СЃРµСЂРІРёСЃ РЅРµРґРѕСЃС‚СѓРїРµРЅ ({TTS_SERVICE_URL}). РЈР±РµРґРёС‚РµСЃСЊ, С‡С‚Рѕ TTS СЃРµСЂРІРёСЃ Р·Р°РїСѓС‰РµРЅ.",
            "tts_service_url": TTS_SERVICE_URL
        }
    except Exception:
        logger.exception("Get admin voices error")
        # Р”Р»СЏ РґСЂСѓРіРёС… РѕС€РёР±РѕРє С‚РѕР¶Рµ РІРѕР·РІСЂР°С‰Р°РµРј РїСѓСЃС‚РѕР№ СЃРїРёСЃРѕРє РІРјРµСЃС‚Рѕ 500
        TTS_SERVICE_URL = settings.tts_service_url
        return {
            "success": True,
            "voices": [],
            "global_voices": [],
            "user_voices": [],
            "warning": "TTS service connection error",
            "tts_service_url": TTS_SERVICE_URL
        }

@router.post("/voices/upload")
async def upload_voice_proxy(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р—Р°РіСЂСѓР·РёС‚СЊ РіРѕР»РѕСЃ (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    from validators.file_validators import validate_file_magic_number, ALLOWED_AUDIO_TYPES, validate_voice_file
    
    temp_file_path = None
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ Р·Р°РіСЂСѓР¶Р°С‚СЊ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # [OK] SECURITY: Р’Р°Р»РёРґР°С†РёСЏ С„Р°Р№Р»Р° (СЂР°Р·РјРµСЂ, С‚РёРї, РёРјСЏ)
        validate_voice_file(file)
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Р§РёС‚Р°РµРј С„Р°Р№Р»
        file_content = await file.read()
        
        # [OK] SECURITY: РЎРѕС…СЂР°РЅСЏРµРј РІРѕ РІСЂРµРјРµРЅРЅС‹Р№ С„Р°Р№Р» РґР»СЏ РїСЂРѕРІРµСЂРєРё magic numbers
        with tempfile.NamedTemporaryFile(delete=False, suffix='.tmp') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        # [OK] SECURITY: РџСЂРѕРІРµСЂСЏРµРј magic numbers (СЂРµР°Р»СЊРЅС‹Р№ С‚РёРї С„Р°Р№Р»Р°)
        is_valid, error = validate_file_magic_number(temp_file_path, ALLOWED_AUDIO_TYPES)
        
        if not is_valid:
            logger.warning(
                f"[BLOCKED] [SECURITY] Admin voice upload rejected - invalid magic number: "
                f"admin={user.get('id')}, filename={file.filename}, error={error}"
            )
            raise HTTPException(
                status_code=400,
                detail="Invalid file content. File may be malicious or corrupted."
            )
        
        logger.info(f"[OK] [SECURITY] Admin voice file validated: admin={user.get('id')}, filename={file.filename}")
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        async with httpx.AsyncClient(timeout=60.0, **build_tts_httpx_client_kwargs()) as client:
            files = {
                'file': (file.filename, file_content, file.content_type)
            }
            data = {}
            if name:
                data['name'] = name
            
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/admin/voices/upload",
                files=files,
                data=data,
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "upload voice")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while uploading voice: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Upload voice error")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        # РЈРґР°Р»СЏРµРј РІСЂРµРјРµРЅРЅС‹Р№ С„Р°Р№Р»
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup temp file: {cleanup_error}")

@router.delete("/voices/{voice_id}")
async def delete_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЈРґР°Р»РёС‚СЊ РіРѕР»РѕСЃ (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ СѓРґР°Р»СЏС‚СЊ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.delete(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}",
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "delete voice")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while deleting voice: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Delete voice error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/voices/{voice_id}/rename")
async def rename_voice_proxy(
    voice_id: int,
    new_name: str = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ РіРѕР»РѕСЃ (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ РїРµСЂРµРёРјРµРЅРѕРІС‹РІР°С‚СЊ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service СЃ query РїР°СЂР°РјРµС‚СЂРѕРј
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.put(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/rename",
                params={'new_name': new_name},
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "rename voice")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while renaming voice: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Rename voice error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/voices/{voice_id}/transcribe")
async def transcribe_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РўСЂР°РЅСЃРєСЂРёР±РёСЂРѕРІР°С‚СЊ РіРѕР»РѕСЃ (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ С‚СЂР°РЅСЃРєСЂРёР±РёСЂРѕРІР°С‚СЊ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        # РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё С‚Р°РєРѕР№ endpoint РІ TTS Service
        # Р•СЃР»Рё РЅРµС‚, РёСЃРїРѕР»СЊР·СѓРµРј retranscribe, РєРѕС‚РѕСЂС‹Р№ РґРµР»Р°РµС‚ С‚Рѕ Р¶Рµ СЃР°РјРѕРµ
        async with httpx.AsyncClient(timeout=60.0, **build_tts_httpx_client_kwargs()) as client:
            # РџРѕРїСЂРѕР±СѓРµРј РЅР°Р№С‚Рё endpoint РґР»СЏ С‚СЂР°РЅСЃРєСЂРёР±Р°С†РёРё РІ TTS Service
            # Р•СЃР»Рё РµРіРѕ РЅРµС‚, РёСЃРїРѕР»СЊР·СѓРµРј retranscribe
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/retranscribe",
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "transcribe voice")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while transcribing voice: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Transcribe voice error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/voices/{voice_id}/retranscribe")
async def retranscribe_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРµСЂРµС‚СЂР°РЅСЃРєСЂРёР±РёСЂРѕРІР°С‚СЊ РіРѕР»РѕСЃ (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ РїРµСЂРµС‚СЂР°РЅСЃРєСЂРёР±РёСЂРѕРІР°С‚СЊ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        async with httpx.AsyncClient(timeout=60.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/retranscribe",
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "retranscribe voice")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while retranscribing voice: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Retranscribe voice error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/voices/{voice_id}/toggle")
async def toggle_voice_proxy(
    voice_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р’РєР»СЋС‡РёС‚СЊ/РІС‹РєР»СЋС‡РёС‚СЊ РіРѕР»РѕСЃ (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ РІРєР»СЋС‡Р°С‚СЊ/РІС‹РєР»СЋС‡Р°С‚СЊ РіРѕР»РѕСЃР°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.post(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/toggle",
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "toggle voice")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while toggling voice: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Toggle voice error")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/tts/stats")
async def get_tts_stats(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ TTS Service (РїСЂРѕРєСЃРё Рє TTS Service СЃ РїСЂРѕРІРµСЂРєРѕР№ РїСЂР°РІ)"""
    try:
        # РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІР° РґРѕСЃС‚СѓРїР° - С‚РѕР»СЊРєРѕ Р°РґРјРёРЅС‹ РјРѕРіСѓС‚ РїСЂРѕСЃРјР°С‚СЂРёРІР°С‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # РџСЂРѕРєСЃРёСЂСѓРµРј Р·Р°РїСЂРѕСЃ РІ TTS Service
        async with httpx.AsyncClient(timeout=10.0, **build_tts_httpx_client_kwargs()) as client:
            response = await client.get(
                f"{TTS_SERVICE_URL}/api/admin/stats",
                headers=_tts_auth_headers(),
            )
            
            if response.status_code != 200:
                _raise_tts_upstream_error(response, "load tts stats")
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        logger.warning("TTS service unavailable while loading TTS stats: %s", e)
        raise _tts_unavailable_error(settings.tts_service_url)
    except Exception:
        logger.exception("Get TTS stats error")
        raise HTTPException(status_code=500, detail="Internal server error")




