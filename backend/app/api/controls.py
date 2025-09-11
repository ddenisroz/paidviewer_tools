from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.security import get_current_user
from app.bot import Bot as TwitchBot

router = APIRouter()

class TTSState(BaseModel):
    is_enabled: bool

class VolumeState(BaseModel):
    volume: float # Should be between 0.0 and 1.0

# Dependency to get the bot instance from the application state
async def get_bot(request: Request) -> TwitchBot:
    if not hasattr(request.app.state, 'bot_instance') or request.app.state.bot_instance is None:
        raise HTTPException(status_code=503, detail="Bot is not initialized")
    return request.app.state.bot_instance

@router.post("/tts/toggle")
async def toggle_tts(tts_state: TTSState, user: dict = Depends(get_current_user), bot: TwitchBot = Depends(get_bot)):
    channel_name = user.get("username")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")
    
    bot.state_service.set_tts_enabled(channel_name, tts_state.is_enabled)
    return {"message": f"TTS for channel {channel_name} has been {'enabled' if tts_state.is_enabled else 'disabled'}"}

@router.post("/volume")
async def set_volume(volume_state: VolumeState, user: dict = Depends(get_current_user), bot: TwitchBot = Depends(get_bot)):
    channel_name = user.get("username")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")

    bot.state_service.set_volume(channel_name, volume_state.volume)
    return {"message": f"Volume for channel {channel_name} set to {volume_state.volume}"}

@router.post("/queue/clear")
async def clear_queue(user: dict = Depends(get_current_user), bot: TwitchBot = Depends(get_bot)):
    channel_name = user.get("username")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")
    
    bot.audio_service.clear_queue()
    # Note: audio queue is global, not per-channel in this implementation
    return {"message": f"Audio queue cleared for channel {channel_name}"}


@router.get("/status")
async def get_status(user: dict = Depends(get_current_user), bot: TwitchBot = Depends(get_bot)):
    channel_name = user.get("username")
    if not channel_name:
        raise HTTPException(status_code=400, detail="Channel name not found in token")

    state = bot.state_service.get_channel_state(channel_name)
    if not state:
        # Return a default "off" state if the user has never logged in before
        return {"is_enabled": False, "volume": 0.5}

    return {
        "is_enabled": state.get("tts_enabled", False),
        "volume": state.get("volume", 0.5)
    }
