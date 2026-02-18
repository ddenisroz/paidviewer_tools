# api/tts/local_routes.py
"""
Local TTS API endpoints.
Clean Architecture: uses LocalTTSRepository for data access.
"""
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional
from repositories.local_tts_repository import LocalTTSRepository
from services.tts.tts_core import LocalTTSConfigRequest, check_local_tts_health

logger = logging.getLogger('bot_service.tts.local')

local_tts_router = APIRouter(prefix="/api/local-tts", tags=["local-tts"])


# ============================================================================
# LOCAL TTS CONFIG
# ============================================================================

@local_tts_router.get("/config")
async def get_local_tts_config(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить конфигурацию локального TTS"""
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = user.get('id')
        if not user_id or user_id <= 0:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        repo = LocalTTSRepository(db)
        config = repo.get_by_user_id(user_id)
        
        if not config:
            return {
                "success": True,
                "configured": False,
                "config": None,
                "healthy": False,
                "can_manage_voices": True,
                "message": "Локальный TTS не настроен"
            }
        
        return {
            "success": True,
            "configured": True,
            "healthy": config.is_healthy,
            "can_manage_voices": True,
            "config": {
                "id": config.id,
                "endpoint_url": config.endpoint_url,
                "is_active": config.is_active,
                "use_local": config.use_local,
                "is_healthy": config.is_healthy
            }
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting local TTS config")
        raise HTTPException(status_code=500, detail="Internal server error")


@local_tts_router.post("/config")
async def save_local_tts_config(
    request: LocalTTSConfigRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить конфигурацию локального TTS"""
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = user.get('id')
        if not user_id or user_id <= 0:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        repo = LocalTTSRepository(db)
        config = repo.create_or_update(
            endpoint_url=request.endpoint_url,
            api_key=request.api_key,
            use_local=request.use_local,
            user_id=user_id
        )
        
        # Check health
        health_status = await check_local_tts_health(config.endpoint_url, config.api_key)
        repo.update_health_status(config, health_status['healthy'])
        
        return {
            "success": True,
            "message": "Конфигурация сохранена",
            "config": {"id": config.id, "endpoint_url": config.endpoint_url}
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error saving local TTS config")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# LOCAL TTS TOGGLE
# ============================================================================

@local_tts_router.post("/toggle")
async def toggle_local_tts(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Переключить использование локального TTS"""
    try:
        repo = LocalTTSRepository(db)
        
        db_user = repo.get_user_by_id(user["id"])
        if not db_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        login_platform = user.get('login_platform')
        if not repo.is_user_whitelisted(db_user, login_platform):
            raise HTTPException(
                status_code=403,
                detail="Локальный TTS доступен только для пользователей из whitelist."
            )
        
        config = repo.get_by_user_id(user["id"])
        if not config:
            raise HTTPException(status_code=404, detail="Конфигурация локального TTS не найдена.")
        
        config = repo.toggle_use_local(config)
        
        if config.use_local:
            health_status = await check_local_tts_health(config.endpoint_url, config.api_key)
            if not health_status['healthy']:
                repo.disable_local(config)
                raise HTTPException(
                    status_code=503,
                    detail="Локальный TTS недоступен. Проверьте подключение."
                )
        
        return {
            "success": True,
            "message": f"Локальный TTS {'включен' if config.use_local else 'выключен'}",
            "use_local": config.use_local
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error toggling local TTS")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# LOCAL TTS TEST & SYNC
# ============================================================================

@local_tts_router.post("/test-connection")
async def test_local_tts_connection(
    request: LocalTTSConfigRequest,
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Проверить подключение к локальному TTS"""
    try:
        headers = {}
        if request.api_key:
            headers['Authorization'] = f'Bearer {request.api_key}'
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            health_response = await client.get(f"{request.endpoint_url}/health", headers=headers)
            
            if health_response.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Сервер вернул код {health_response.status_code}")
            
            health_data = health_response.json()
            
            try:
                status_response = await client.get(f"{request.endpoint_url}/api/status", headers=headers)
                status_data = status_response.json() if status_response.status_code == 200 else None
            except Exception:
                status_data = None
            
            return {"success": True, "message": "Подключение установлено", "health_data": health_data, "status_data": status_data}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout: сервис не отвечает.")
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Не удалось подключиться. Проверьте URL.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error testing connection")
        raise HTTPException(status_code=500, detail="Connection check failed")


@local_tts_router.post("/sync-global-voices")
async def sync_global_voices_to_local(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Обнаружить голоса в локальном TTS"""
    try:
        user_id = user.get('id')
        if not user_id or user_id <= 0:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        repo = LocalTTSRepository(db)
        config = repo.get_by_user_id(user_id)
        if not config:
            raise HTTPException(status_code=404, detail="Локальный TTS не настроен")
        
        headers = {}
        if config.api_key:
            headers['Authorization'] = f'Bearer {config.api_key}'
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{config.endpoint_url}/api/voices/list", headers=headers)
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail="Не удалось подключиться")
                
                data = response.json()
                local_voices = data.get('voices', [])
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail="Internal server error")
        
        return {"success": True, "message": f"Обнаружено голосов: {len(local_voices)}", "voices": local_voices}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error syncing voices")
        raise HTTPException(status_code=500, detail="Internal server error")


