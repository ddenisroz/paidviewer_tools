from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.bot import Bot as TwitchBot
from app.dependencies import get_bot
from app.services.state_service import StateService
from app.dependencies import get_state_service

router = APIRouter()

class TTSState(BaseModel):
    is_enabled: bool

@router.post("/tts/toggle")
async def toggle_tts(tts_state: TTSState, user: dict = Depends(get_current_user), state_service: StateService = Depends(get_state_service)):
    channel_name = user.get("username")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")
    
    # This will now control the bot joining/leaving the channel
    bot: TwitchBot = get_bot()
    if tts_state.is_enabled:
        await bot.join_channels([channel_name])
        state_service.set_bot_enabled_state(channel_name, True)
    else:
        await bot.part_channels([channel_name])
        state_service.set_bot_enabled_state(channel_name, False)
        
    state_service.set_tts_enabled(channel_name, tts_state.is_enabled)
    return {"message": f"TTS for channel {channel_name} has been {'enabled' if tts_state.is_enabled else 'disabled'}"}


@router.post("/queue/clear")
async def clear_queue(user: dict = Depends(get_current_user), bot: TwitchBot = Depends(get_bot)):
    channel_name = user.get("username")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")
    
    bot.audio_service.clear_queue()
    # Note: audio queue is global, not per-channel in this implementation
    return {"message": f"Audio queue cleared for channel {channel_name}"}

@router.get("/status/{channel_name}")
async def get_bot_status(channel_name: str, state_service: StateService = Depends(get_state_service)):
    is_enabled = state_service.get_bot_enabled_state(channel_name)
    return {"channel_name": channel_name, "is_enabled": is_enabled}
