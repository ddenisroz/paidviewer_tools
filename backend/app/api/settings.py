from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.state_service import StateService
from app.dependencies import get_state_service

router = APIRouter()

class ChannelSettingsUpdate(BaseModel):
    read_emotes: bool

@router.post("/{channel_name}/settings")
async def update_channel_settings(
    channel_name: str,
    settings_update: ChannelSettingsUpdate,
    state_service: StateService = Depends(get_state_service),
):
    """
    Update settings for a specific channel.
    """
    try:
        await state_service.update_channel_settings(channel_name, settings_update.model_dump())
        return {"message": f"Settings for {channel_name} updated successfully."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{channel_name}/settings")
async def get_channel_settings(
    channel_name: str,
    state_service: StateService = Depends(get_state_service),
):
    """
    Get settings for a specific channel.
    """
    try:
        settings = await state_service.get_channel_settings(channel_name)
        return settings
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
