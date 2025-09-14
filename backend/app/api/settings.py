from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from app.services.state_service import StateService
from app.dependencies import get_state_service, get_bot
from app.bot import Bot as TwitchBot
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])

class ChannelSettingsUpdate(BaseModel):
    read_emotes: Optional[bool] = None
    speed: Optional[float] = None
    cfg_strength: Optional[float] = None
    nfe_step: Optional[int] = None
    sway_sampling_coef: Optional[float] = None

class TwitchIntegrationUpdate(BaseModel):
    enabled: bool

@router.get("/{channel_name}/integrations")
async def get_integrations(
    channel_name: str,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    # Use 'sub' as the primary identifier, fallback to 'username'
    user_identifier = user.get('username') or user.get('sub')
    if channel_name != user_identifier:
        raise HTTPException(status_code=403, detail="Forbidden")
    integrations = state_service.get_integrations(channel_name)
    return integrations

@router.post("/{channel_name}/integrations/twitch")
async def update_twitch_integration(
    channel_name: str,
    integration_update: TwitchIntegrationUpdate,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service),
    bot: "Bot" = Depends(get_bot)
):
    # Use 'sub' as the primary identifier, fallback to 'username'
    user_identifier = user.get('username') or user.get('sub')
    if channel_name != user_identifier:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    await state_service.set_twitch_integration(channel_name, integration_update.enabled)
    
    # Ensure channel exists before getting settings
    if not state_service.get_channel_state(channel_name):
        await state_service.register_channel(channel_name)
    
    # This is a direct, synchronous call now
    current_settings = state_service.get_channel_settings(channel_name)
    tts_enabled = current_settings.get('tts_enabled', False)

    if integration_update.enabled:
        await bot.add_channel(channel_name)
        # We only enable TTS if it was supposed to be enabled in the first place
        if tts_enabled:
            await state_service.set_bot_enabled_state(channel_name, True)
    else:
        # If integration is disabled, bot should leave and TTS must be disabled
        await state_service.set_bot_enabled_state(channel_name, False)
        await bot.remove_channel(channel_name)
        
    return {"message": f"Twitch integration for {channel_name} set to {integration_update.enabled}"}

@router.post("/{channel_name}/integrations/vk")
async def update_vk_integration(
    channel_name: str,
    integration_update: TwitchIntegrationUpdate, # Re-using the same model
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    # Use 'sub' as the primary identifier, fallback to 'username'
    user_identifier = user.get('username') or user.get('sub')
    if channel_name != user_identifier:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    await state_service.set_vk_integration(channel_name, integration_update.enabled)
    
    # Unlike Twitch, there's no bot to join/part a channel for VK Video Live.
    # We just acknowledge the state change.
    
    return {"message": f"VK Video Live integration for {channel_name} set to {integration_update.enabled}"}

@router.post("/{channel_name}/settings")
async def update_channel_settings(
    channel_name: str,
    settings_update: ChannelSettingsUpdate,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service),
):
    """
    Update settings for a specific channel.
    """
    # Use 'sub' as the primary identifier, fallback to 'username'
    user_identifier = user.get('username') or user.get('sub')
    if channel_name != user_identifier:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        # Use exclude_unset=True to only get the values that were actually sent
        update_data = settings_update.model_dump(exclude_unset=True)
        await state_service.update_channel_settings(channel_name, update_data)
        return {"message": f"Settings for {channel_name} updated successfully."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{channel_name}/settings")
async def get_channel_settings(
    channel_name: str,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service),
):
    # Use 'sub' as the primary identifier, fallback to 'username'
    user_identifier = user.get('username') or user.get('sub')
    if channel_name != user_identifier:
        raise HTTPException(status_code=403, detail="Forbidden")
    """
    Get settings for a specific channel.
    """
    try:
        settings = state_service.get_channel_settings(channel_name)
        return settings
    except ValueError:
        # Channel doesn't exist, create it and return default settings
        await state_service.register_channel(channel_name)
        settings = state_service.get_channel_settings(channel_name)
        return settings

@router.post("/{channel_name}/settings/reset")
async def reset_channel_settings(
    channel_name: str,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service),
):
    """
    Resets the TTS settings for a channel to their default values.
    """
    # Use 'sub' as the primary identifier, fallback to 'username'
    user_identifier = user.get('username') or user.get('sub')
    if channel_name != user_identifier:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        await state_service.reset_channel_settings(channel_name)
        return {"message": f"Settings for {channel_name} have been reset to default."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{channel_name}/status")
async def get_channel_status(
    channel_name: str,
    user: dict = Depends(get_current_user),
    state_service: StateService = Depends(get_state_service)
):
    """
    Get bot status for a specific channel.
    """
    # Use 'sub' as the primary identifier, fallback to 'username'
    user_identifier = user.get('username') or user.get('sub')
    if channel_name != user_identifier:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    try:
        is_enabled = state_service.get_bot_enabled_state(channel_name)
        integrations = state_service.get_integrations(channel_name)
        return {
            "channel_name": channel_name, 
            "is_enabled": is_enabled,
            "integrations": integrations
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
