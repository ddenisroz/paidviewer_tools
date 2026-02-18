# features/tts/api/filters_router.py
"""
TTS Filters Router
Handles: word filters (add, remove, list)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user
from services.user_identity_service import UserIdentityService
from services.tts.tts_service import TTSService
from services.tts.tts_core import AddWordRequest

logger = logging.getLogger('bot_service')

filters_router = APIRouter(prefix="/api/tts", tags=["tts-filters"])


@filters_router.get("/filtered-words")
async def get_filtered_words(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ РЎРѓР С—Р С‘РЎРѓР С•Р С” Р С•РЎвЂљРЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№РЎвЂ¦ РЎРѓР В»Р С•Р Р†"""
    try:
        tts_service = TTSService(db)
        words = await tts_service.get_filtered_words(current_user['id'])
        return {"success": True, "data": words}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting filtered words")
        raise HTTPException(status_code=500, detail="Internal server error")


@filters_router.post("/filtered-words")
async def add_filtered_word(
    request: AddWordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓР В»Р С•Р Р†Р С• Р Р† РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.add_filtered_word(
            current_user['id'],
            request.word,
            request.platform
        )

        if success:
            return {"success": True, "message": f"Р РЋР В»Р С•Р Р†Р С• '{request.word}' Р Т‘Р С•Р В±Р В°Р Р†Р В»Р ВµР Р…Р С• Р Р† РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚"}
        else:
            raise HTTPException(status_code=400, detail="Р РЋР В»Р С•Р Р†Р С• РЎС“Р В¶Р Вµ РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ Р Р† РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р Вµ")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error adding filtered word")
        raise HTTPException(status_code=500, detail="Internal server error")


@filters_router.delete("/filtered-words/{word_id}")
async def delete_filtered_word(
    word_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ РЎРѓР В»Р С•Р Р†Р С• Р С‘Р В· РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р В°"""
    try:
        tts_service = TTSService(db)
        success = await tts_service.remove_filtered_word(current_user['id'], word_id)

        if success:
            return {"success": True, "message": "Р РЋР В»Р С•Р Р†Р С• РЎС“Р Т‘Р В°Р В»Р ВµР Р…Р С• Р С‘Р В· РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р В°"}
        else:
            raise HTTPException(status_code=404, detail="Р РЋР В»Р С•Р Р†Р С• Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р С•")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error deleting filtered word")
        raise HTTPException(status_code=500, detail="Internal server error")


@filters_router.get("/filters")
async def get_filters_list(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ РЎРѓР С—Р С‘РЎРѓР С•Р С” Р Р†РЎРѓР ВµРЎвЂ¦ РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р С•Р Р† Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ (alias)"""
    try:
        tts_service = TTSService(db)
        words = await tts_service.get_filtered_words(current_user['id'])
        return {"success": True, "filters": words}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting filters")
        raise HTTPException(status_code=500, detail="Internal server error")


@filters_router.post("/filters")
async def add_filter(
    request: AddWordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓР В»Р С•Р Р†Р С• Р Р† РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚ (alias)"""
    return await add_filtered_word(request, current_user, db)


@filters_router.delete("/filters/{filter_id}")
async def remove_filter(
    filter_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ РЎРѓР В»Р С•Р Р†Р С• Р С‘Р В· РЎвЂћР С‘Р В»РЎРЉРЎвЂљРЎР‚Р В° (alias)"""
    return await delete_filtered_word(filter_id, current_user, db)

