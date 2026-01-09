from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from core.config import settings
from repositories.user_voice_settings_repository import UserVoiceSettingsRepository
from typing import Optional
import logging
import httpx
import os
import tempfile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.put("/voices/{voice_id}/settings")
async def update_voice_settings(
    voice_id: int,
    settings_dict: dict = Body(..., embed=False, description="Voice settings"),
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        user_id = user['id']
        
        # Для глобальных голосов: обновляем сам голос в TTS Service (reference_text, cfg_strength, speed_preset)
        # Отправляем запрос в TTS Service для обновления настроек голоса
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.put(
                    f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/settings",
                    json=settings_dict
                )
                if response.status_code == 200:
                    logger.info(f"[OK] Voice {voice_id} settings updated in TTS Service")
                else:
                    logger.warning(f"[WARN] Failed to update voice {voice_id} in TTS Service: {response.status_code}")
        except Exception as e:
            logger.error(f"[ERROR] Error updating voice in TTS Service: {e}")
        
        # Создаём/обновляем персональные настройки пользователя в bot_service
        repo = UserVoiceSettingsRepository(db)
        voice_settings = repo.update_or_create_by_voice_id(user_id, voice_id, settings_dict)
        
        logger.info(f"[OK] Voice settings updated for user {user_id}, voice {voice_id}: {settings_dict}")
        
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
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
                except Exception:
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{TTS_SERVICE_URL}/api/admin/voices")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as e:
        # TTS сервис недоступен - возвращаем пустой список с предупреждением
        TTS_SERVICE_URL = settings.tts_service_url
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
        TTS_SERVICE_URL = settings.tts_service_url
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
    from validators.file_validators import validate_file_magic_number, ALLOWED_AUDIO_TYPES, validate_voice_file
    
    temp_file_path = None
    try:
        # Проверяем права доступа - только админы могут загружать голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # [OK] SECURITY: Валидация файла (размер, тип, имя)
        validate_voice_file(file)
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Читаем файл
        file_content = await file.read()
        
        # [OK] SECURITY: Сохраняем во временный файл для проверки magic numbers
        with tempfile.NamedTemporaryFile(delete=False, suffix='.tmp') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        # [OK] SECURITY: Проверяем magic numbers (реальный тип файла)
        is_valid, error = validate_file_magic_number(temp_file_path, ALLOWED_AUDIO_TYPES)
        
        if not is_valid:
            logger.warning(
                f"🚫 [SECURITY] Admin voice upload rejected - invalid magic number: "
                f"admin={user.get('id')}, filename={file.filename}, error={error}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file content: {error}. File may be malicious or corrupted."
            )
        
        logger.info(f"[OK] [SECURITY] Admin voice file validated: admin={user.get('id')}, filename={file.filename}")
        
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
                except Exception:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload voice error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to upload voice: {str(e)}")
    finally:
        # Удаляем временный файл
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
    """Удалить голос (прокси к TTS Service с проверкой прав)"""
    try:
        # Проверяем права доступа - только админы могут удалять голоса
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Проксируем запрос в TTS Service с query параметром
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.put(
                f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/rename",
                params={'new_name': new_name}
            )
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
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
                except Exception:
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/retranscribe")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/voices/{voice_id}/toggle")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
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
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        # Проксируем запрос в TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{TTS_SERVICE_URL}/api/admin/stats")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get TTS stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get TTS stats: {str(e)}")
