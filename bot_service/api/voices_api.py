# bot_service/api/voices_api.py
"""API endpoints for voice management (user and admin)"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from core.database import get_db, UserVoiceSettings
from auth.auth import get_current_user
from auth.permissions import require_admin
from typing import Dict, Any
import httpx
import logging
from core.datetime_utils import utcnow_naive
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voices", tags=["voices"])


@router.get("/user/custom")
async def get_user_custom_voices(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's custom voices (user-uploaded voices)"""
    try:
        user_id = current_user.get("user_id")

        # Fetch user's custom voices from TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.tts_service_url}/api/user/{user_id}/voices"
            )

            if response.status_code == 200:
                voices_data = response.json()
                return {
                    "success": True,
                    "voices": voices_data
                }
            else:
                logger.error(f"Failed to fetch custom voices: {response.status_code}")
                return {
                    "success": False,
                    "voices": [],
                    "error": "Failed to fetch custom voices"
                }

    except Exception as e:
        logger.error(f"Error fetching custom voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/global")
async def get_global_voices(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all global voices (admin-uploaded voices available to all users)"""
    try:
        user_id = current_user.get("user_id")

        # Fetch global voices from TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.tts_service_url}/api/voices/global"
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch global voices: {response.status_code}")
                return {
                    "success": False,
                    "voices": [],
                    "error": "Failed to fetch global voices"
                }

            voices_data = response.json()

            # Get user's personal settings for global voices
            user_settings = db.query(UserVoiceSettings).filter(
                UserVoiceSettings.user_id == user_id
            ).all()

            # Create a map of voice_id to user settings
            settings_map = {
                setting.voice_id: {
                    "cfg_strength": setting.cfg_strength,
                    "speed_preset": setting.speed_preset,
                    "volume": setting.volume
                }
                for setting in user_settings
            }

            # Merge user settings with voice data
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


@router.put("/user/settings/{voice_id}")
async def update_user_voice_settings(
    voice_id: int,
    settings: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's personal settings for a voice.
    For global voices: stores personal settings (speed, volume, CFG) that apply only to this user.
    For custom voices: updates the voice settings in TTS Service.
    """
    try:
        user_id = current_user.get("user_id")

        # First, check if this is a global voice or custom voice
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.tts_service_url}/api/voices/{voice_id}"
            )

            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Voice not found")

            voice_data = response.json()
            is_global = voice_data.get("is_global", False)

        if is_global:
            # For global voices, only update user's personal settings in bot_service
            voice_settings = db.query(UserVoiceSettings).filter(
                UserVoiceSettings.user_id == user_id,
                UserVoiceSettings.voice_id == voice_id
            ).first()

            if voice_settings:
                # Update existing settings
                if 'cfg_strength' in settings:
                    voice_settings.cfg_strength = settings['cfg_strength']
                if 'speed_preset' in settings:
                    voice_settings.speed_preset = settings['speed_preset']
                if 'volume' in settings:
                    voice_settings.volume = settings['volume']
                voice_settings.updated_at = utcnow_naive()
            else:
                # Create new settings
                voice_settings = UserVoiceSettings(
                    user_id=user_id,
                    voice_id=voice_id,
                    voice_name=voice_data.get('name'),
                    cfg_strength=settings.get('cfg_strength'),
                    speed_preset=settings.get('speed_preset'),
                    volume=settings.get('volume')
                )
                db.add(voice_settings)

            db.commit()
            db.refresh(voice_settings)

            logger.info(f"[OK] User {user_id} updated personal settings for global voice {voice_id}")

            return {
                "success": True,
                "message": "Personal voice settings updated",
                "settings": {
                    "voice_id": voice_settings.voice_id,
                    "cfg_strength": voice_settings.cfg_strength,
                    "speed_preset": voice_settings.speed_preset,
                    "volume": voice_settings.volume
                }
            }
        else:
            # For custom voices, update the voice settings in TTS Service
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.put(
                    f"{settings.tts_service_url}/api/user/voices/{voice_id}/settings",
                    json=settings
                )

                if response.status_code == 200:
                    logger.info(f"[OK] User {user_id} updated custom voice {voice_id} settings")
                    return {
                        "success": True,
                        "message": "Custom voice settings updated",
                        "settings": response.json()
                    }
                else:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail="Failed to update custom voice settings"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating voice settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user/custom/{voice_id}")
async def delete_custom_voice(
    voice_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a user's custom voice"""
    try:
        user_id = current_user.get("user_id")

        # Delete from TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(
                f"{settings.tts_service_url}/api/user/voices/{voice_id}",
                params={"user_id": user_id}
            )

            if response.status_code == 200:
                logger.info(f"[OK] User {user_id} deleted custom voice {voice_id}")
                return {
                    "success": True,
                    "message": "Custom voice deleted successfully"
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to delete custom voice"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting custom voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints

@router.get("/admin/global")
async def admin_get_global_voices(
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin: Get all global voices"""
    try:
        # Fetch global voices from TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.tts_service_url}/api/admin/voices",
                params={"voice_type": "global"}
            )

            if response.status_code == 200:
                return {
                    "success": True,
                    "voices": response.json()
                }
            else:
                logger.error(f"Failed to fetch global voices: {response.status_code}")
                return {
                    "success": False,
                    "voices": [],
                    "error": "Failed to fetch global voices"
                }

    except Exception as e:
        logger.error(f"Error fetching global voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/global/{voice_id}")
async def admin_update_global_voice(
    voice_id: int,
    settings: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin: Update global voice settings (affects all users by default)"""
    try:
        # Update voice settings in TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.put(
                f"{settings.tts_service_url}/api/admin/voices/{voice_id}/settings",
                json=settings
            )

            if response.status_code == 200:
                logger.info(f"[OK] Admin updated global voice {voice_id} settings")
                return {
                    "success": True,
                    "message": "Global voice settings updated",
                    "settings": response.json()
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to update global voice settings"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating global voice settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/global/{voice_id}")
async def admin_delete_global_voice(
    voice_id: int,
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin: Delete a global voice"""
    try:
        # Delete from TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(
                f"{settings.tts_service_url}/api/admin/voices/{voice_id}"
            )

            if response.status_code == 200:
                # Also delete all user settings for this voice
                db.query(UserVoiceSettings).filter(
                    UserVoiceSettings.voice_id == voice_id
                ).delete()
                db.commit()

                logger.info(f"[OK] Admin deleted global voice {voice_id}")
                return {
                    "success": True,
                    "message": "Global voice deleted successfully"
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to delete global voice"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting global voice: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/global/{voice_id}/rename")
async def admin_rename_global_voice(
    voice_id: int,
    new_name: str = Body(..., embed=True),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin: Rename a global voice"""
    try:
        # Rename in TTS Service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.put(
                f"{settings.tts_service_url}/api/admin/voices/{voice_id}/rename",
                json={"new_name": new_name}
            )

            if response.status_code == 200:
                logger.info(f"[OK] Admin renamed global voice {voice_id} to '{new_name}'")
                return {
                    "success": True,
                    "message": "Global voice renamed successfully",
                    "new_name": new_name
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to rename global voice"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming global voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))
