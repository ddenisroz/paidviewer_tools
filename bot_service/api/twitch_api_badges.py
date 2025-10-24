"""
API endpoints для получения Twitch badges
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from api.twitch_badges_api import get_global_badges, get_channel_badges
import logging
import os

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/badges/global")
async def get_twitch_global_badges() -> JSONResponse:
    """
    Получить маппинг глобальных Twitch badges (публичный endpoint)
    """
    try:
        # Используем App Access Token для публичного доступа
        client_id = os.getenv("TWITCH_CLIENT_ID")
        client_secret = os.getenv("TWITCH_CLIENT_SECRET")
        
        # Получаем App Access Token
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials"
                }
            ) as response:
                if response.status == 200:
                    token_data = await response.json()
                    access_token = token_data["access_token"]
                else:
                    raise HTTPException(status_code=500, detail="Failed to get App Access Token")
        
        # Получаем badges
        badges = await get_global_badges(client_id, access_token)
        
        return JSONResponse(content={"success": True, "badges": badges})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching global badges: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/badges/channel/{broadcaster_id}")
async def get_twitch_channel_badges(broadcaster_id: str) -> JSONResponse:
    """
    Получить маппинг badges конкретного канала (публичный endpoint)
    """
    try:
        # Используем App Access Token для публичного доступа
        client_id = os.getenv("TWITCH_CLIENT_ID")
        client_secret = os.getenv("TWITCH_CLIENT_SECRET")
        
        # Получаем App Access Token
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials"
                }
            ) as response:
                if response.status == 200:
                    token_data = await response.json()
                    access_token = token_data["access_token"]
                else:
                    raise HTTPException(status_code=500, detail="Failed to get App Access Token")
        
        # Получаем badges
        badges = await get_channel_badges(broadcaster_id, client_id, access_token)
        
        return JSONResponse(content={"success": True, "badges": badges})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching channel badges: {e}")
        raise HTTPException(status_code=500, detail=str(e))

