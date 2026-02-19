from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from core.config import settings
from repositories.user_repository import UserRepository
import logging
import asyncio
import httpx
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])
def _tts_auth_headers() -> dict:
    headers: dict = {}
    if settings.tts_internal_api_key:
        headers["X-Internal-Service-Key"] = settings.tts_internal_api_key
    return headers
@router.post("/bot-service/restart")
async def restart_bot_service(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р СџР ВµРЎР‚Р ВµР В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ Bot Service (РЎвЂљР С•Р В»РЎРЉР С”Р С• Р Т‘Р В»РЎРЏ Р В°Р Т‘Р СР С‘Р Р…Р С•Р Р†)"""
    try:
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        logger.info(f"[REFRESH] [ADMIN] Bot service restart requested by user {user.get('id')}")
        
        # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С— Р С” Р В±Р С•РЎвЂљР В°Р С Р С‘Р В· main
        from startup.bot_registry import get_bot_registry
        registry = get_bot_registry()
        bot_instance = registry.twitch_bot
        vk_live_bot_instance = registry.vk_bot
        
        restart_results = {
            "twitch": {"status": "not_available", "message": "Р вЂР С•РЎвЂљ Р Р…Р Вµ Р В°Р С”РЎвЂљР С‘Р Р†Р ВµР Р…"},
            "vk": {"status": "not_available", "message": "Р вЂР С•РЎвЂљ Р Р…Р Вµ Р В°Р С”РЎвЂљР С‘Р Р†Р ВµР Р…"}
        }
        
        # Р СџР ВµРЎР‚Р ВµР В·Р В°Р С—РЎС“РЎРѓР С” Twitch Р В±Р С•РЎвЂљР В°
        if bot_instance:
            try:
                logger.info("[REFRESH] [ADMIN] Restarting Twitch bot...")
                channels = list(bot_instance.connected_channels) if bot_instance.connected_channels else []
                
                # Р С›РЎвЂљР С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С РЎвЂљР ВµР С”РЎС“РЎвЂ°Р С‘Р Вµ Р С”Р В°Р Р…Р В°Р В»РЎвЂ№
                for channel in channels:
                    try:
                        await bot_instance.part_channels([channel.name])
                    except Exception:
                        logger.exception("Error parting channel %s", channel.name)
                
                # Р СџР ВµРЎР‚Р ВµР С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С РЎвЂЎР ВµРЎР‚Р ВµР В· Р Р…Р ВµР В±Р С•Р В»РЎРЉРЎв‚¬РЎС“РЎР‹ Р В·Р В°Р Т‘Р ВµРЎР‚Р В¶Р С”РЎС“
                await asyncio.sleep(2)
                
                # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р В°Р С”РЎвЂљР С‘Р Р†Р Р…РЎвЂ№РЎвЂ¦ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР в„– РЎРѓ Twitch
                user_repo = UserRepository(db)
                active_twitch_users = user_repo.get_active_with_twitch_token()
                
                reconnected = 0
                for user_record in active_twitch_users:
                    if user_record.twitch_username:
                        try:
                            success = await bot_instance.join_channel(user_record.twitch_username)
                            if success:
                                reconnected += 1
                        except Exception:
                            logger.exception("Error rejoining %s", user_record.twitch_username)
                
                restart_results["twitch"] = {
                    "status": "restarted",
                    "message": f"Р СџР ВµРЎР‚Р ВµР С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С• Р С” {reconnected} Р С”Р В°Р Р…Р В°Р В»Р В°Р С",
                    "reconnected_channels": reconnected
                }
                logger.info(f"[OK] [ADMIN] Twitch bot restarted, reconnected to {reconnected} channels")
                
            except Exception:
                logger.exception("Error restarting Twitch bot")
                restart_results["twitch"] = {
                    "status": "error",
                    "message": f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—Р ВµРЎР‚Р ВµР В·Р В°Р С—РЎС“РЎРѓР С”Р В°"
                }
        
        # Р СџР ВµРЎР‚Р ВµР В·Р В°Р С—РЎС“РЎРѓР С” VK Р В±Р С•РЎвЂљР В°
        if vk_live_bot_instance:
            try:
                logger.info("[REFRESH] [ADMIN] Restarting VK bot...")
                
                # Р СџР С•Р В»РЎС“РЎвЂЎР В°Р ВµР С Р В°Р С”РЎвЂљР С‘Р Р†Р Р…РЎвЂ№РЎвЂ¦ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»Р ВµР в„– РЎРѓ VK
                user_repo = UserRepository(db)
                active_vk_users = user_repo.get_active_with_vk_token()
                
                # Р СџР ВµРЎР‚Р ВµР С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР В°Р ВµР С Р С”Р В°Р Р…Р В°Р В»РЎвЂ№
                reconnected = 0
                for user_record in active_vk_users:
                    if user_record.vk_channel_name:
                        try:
                            await vk_live_bot_instance.disconnect_from_channel(user_record.vk_channel_name)
                            await asyncio.sleep(1)
                            success = await vk_live_bot_instance.connect_to_channel(
                                user_record.vk_channel_name,
                                user_record.vk_access_token
                            )
                            if success:
                                reconnected += 1
                        except Exception:
                            logger.exception("Error reconnecting VK channel %s", user_record.vk_channel_name)
                
                restart_results["vk"] = {
                    "status": "restarted",
                    "message": f"Р СџР ВµРЎР‚Р ВµР С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С• Р С” {reconnected} Р С”Р В°Р Р…Р В°Р В»Р В°Р С",
                    "reconnected_channels": reconnected
                }
                logger.info(f"[OK] [ADMIN] VK bot restarted, reconnected to {reconnected} channels")
                
            except Exception:
                logger.exception("Error restarting VK bot")
                restart_results["vk"] = {
                    "status": "error",
                    "message": f"Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—Р ВµРЎР‚Р ВµР В·Р В°Р С—РЎС“РЎРѓР С”Р В°"
                }
        
        return {
            "success": True,
            "message": "Перезапуск завершен",
            "results": restart_results
        }
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error restarting bot service")
        raise HTTPException(status_code=500, detail="Internal server error")
@router.post("/tts/restart")
async def restart_tts_engine(
    user: dict = Depends(get_current_user)
):
    """Restart/check TTS engine availability (admin only)."""
    try:
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")

        logger.info(f"[REFRESH] [ADMIN] TTS engine restart requested by user {user.get('id')}")
        tts_service_url = settings.tts_service_url

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{tts_service_url}/health", headers=_tts_auth_headers())
                if response.status_code != 200:
                    raise HTTPException(status_code=502, detail=f"TTS unhealthy (status={response.status_code})")

                return {
                    "success": True,
                    "message": "TTS service healthcheck is OK",
                    "status": "healthy",
                    "note": "For full restart use infrastructure restart (e.g. docker-compose restart tts_service)."
                }
        except httpx.RequestError:
            logger.exception("Error checking TTS service")
            raise HTTPException(status_code=502, detail="TTS service offline or unreachable")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error restarting TTS engine")
        raise HTTPException(status_code=500, detail="Internal server error")@router.get("/tts/system/status")
async def get_tts_system_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№ TTS Service (Р С—РЎР‚Р С•Р С”РЎРѓР С‘ Р С” TTS Service РЎРѓ Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р С•Р в„– Р С—РЎР‚Р В°Р Р†)"""
    try:
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{TTS_SERVICE_URL}/api/admin/system/status", headers=_tts_auth_headers())
            
            if response.status_code != 200:
                logger.warning(
                    "TTS system status request failed: status=%s body=%s",
                    response.status_code,
                    response.text[:500],
                )
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch TTS system status")
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception:
        logger.exception("Get TTS system status error")
        raise HTTPException(status_code=500, detail="Internal server error")
@router.post("/tts/system/restart")
async def restart_tts_system(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Перезапустить TTS Service (прокси к TTS Service с проверкой прав)"""
    try:
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/system/restart", headers=_tts_auth_headers())
            
            if response.status_code != 200:
                logger.warning(
                    "TTS system restart request failed: status=%s body=%s",
                    response.status_code,
                    response.text[:500],
                )
                raise HTTPException(status_code=response.status_code, detail="Failed to restart TTS system")
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception:
        logger.exception("Restart TTS system error")
        raise HTTPException(status_code=500, detail="Internal server error")


