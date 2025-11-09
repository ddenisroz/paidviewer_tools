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


@router.get("/badges/channel/{identifier}")
async def get_twitch_channel_badges(identifier: str) -> JSONResponse:
    """
    Получить маппинг badges конкретного канала (публичный endpoint)
    Принимает либо broadcaster_id (число), либо username (строка)
    """
    try:
        # Используем App Access Token для публичного доступа
        client_id = os.getenv("TWITCH_CLIENT_ID")
        client_secret = os.getenv("TWITCH_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            logger.error("Twitch credentials not configured")
            return JSONResponse(content={"success": True, "badges": {}})
        
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
                    error_text = await response.text()
                    logger.error(f"Failed to get App Access Token: {response.status} - {error_text}")
                    return JSONResponse(content={"success": True, "badges": {}})
            
            # Определяем, что передано: username или broadcaster_id
            broadcaster_id = identifier
            
            # Если identifier не является числом, значит это username - конвертируем в broadcaster_id
            if not identifier.isdigit():
                logger.info(f"Converting username '{identifier}' to broadcaster_id...")
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Client-Id": client_id
                }
                
                async with session.get(
                    "https://api.twitch.tv/helix/users",
                    headers=headers,
                    params={"login": identifier.lower()}
                ) as user_response:
                    if user_response.status == 200:
                        user_data = await user_response.json()
                        if user_data.get("data") and len(user_data["data"]) > 0:
                            broadcaster_id = user_data["data"][0]["id"]
                            logger.info(f"✅ Converted username '{identifier}' to broadcaster_id: {broadcaster_id}")
                        else:
                            logger.warning(f"User '{identifier}' not found on Twitch")
                            return JSONResponse(content={"success": True, "badges": {}})
                    else:
                        error_text = await user_response.text()
                        logger.error(f"Failed to get user info: {user_response.status} - {error_text}")
                        # Если не удалось получить user info, возвращаем пустые badges вместо ошибки
                        return JSONResponse(content={"success": True, "badges": {}})
            
            # Получаем badges
            badges = await get_channel_badges(broadcaster_id, client_id, access_token)
            
            return JSONResponse(content={"success": True, "badges": badges})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching channel badges: {e}", exc_info=True)
        # Возвращаем пустые badges вместо ошибки, чтобы не ломать интерфейс
        return JSONResponse(content={"success": True, "badges": {}})

