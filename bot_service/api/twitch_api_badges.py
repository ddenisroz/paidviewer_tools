"""
API endpoints РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ Twitch badges
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from services.twitch_badges_service import get_global_badges, get_channel_badges
from core.config import settings
import logging
from cachetools import TTLCache

router = APIRouter()
logger = logging.getLogger(__name__)

# [OK] PERFORMANCE: РљРµС€ РґР»СЏ App Access Token (1 С‡Р°СЃ TTL)
# РР·Р±РµРіР°РµРј РїРѕРІС‚РѕСЂРЅС‹С… Р·Р°РїСЂРѕСЃРѕРІ Рє Twitch OAuth РґР»СЏ РєР°Р¶РґРѕРіРѕ Р·Р°РїСЂРѕСЃР° badges
_app_token_cache = TTLCache(maxsize=1, ttl=3600)  # 1 С‡Р°СЃ
_CACHE_KEY = "app_access_token"


async def get_cached_app_token() -> str:
    """
    РџРѕР»СѓС‡РёС‚СЊ App Access Token СЃ РєРµС€РёСЂРѕРІР°РЅРёРµРј
    
    Returns:
        access_token: Twitch App Access Token
        
    Raises:
        HTTPException: Р•СЃР»Рё РЅРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ С‚РѕРєРµРЅ
    """
    # РџСЂРѕРІРµСЂСЏРµРј РєРµС€
    if _CACHE_KEY in _app_token_cache:
        logger.debug("[OK] [CACHE HIT] Using cached App Access Token")
        return _app_token_cache[_CACHE_KEY]

    logger.debug("[ERROR] [CACHE MISS] Fetching new App Access Token")

    # РџРѕР»СѓС‡Р°РµРј РЅРѕРІС‹Р№ С‚РѕРєРµРЅ
    client_id = settings.twitch_client_id
    client_secret = settings.twitch_client_secret

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Twitch credentials not configured")

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

                # РЎРѕС…СЂР°РЅСЏРµРј РІ РєРµС€
                _app_token_cache[_CACHE_KEY] = access_token
                logger.info("[OK] [CACHE] Stored new App Access Token (TTL: 3600s)")

                return access_token
            else:
                error_text = await response.text()
                logger.error(f"Failed to get App Access Token: {response.status} - {error_text}")
                raise HTTPException(status_code=500, detail="Failed to get App Access Token")


@router.get("/badges/global")
async def get_twitch_global_badges() -> JSONResponse:
    """
    РџРѕР»СѓС‡РёС‚СЊ РјР°РїРїРёРЅРі РіР»РѕР±Р°Р»СЊРЅС‹С… Twitch badges (РїСѓР±Р»РёС‡РЅС‹Р№ endpoint)
    """
    try:
        client_id = settings.twitch_client_id

        # [OK] PERFORMANCE: РСЃРїРѕР»СЊР·СѓРµРј РєРµС€РёСЂРѕРІР°РЅРЅС‹Р№ App Access Token
        access_token = await get_cached_app_token()

        # РџРѕР»СѓС‡Р°РµРј badges
        badges = await get_global_badges(client_id, access_token)

        return JSONResponse(content={"success": True, "badges": badges})
    except HTTPException:
        raise
    except Exception:
        logger.exception("[ERROR] Error fetching global badges")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/badges/channel/{identifier}")
async def get_twitch_channel_badges(identifier: str) -> JSONResponse:
    """
    РџРѕР»СѓС‡РёС‚СЊ РјР°РїРїРёРЅРі badges РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ РєР°РЅР°Р»Р° (РїСѓР±Р»РёС‡РЅС‹Р№ endpoint)
    РџСЂРёРЅРёРјР°РµС‚ Р»РёР±Рѕ broadcaster_id (С‡РёСЃР»Рѕ), Р»РёР±Рѕ username (СЃС‚СЂРѕРєР°)
    """
    try:
        client_id = settings.twitch_client_id

        if not client_id:
            logger.error("Twitch credentials not configured")
            return JSONResponse(content={"success": True, "badges": {}})

        # [OK] PERFORMANCE: РСЃРїРѕР»СЊР·СѓРµРј РєРµС€РёСЂРѕРІР°РЅРЅС‹Р№ App Access Token
        access_token = await get_cached_app_token()

        import aiohttp
        async with aiohttp.ClientSession() as session:
            # РћРїСЂРµРґРµР»СЏРµРј, С‡С‚Рѕ РїРµСЂРµРґР°РЅРѕ: username РёР»Рё broadcaster_id
            broadcaster_id = identifier

            # Р•СЃР»Рё identifier РЅРµ СЏРІР»СЏРµС‚СЃСЏ С‡РёСЃР»РѕРј, Р·РЅР°С‡РёС‚ СЌС‚Рѕ username - РєРѕРЅРІРµСЂС‚РёСЂСѓРµРј РІ broadcaster_id
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
                            logger.info(f"[OK] Converted username '{identifier}' to broadcaster_id: {broadcaster_id}")
                        else:
                            logger.warning(f"User '{identifier}' not found on Twitch")
                            return JSONResponse(content={"success": True, "badges": {}})
                    else:
                        error_text = await user_response.text()
                        logger.error(f"Failed to get user info: {user_response.status} - {error_text}")
                        # Р•СЃР»Рё РЅРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ user info, РІРѕР·РІСЂР°С‰Р°РµРј РїСѓСЃС‚С‹Рµ badges РІРјРµСЃС‚Рѕ РѕС€РёР±РєРё
                        return JSONResponse(content={"success": True, "badges": {}})

            # РџРѕР»СѓС‡Р°РµРј badges
            badges = await get_channel_badges(broadcaster_id, client_id, access_token)

            return JSONResponse(content={"success": True, "badges": badges})
    except HTTPException:
        raise
    except Exception:
        logger.exception("[ERROR] Error fetching channel badges")
        # Р’РѕР·РІСЂР°С‰Р°РµРј РїСѓСЃС‚С‹Рµ badges РІРјРµСЃС‚Рѕ РѕС€РёР±РєРё, С‡С‚РѕР±С‹ РЅРµ Р»РѕРјР°С‚СЊ РёРЅС‚РµСЂС„РµР№СЃ
        return JSONResponse(content={"success": True, "badges": {}})


