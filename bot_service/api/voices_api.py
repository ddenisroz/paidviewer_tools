# bot_service/api/voices_api.py
"""API endpoints for voice management (user and admin)"""
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from services.voice_management_service import VoiceManagementService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voices", tags=["voices"])

def get_voice_service(db: Session = Depends(get_db)) -> VoiceManagementService:
    return VoiceManagementService(db)

@router.get("/global")
async def get_global_voices(
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """
    Get all global voices (admin-uploaded voices available to all users)
    """
    return await service.get_global_voices()

@router.put("/{voice_id}/settings")
async def update_user_voice_settings(
    voice_id: int,
    settings: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """
    Update user's personal settings for a voice.
    For global voices: stores personal settings (speed, volume, CFG) that apply only to this user.
    For custom voices: updates the voice settings in TTS Service.
    """
    user_id = current_user['id']
    return await service.update_user_voice_settings(user_id, voice_id, settings)

# Admin endpoints

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)):
    if not current_user.get("is_superuser"):
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user

@router.get("/admin", dependencies=[Depends(require_admin)])
async def admin_get_global_voices(
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Admin: Get all global voices"""
    return await service.admin_get_global_voices()

@router.put("/admin/{voice_id}/settings", dependencies=[Depends(require_admin)])
async def admin_update_global_voice(
    voice_id: int,
    settings: Dict[str, Any] = Body(...),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Admin: Update global voice settings"""
    return await service.admin_update_global_voice(voice_id, settings)

@router.delete("/admin/{voice_id}", dependencies=[Depends(require_admin)])
async def admin_delete_global_voice(
    voice_id: int,
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Admin: Delete a global voice"""
    return await service.admin_delete_global_voice(voice_id)

@router.put("/admin/{voice_id}/rename", dependencies=[Depends(require_admin)])
async def admin_rename_global_voice(
    voice_id: int,
    new_name: str = Body(..., embed=True),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Admin: Rename a global voice"""
    return await service.admin_rename_global_voice(voice_id, new_name)

@router.get("/user/custom")
async def get_user_custom_voices(
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Get user's custom voices"""
    user_id = current_user['id']
    return await service.get_user_custom_voices(user_id)

@router.delete("/user/custom/{voice_id}")
async def delete_custom_voice(
    voice_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: VoiceManagementService = Depends(get_voice_service)
):
    """Delete a user's custom voice"""
    user_id = current_user['id']
    success = await service.delete_custom_voice(user_id, voice_id)
    return {"success": success}
