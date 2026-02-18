import httpx
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from core.config import settings
from repositories.user_voice_settings_repository import UserVoiceSettingsRepository
from core.database import UserVoiceSettings

logger = logging.getLogger(__name__)

class VoiceManagementService:
    """
    Service for managing text-to-speech voices.
    Handles interaction with external TTS service and local user voice settings.
    """
    def __init__(self, db: Session):
        self.db = db
        self.repository = UserVoiceSettingsRepository(db)
        self.tts_url = settings.tts_service_url
        self.tts_api_base = f"{self.tts_url.rstrip('/')}/api/tts"

    async def get_global_voices(self) -> List[Dict[str, Any]]:
        """Get list of available global voices from external TTS service."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.tts_api_base}/voices/global")
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to fetch global voices: {response.status_code}")
                    return []
        except Exception:
            logger.exception("Error fetching global voices")
            return []

    async def get_user_custom_voices(self, user_id: int) -> List[Dict[str, Any]]:
        """Get list of custom voices for a specific user."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.tts_api_base}/user/voices/{user_id}")
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return []
                else:
                    logger.error(f"Failed to fetch user voices: {response.status_code}")
                    # Don't fail completely, just return empty list
                    return []
        except Exception:
            logger.exception("Error fetching user voices")
            return []

    async def get_voice_info(self, voice_id: int) -> Optional[Dict[str, Any]]:
        """Get information about a specific voice."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.tts_api_base}/voices/{voice_id}")
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception:
            logger.exception("Error checking voice existence")
            return None

    async def update_user_voice_settings(
        self, 
        user_id: int, 
        voice_id: int, 
        settings_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update voice settings for a user.
        Handles both global voices (stored in DB) and custom voices (stored in external service).
        """
        # 1. Check if it's a global voice or custom voice
        voice_info = await self.get_voice_info(voice_id)
        
        if not voice_info:
            raise HTTPException(
                status_code=404, 
                detail=f"Voice {voice_id} not found"
            )
            
        is_global = voice_info.get('type') == 'global' or voice_info.get('is_global') is True
        
        if is_global:
            # Handle global voice settings (stored locally for each user)
            current_settings = self.repository.get_by_user_and_voice_id(user_id, voice_id)
            
            if current_settings:
                # Update existing settings
                if 'cfg_strength' in settings_data:
                    current_settings.cfg_strength = settings_data['cfg_strength']
                if 'speed_preset' in settings_data:
                    current_settings.speed_preset = settings_data['speed_preset']
                if 'volume' in settings_data:
                    current_settings.volume = settings_data['volume']
                
                self.db.commit()
                self.db.refresh(current_settings)
                
                return {
                    "id": current_settings.id,
                    "voice_id": current_settings.voice_id,
                    "voice_name": current_settings.voice_name,
                    "cfg_strength": current_settings.cfg_strength,
                    "speed_preset": current_settings.speed_preset,
                    "volume": current_settings.volume
                }
            else:
                # Create new settings
                new_settings = UserVoiceSettings(
                    user_id=user_id,
                    voice_id=voice_id,
                    voice_name=voice_info.get('name'),
                    cfg_strength=settings_data.get('cfg_strength'),
                    speed_preset=settings_data.get('speed_preset'),
                    volume=settings_data.get('volume')
                )
                self.repository.add(new_settings)
                
                return {
                    "id": new_settings.id,
                    "voice_id": new_settings.voice_id,
                    "voice_name": new_settings.voice_name,
                    "cfg_strength": new_settings.cfg_strength,
                    "speed_preset": new_settings.speed_preset,
                    "volume": new_settings.volume
                }
        else:
            # Handle custom voice settings (stored in external service)
            # Verify ownership if possible, but the external service checks user_id usually
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.put(
                        f"{self.tts_api_base}/user/voices/{voice_id}/settings",
                        json=settings_data
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                    else:
                        error_detail = "Failed to update custom voice settings"
                        try:
                            error_detail = response.json().get('detail', error_detail)
                        except Exception:
                            pass
                        raise HTTPException(status_code=response.status_code, detail=error_detail)
            except HTTPException:
                raise
            except Exception:
                logger.exception("Error updating custom voice settings")
                raise HTTPException(status_code=500, detail="Internal server error")
    async def upload_user_voice(self, user_id: int, name: str, filename: str, content: bytes, content_type: str) -> Dict[str, Any]:
        """
        Upload a user voice.
        Validates the file and sends it to the external TTS service.
        """
        import tempfile
        import os
        from validators.file_validators import FileValidator, validate_file_magic_number, ALLOWED_AUDIO_TYPES, MAX_VOICE_FILE_SIZE_MB

        # 1. Metadata Validation
        # Validate filename
        is_valid, error = FileValidator.validate_filename(filename)
        if not is_valid:
             raise HTTPException(status_code=400, detail=error)

        # Validate type/extension
        is_valid, error = FileValidator.validate_audio_metadata(filename, content_type)
        if not is_valid:
             raise HTTPException(status_code=400, detail=error)

        # Validate size
        is_valid, error = FileValidator.validate_size_limit(len(content), MAX_VOICE_FILE_SIZE_MB)
        if not is_valid:
             raise HTTPException(status_code=400, detail=error)

        # 2. Security Validation (Magic Number)
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.tmp') as temp_file:
                temp_file.write(content)
                temp_file_path = temp_file.name

            is_valid, error = validate_file_magic_number(temp_file_path, ALLOWED_AUDIO_TYPES)
            if not is_valid:
                logger.warning(
                    f"[BLOCKED] [SECURITY] Voice upload rejected - invalid magic number: "
                    f"user={user_id}, filename={filename}, error={error}"
                )
                raise HTTPException(
                    status_code=400,
                    detail="Invalid file content. File may be malicious or corrupted."
                )
            
            logger.info(f"[OK] [SECURITY] Voice file validated: user={user_id}, filename={filename}")

            # 3. External Service Upload
            files = {'file': (filename, content, content_type)}
            data = {'voice_name': name, 'user_id': str(user_id)}

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.tts_api_base}/user/voices/upload",
                    files=files,
                    data=data
                )

            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(
                    "Voice upload upstream failed: status=%s body=%s",
                    response.status_code,
                    (response.text or "")[:500],
                )
                if response.status_code == 400:
                    detail = "Invalid voice upload request"
                elif response.status_code in (401, 403):
                    detail = "Voice service authorization failed"
                elif response.status_code == 404:
                    detail = "Voice endpoint not found"
                else:
                    detail = "Voice upload failed"
                raise HTTPException(status_code=response.status_code, detail=detail)

        except HTTPException:
            raise
        except Exception:
            logger.exception("Error uploading voice")
            raise HTTPException(status_code=500, detail="Internal server error")
        finally:
            # Cleanup temp file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup temp file: {cleanup_error}")

    async def delete_custom_voice(self, user_id: int, voice_id: int) -> bool:
        """Delete a custom voice for a user."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(
                    f"{self.tts_api_base}/user/voices/{voice_id}",
                    params={"user_id": user_id}
                )

            if response.status_code == 200:
                return True
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Voice not found")

            logger.error(f"Failed to delete custom voice: {response.status_code}")
            return False
        except HTTPException:
            raise
        except Exception:
            logger.exception("Error deleting custom voice")
            raise HTTPException(status_code=500, detail="Failed to delete voice")

    async def admin_get_global_voices(self) -> List[Dict[str, Any]]:
        """Get all global voices (for admin)."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.tts_api_base}/admin/voices",
                    params={"voice_type": "global"}
                )
                if response.status_code == 200:
                    return response.json()
                return []
        except Exception:
            logger.exception("Error fetching admin global voices")
            return []

    async def admin_update_global_voice(self, voice_id: int, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update global voice settings (admin)."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.put(
                    f"{self.tts_api_base}/admin/voices/{voice_id}/settings",
                    json=settings_data
                )
                if response.status_code == 200:
                    return response.json()
                raise HTTPException(status_code=response.status_code, detail="Failed to update voice")
        except HTTPException:
            raise
        except Exception:
            logger.exception("Error updating global voice")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def admin_delete_global_voice(self, voice_id: int) -> bool:
        """Delete a global voice (admin)."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(
                    f"{self.tts_api_base}/admin/voices/{voice_id}"
                )
                if response.status_code == 200:
                    return True
                raise HTTPException(status_code=response.status_code, detail="Failed to delete voice")
        except HTTPException:
            raise
        except Exception:
            logger.exception("Error deleting global voice")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def admin_rename_global_voice(self, voice_id: int, new_name: str) -> bool:
        """Rename a global voice (admin)."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.put(
                    f"{self.tts_api_base}/admin/voices/{voice_id}/rename",
                    json={"new_name": new_name}
                )
                if response.status_code == 200:
                    return True
                raise HTTPException(status_code=response.status_code, detail="Failed to rename voice")
        except HTTPException:
            raise
        except Exception:
            logger.exception("Error renaming global voice")
            raise HTTPException(status_code=500, detail="Internal server error")

