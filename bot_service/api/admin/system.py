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

@router.post("/bot-service/restart")
async def restart_bot_service(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Перезапустить Bot Service (только для админов)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        logger.info(f"[REFRESH] [ADMIN] Bot service restart requested by user {user.get('id')}")
        
        # Получаем доступ к ботам из main
        from startup.bot_registry import get_bot_registry
        registry = get_bot_registry()
        bot_instance = registry.twitch_bot
        vk_live_bot_instance = registry.vk_bot
        
        restart_results = {
            "twitch": {"status": "not_available", "message": "Бот не активен"},
            "vk": {"status": "not_available", "message": "Бот не активен"}
        }
        
        # Перезапуск Twitch бота
        if bot_instance:
            try:
                logger.info("[REFRESH] [ADMIN] Restarting Twitch bot...")
                channels = list(bot_instance.connected_channels) if bot_instance.connected_channels else []
                
                # Отключаем текущие каналы
                for channel in channels:
                    try:
                        await bot_instance.part_channels([channel.name])
                    except Exception as e:
                        logger.error(f"Error parting channel {channel.name}: {e}")
                
                # Переподключаем через небольшую задержку
                await asyncio.sleep(2)
                
                # Получаем активных пользователей с Twitch
                user_repo = UserRepository(db)
                active_twitch_users = user_repo.get_active_with_twitch_token()
                
                reconnected = 0
                for user_record in active_twitch_users:
                    if user_record.twitch_username:
                        try:
                            success = await bot_instance.join_channel(user_record.twitch_username)
                            if success:
                                reconnected += 1
                        except Exception as e:
                            logger.error(f"Error rejoining {user_record.twitch_username}: {e}")
                
                restart_results["twitch"] = {
                    "status": "restarted",
                    "message": f"Переподключено к {reconnected} каналам",
                    "reconnected_channels": reconnected
                }
                logger.info(f"[OK] [ADMIN] Twitch bot restarted, reconnected to {reconnected} channels")
                
            except Exception as e:
                logger.error(f"Error restarting Twitch bot: {e}")
                restart_results["twitch"] = {
                    "status": "error",
                    "message": f"Ошибка перезапуска: {str(e)}"
                }
        
        # Перезапуск VK бота
        if vk_live_bot_instance:
            try:
                logger.info("[REFRESH] [ADMIN] Restarting VK bot...")
                
                # Получаем активных пользователей с VK
                user_repo = UserRepository(db)
                active_vk_users = user_repo.get_active_with_vk_token()
                
                # Переподключаем каналы
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
                        except Exception as e:
                            logger.error(f"Error reconnecting VK channel {user_record.vk_channel_name}: {e}")
                
                restart_results["vk"] = {
                    "status": "restarted",
                    "message": f"Переподключено к {reconnected} каналам",
                    "reconnected_channels": reconnected
                }
                logger.info(f"[OK] [ADMIN] VK bot restarted, reconnected to {reconnected} channels")
                
            except Exception as e:
                logger.error(f"Error restarting VK bot: {e}")
                restart_results["vk"] = {
                    "status": "error",
                    "message": f"Ошибка перезапуска: {str(e)}"
                }
        
        return {
            "success": True,
            "message": "Перезапуск завершен",
            "results": restart_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restarting bot service: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка перезапуска: {str(e)}")

@router.post("/tts/restart")
async def restart_tts_engine(
    user: dict = Depends(get_current_user)
):
    """Перезапустить TTS движок (только для админов)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        logger.info(f"[REFRESH] [ADMIN] TTS engine restart requested by user {user.get('id')}")
        
        # TTS сервис - это отдельный микросервис, мы можем только проверить его статус
        # Реальный перезапуск должен быть выполнен через Docker или системный менеджер
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Проверяем health endpoint
                response = await client.get(f"{TTS_SERVICE_URL}/health")
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": "TTS сервис работает нормально",
                        "status": "healthy",
                        "note": "Для полного перезапуска используйте Docker: docker-compose restart tts_service"
                    }
                else:
                    return {
                        "success": False,
                        "message": "TTS сервис недоступен",
                        "status": "unhealthy",
                        "status_code": response.status_code
                    }
                    
        except httpx.RequestError as e:
            logger.error(f"Error checking TTS service: {e}")
            return {
                "success": False,
                "message": "TTS сервис недоступен",
                "status": "offline",
                "error": str(e),
                "note": "Запустите TTS сервис через: docker-compose up -d tts_service"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restarting TTS engine: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка проверки TTS: {str(e)}")

@router.get("/tts/system/status")
async def get_tts_system_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус системы TTS Service (прокси к TTS Service с проверкой прав)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{TTS_SERVICE_URL}/api/admin/system/status")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get TTS system status error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get TTS system status: {str(e)}")

@router.post("/tts/system/restart")
async def restart_tts_system(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Перезапустить TTS Service (прокси к TTS Service с проверкой прав)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        TTS_SERVICE_URL = settings.tts_service_url
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/api/admin/system/restart")
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except Exception:
                    pass
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restart TTS system error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to restart TTS system: {str(e)}")
