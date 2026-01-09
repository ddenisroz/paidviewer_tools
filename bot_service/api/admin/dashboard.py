# bot_service/api/admin/dashboard.py
"""
Admin Dashboard API endpoints.

Clean Architecture: endpoints delegate to AdminStatsService and BotControlService.
No direct DB queries in this file.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import logging
import os
import psutil
import httpx

from core.database import get_db
from auth.auth import get_current_user
from core.datetime_utils import utcnow_naive
from core.config import settings
from services.admin import get_admin_stats_service, AdminStatsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: dict):
    """Check if user is admin."""
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить статистику для Dashboard админ-панели.
    
    Returns:
        - users: статистика пользователей
        - tts: статистика TTS
        - bots: статус ботов
        - system: системная статистика
    """
    try:
        require_admin(user)
        
        from startup.bot_registry import get_bot_registry
        from services.memory_websocket_manager import get_memory_websocket_manager
        
        # Get stats from service
        stats_service = get_admin_stats_service(db)
        dashboard_stats = stats_service.get_dashboard_stats()
        
        # === BOTS STATUS (runtime, not DB) ===
        registry = get_bot_registry()
        twitch_bot = registry.twitch_bot
        vk_bot = registry.vk_bot
        
        twitch_online = False
        twitch_connections = 0
        if twitch_bot:
            twitch_online = hasattr(twitch_bot, 'user_id') and twitch_bot.user_id is not None
            twitch_connections = len(twitch_bot.connected_channels) if hasattr(twitch_bot, 'connected_channels') else 0
        
        vk_online = False
        vk_connections = 0
        if vk_bot:
            vk_online = vk_bot.is_running if hasattr(vk_bot, 'is_running') else False
            vk_connections = len(vk_bot.connected_channels) if hasattr(vk_bot, 'connected_channels') else 0
        
        # WebSocket connections
        ws_stats = get_memory_websocket_manager().get_connection_stats()
        total_connections = ws_stats.get('active_connections', 0)
        
        return {
            "success": True,
            "stats": {
                **dashboard_stats,
                "bots": {
                    "twitch_online": twitch_online,
                    "vk_online": vk_online,
                    "total_connections": total_connections,
                    "twitch_connections": twitch_connections,
                    "vk_connections": vk_connections
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)


@router.get("/list")
async def get_admin_list(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список для админ-панели."""
    try:
        require_admin(user)
        
        stats_service = get_admin_stats_service(db)
        result = stats_service.get_admin_list_stats()
        
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting admin list: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)


@router.get("/bots/status")
async def get_bots_status(
    user: dict = Depends(get_current_user)
):
    """Получить статус всех ботов."""
    try:
        require_admin(user)
        
        from startup.bot_registry import get_bot_registry
        registry = get_bot_registry()
        bot_instance = registry.twitch_bot
        vk_live_bot_instance = registry.vk_bot
        
        twitch_is_ready = False
        if bot_instance:
            twitch_is_ready = hasattr(bot_instance, 'user_id') and bot_instance.user_id is not None
        
        twitch_status = {
            "connected": bot_instance is not None,
            "channels": len(bot_instance.connected_channels) if bot_instance else 0,
            "is_ready": twitch_is_ready
        }
        
        vk_status = {
            "connected": vk_live_bot_instance is not None,
            "channels": len(vk_live_bot_instance.connected_channels) if vk_live_bot_instance else 0,
            "is_running": vk_live_bot_instance.is_running if vk_live_bot_instance else False
        }
        
        return {
            "success": True,
            "bots": {
                "twitch": twitch_status,
                "vk": vk_status
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bots status: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)


@router.get("/tts/status")
async def get_tts_status(
    user: dict = Depends(get_current_user)
):
    """Получить статус TTS сервиса."""
    try:
        require_admin(user)
        
        tts_service_url = settings.tts_service_url
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{tts_service_url}/health", timeout=5.0)
                tts_data = response.json()
                
                service_status = tts_data.get("status", "unknown")
                is_healthy = response.status_code == 200 and service_status in ["healthy", "ok", "up"]
                
            return {
                "success": True,
                "tts_service": {
                    "healthy": is_healthy,
                    "available": True,
                    "status": service_status,
                    "url": tts_service_url
                }
            }
        except Exception as e:
            return {
                "success": True,
                "tts_service": {
                    "healthy": False,
                    "available": False,
                    "error": str(e),
                    "status": "offline",
                    "url": tts_service_url
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting TTS status: {e}")
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)


@router.get("/monitoring/metrics")
async def get_monitoring_metrics(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить метрики мониторинга."""
    try:
        require_admin(user)
        
        stats_service = get_admin_stats_service(db)
        metrics = stats_service.get_monitoring_metrics()
        
        # Add runtime channel info
        from core.connection_manager import get_connection_manager
        connection_manager = get_connection_manager()
        active_channels = connection_manager.get_active_channels() if hasattr(connection_manager, 'get_active_channels') else []
        twitch_channels = [ch for ch in active_channels if not ch.isdigit()]
        vk_channels = [ch for ch in active_channels if ch.isdigit()]
        tts_enabled_channels = len(connection_manager.tts_enabled_channels) if hasattr(connection_manager, 'tts_enabled_channels') else 0
        
        metrics["channels"] = {
            "active": len(active_channels),
            "twitch": len(twitch_channels),
            "vk": len(vk_channels)
        }
        metrics["tts"] = {
            "enabled_channels": tts_enabled_channels,
            "requests_24h": 0
        }
        metrics["timestamp"] = utcnow_naive().isoformat()
        
        return {"success": True, "metrics": metrics}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monitoring metrics: {e}")
        return {"success": False, "error": str(e)}


@router.get("/analytics")
async def get_analytics(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить аналитику системы."""
    try:
        logger.info(f"[STATS] [ANALYTICS] Request from user {user.get('id')}")
        require_admin(user)
        
        stats_service = get_admin_stats_service(db)
        analytics = stats_service.get_analytics()
        
        # Add system metrics (runtime)
        try:
            cpu_usage = psutil.cpu_percent(interval=1)
            memory_info = psutil.virtual_memory()
            memory_usage = memory_info.percent
            current_process = psutil.Process(os.getpid())
            process_memory_mb = current_process.memory_info().rss / 1024 / 1024
        except Exception as e:
            logger.warning(f"[WARN] [ANALYTICS] Could not get system metrics: {e}")
            cpu_usage = 0
            memory_usage = 0
            process_memory_mb = 0
        
        analytics.update({
            "errors_count": 0,
            "last_error": None,
            "uptime_percent": 99.8,
            "avg_response_time": None,
            "cpu_usage": round(cpu_usage, 1),
            "memory_usage": round(memory_usage, 1),
            "process_memory_mb": round(process_memory_mb, 1),
        })
        
        return {"success": True, "analytics": analytics}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] [ANALYTICS] Error getting analytics: {e}")
        import traceback
        logger.error(f"[ERROR] [ANALYTICS] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения аналитики: {str(e)}")
