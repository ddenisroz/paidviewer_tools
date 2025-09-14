from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.bot import Bot as TwitchBot
from app.dependencies import get_bot
from app.services.state_service import StateService
from app.dependencies import get_state_service

router = APIRouter(prefix="/api/bot", tags=["bot"])

class TTSState(BaseModel):
    is_enabled: bool

@router.post("/tts/toggle")
async def toggle_tts(
    tts_state: TTSState, 
    user: dict = Depends(get_current_user), 
    state_service: StateService = Depends(get_state_service),
    bot: TwitchBot = Depends(get_bot)
):
    # Use 'sub' as the primary identifier, fallback to 'username'
    channel_name = user.get("username") or user.get("sub")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")
    
    # Check if Twitch integration is enabled
    integrations = state_service.get_integrations(channel_name)
    if not integrations.get("twitch_enabled", False):
        raise HTTPException(status_code=400, detail="Twitch integration is disabled. Enable it in settings first.")
    
    # This will now control only TTS, not bot connection
    await state_service.set_tts_enabled(channel_name, tts_state.is_enabled)
    return {"message": f"TTS for channel {channel_name} has been {'enabled' if tts_state.is_enabled else 'disabled'}"}


@router.post("/queue/clear")
async def clear_queue(user: dict = Depends(get_current_user), bot: TwitchBot = Depends(get_bot)):
    # Use 'sub' as the primary identifier, fallback to 'username'
    channel_name = user.get("username") or user.get("sub")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")
    
    bot.audio_service.clear_queue()
    # Note: audio queue is global, not per-channel in this implementation
    return {"message": f"Audio queue cleared for channel {channel_name}"}

@router.get("/status/{channel_name}")
async def get_bot_status(channel_name: str, state_service: StateService = Depends(get_state_service)):
    # Проверяем, существует ли канал, если нет - создаем
    try:
        state_service.get_channel_state(channel_name)
    except:
        await state_service.register_channel(channel_name)
    
    tts_enabled = state_service.is_tts_enabled(channel_name)
    bot_enabled = state_service.get_bot_enabled_state(channel_name)
    return {
        "channel_name": channel_name, 
        "is_enabled": tts_enabled,
        "bot_enabled": bot_enabled
    }
