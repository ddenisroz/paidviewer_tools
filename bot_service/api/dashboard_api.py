# bot_service/api/dashboard_api.py
"""
Dashboard API - Batch endpoint РґР»СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РґР°С€Р±РѕСЂРґР°.
РћР±СЉРµРґРёРЅСЏРµС‚ РЅРµСЃРєРѕР»СЊРєРѕ Р·Р°РїСЂРѕСЃРѕРІ РІ РѕРґРёРЅ РґР»СЏ РѕРїС‚РёРјРёР·Р°С†РёРё РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё.
Refactored to use DashboardService (Clean Architecture).
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user_optional
from services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/init")
async def get_dashboard_init(
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> JSONResponse:
    """
    Batch endpoint РґР»СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РґР°С€Р±РѕСЂРґР°.
    
    Р’РѕР·РІСЂР°С‰Р°РµС‚ РІСЃРµ РЅРµРѕР±С…РѕРґРёРјС‹Рµ РґР°РЅРЅС‹Рµ РѕРґРЅРёРј Р·Р°РїСЂРѕСЃРѕРј:
    - user: РёРЅС„РѕСЂРјР°С†РёСЏ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ
    - integrations: СЃС‚Р°С‚СѓСЃ РёРЅС‚РµРіСЂР°С†РёР№ (Twitch, VK, DonationAlerts)
    - tts: РЅР°СЃС‚СЂРѕР№РєРё TTS
    - chat_history: РїРѕСЃР»РµРґРЅРёРµ СЃРѕРѕР±С‰РµРЅРёСЏ С‡Р°С‚Р° (50)
    
    Р­С‚Рѕ Р·Р°РјРµРЅСЏРµС‚ 4-6 РѕС‚РґРµР»СЊРЅС‹С… Р·Р°РїСЂРѕСЃРѕРІ РїСЂРё Р·Р°РіСЂСѓР·РєРµ РіР»Р°РІРЅРѕР№ СЃС‚СЂР°РЅРёС†С‹.
    """
    try:
        service = DashboardService(db)
        data = await service.get_dashboard_init_data(current_user)
        
        return JSONResponse(content=data)
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("[ERROR] [DASHBOARD] Error loading init data")
        raise HTTPException(status_code=500, detail="Internal server error")

