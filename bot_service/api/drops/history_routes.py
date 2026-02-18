# api/drops/history_routes.py
"""
Drops History, Stats, Streaks, and Open endpoints.

Clean Architecture: endpoints delegate to DropsService.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.database import get_db, DropsHistory
from auth.auth import get_current_user, get_current_user_optional
from utils.enhanced_logger import drops_logger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drops", tags=["drops"])


# === PYDANTIC MODELS ===

class DropsOpenRequest(BaseModel):
    """Р В Р’В Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ Drops"""
    drops_type: str = Field(..., pattern="^(streak|donation|mythical)$")
    viewer_id: str = Field(..., min_length=1, max_length=100)
    viewer_name: str = Field(..., min_length=1, max_length=100)
    donation_amount: Optional[float] = Field(None, ge=0.01)
    streak_days: Optional[int] = Field(None, ge=1)
    messages_count: Optional[int] = Field(None, ge=0)


# === UTILITY FUNCTIONS ===

def get_user_id(current_user: dict) -> int:
    """Р В Р’В Р Р†Р вЂљРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р В РІР‚В Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В°Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў user_id Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚СњР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР’В°Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚Сћ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ"""
    if not current_user:
        return None
    user_id = current_user.get('id')
    if not user_id or user_id <= 0:
        return None
    return user_id


def get_drops_service(db: Session):
    """Get DropsService instance."""
    from services.drops.drops_service import DropsService
    return DropsService(db)


# === API ENDPOINTS ===

@router.get("/qualities")
async def get_drops_qualities(db: Session = Depends(get_db)):
    """Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚Сњ Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р В РІР‚В  Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В """
    try:
        service = get_drops_service(db)
        qualities = service.get_all_qualities()
        return {"success": True, "data": qualities}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting drops qualities")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/history/{channel_name}")
async def get_drops_history(
    channel_name: str,
    platform: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РІР‚в„– Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В  Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°"""
    try:
        service = get_drops_service(db)
        
        history = service.get_drops_history(
            user_id=current_user["id"],
            channel_name=channel_name,
            platform=platform or "twitch",
            limit=limit,
            offset=offset
        )
        
        # Get quality info for entries
        quality_ids = {e.quality_id for e in history if e.quality_id}
        qualities = service.get_qualities_by_ids(list(quality_ids))
        
        return {
            "success": True,
            "data": [
                {
                    "id": entry.id,
                    "viewer_name": entry.viewer_name,
                    "drops_type": entry.lootbox_type,
                    "quality": qualities.get(entry.quality_id, {}),
                    "reward_name": entry.reward_name,
                    "reward_type": entry.reward_type,
                    "donation_amount": entry.donation_amount,
                    "streak_days": entry.streak_days,
                    "messages_count": entry.messages_count,
                    "created_at": entry.created_at
                }
                for entry in history
            ]
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting drops history")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/open")
async def open_drops(
    request: DropsOpenRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Opens a lootbox for a viewer"""
    try:
        from services.drops.drops_service import DropsService
        from services.drops.drops_calculation_service import DropsCalculationService
        from repositories.drops_history_repository import DropsHistoryRepository
        
        drops_service = DropsService(db)
        calc_service = DropsCalculationService(db)
        history_repo = DropsHistoryRepository(db)
        
        config = drops_service.get_config_by_user_id(current_user["id"])
        if not config:
            raise HTTPException(status_code=404, detail="Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎвЂєР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Drops Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°")
        
        quality_name = None
        
        if request.drops_type == "streak":
            streak = drops_service.get_user_streak(
                user_id=current_user["id"],
                channel_name=config.channel_name,
                platform=config.platform,
                viewer_id=request.viewer_id
            )
            
            if not streak or streak.current_streak < config.streak_days_common:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient streak for drop. Required at least {config.streak_days_common} days."
                )
            
            if streak.current_streak >= config.streak_days_legendary:
                quality_name = "Legendary"
            elif streak.current_streak >= config.streak_days_epic:
                quality_name = "Epic"
            elif streak.current_streak >= config.streak_days_rare:
                quality_name = "Rare"
            else:
                quality_name = "Common"
                
        elif request.drops_type == "donation":
            if not request.donation_amount:
                raise HTTPException(status_code=400, detail="Р В Р’В Р В Р вЂ№Р В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋР’ВР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В° Р В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В° Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°")
            
            if request.donation_amount >= config.donation_amount_legendary:
                quality_name = "Legendary"
            elif request.donation_amount >= config.donation_amount_epic:
                quality_name = "Epic"
            elif request.donation_amount >= config.donation_amount_rare:
                quality_name = "Rare"
            elif request.donation_amount >= config.donation_amount_common:
                quality_name = "Common"
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Donation amount is too low for drop. Minimum required: {config.donation_amount_common}."
                )
                
        elif request.drops_type == "mythical":
            quality_name = "Mythical"
            if not drops_service._can_activate_mythical(config):
                raise HTTPException(status_code=400, detail="Р В Р’В Р РЋРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎвЂєР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РЎвЂњ Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљР’В°Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦")
        else:
            raise HTTPException(status_code=400, detail="Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В·Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂќ Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’В°")
        
        try:
            drop_result = calc_service.calculate_drop(
                user_id=current_user["id"],
                channel_name=config.channel_name,
                platform=config.platform,
                quality_name=quality_name
            )
        except ValueError as e:
            logger.exception("[ERROR] [DROPS] Failed to calculate drop")
            raise HTTPException(status_code=500, detail="Internal server error")
        
        quality = drops_service.get_quality_by_name(quality_name)
        
        history_entry = history_repo.create_history_entry(
            user_id=current_user["id"],
            channel_name=config.channel_name,
            platform=config.platform,
            viewer_id=request.viewer_id,
            viewer_name=request.viewer_name,
            lootbox_type=request.drops_type,
            quality_id=quality.id if quality else None,
            reward_id=drop_result["reward_id"],
            reward_name=drop_result["reward_name"],
            reward_type=drop_result["reward_type"],
            reward_value=drop_result["reward_value"],
            donation_amount=request.donation_amount if request.drops_type == "donation" else None,
            streak_days=request.streak_days if request.drops_type == "streak" else None,
            messages_count=request.messages_count if request.drops_type == "streak" else None
        )
        
        logger.info(
            f"[OK] [DROPS] Opened {request.drops_type} lootbox for {request.viewer_name}: "
            f"{drop_result['reward_name']} ({quality_name})"
        )
        
        # WebSocket notification
        try:
            from services.memory_websocket_manager import get_memory_websocket_manager
            ws_message = {
                "type": "drops_opened",
                "data": {
                    "viewer_name": request.viewer_name,
                    "drops_type": request.drops_type,
                    "quality": quality_name,
                    "reward": drop_result,
                    "history_id": history_entry.id
                }
            }
            await get_memory_websocket_manager().send_to_user(current_user["id"], ws_message)
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification: {ws_error}")
        
        return {
            "success": True,
            "data": {
                "type": request.drops_type,
                "viewer_name": request.viewer_name,
                "quality": quality_name,
                "reward": drop_result,
                "history_id": history_entry.id
            }
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error opening drops")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats/{channel_name}")
async def get_drops_stats(
    channel_name: str,
    platform: str = "twitch",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р Р‹Р РЋРІР‚Сљ Drops Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°"""
    try:
        service = get_drops_service(db)
        stats = service.get_full_channel_stats(
            user_id=current_user["id"],
            channel_name=channel_name,
            platform=platform
        )
        return {"success": True, "data": stats}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting drops stats")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/streaks/{channel_name}")
async def get_user_streaks(
    channel_name: str,
    platform: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚Сњ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В  Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ"""
    try:
        service = get_drops_service(db)
        user_id = get_user_id(current_user)
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        config = service.get_config(
            user_id=user_id,
            session_id=current_user.get("session_id"),
            channel_name=channel_name,
            platform=None
        )
        
        streak_enabled = False
        if config:
            streak_enabled = getattr(config, 'streak_enabled_twitch', False) or getattr(config, 'streak_enabled_vk', False)
        
        if not config or not streak_enabled:
            return {"success": True, "data": []}
        
        streaks = service.get_user_streaks_paginated(
            user_id=user_id,
            channel_name=channel_name,
            platform=platform,
            limit=limit,
            offset=offset
        )
        
        return {"success": True, "data": streaks}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting user streaks")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/streak/reset/{channel_name}")
async def reset_streak_statistics(
    channel_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Р В Р’В Р В Р вЂ№Р В Р’В Р вЂ™Р’В±Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р В РІР‚В Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В РІР‚в„– Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р Р‹Р РЋРІР‚Сљ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В  Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°"""
    try:
        service = get_drops_service(db)
        user_id = get_user_id(current_user)
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        config = service.get_config(
            user_id=user_id,
            session_id=current_user.get("session_id"),
            channel_name=channel_name,
            platform=None
        )
        
        if not config:
            raise HTTPException(status_code=404, detail="Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎвЂєР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°")
        
        deleted_count = service.reset_channel_streaks(user_id=user_id, channel_name=channel_name)
        
        drops_logger.info(f"[DELETE] [STREAK RESET] Р В Р’В Р В РІвЂљВ¬Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ {deleted_count} Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ {channel_name}")
        
        return {
            "success": True,
            "message": "Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В  Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’В±Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°",
            "data": {"channel_name": channel_name, "platform": "all", "deleted_count": deleted_count}
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error resetting streak statistics")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/mythical-session/{channel_name}")
async def get_active_mythical_session(
    channel_name: str,
    widget_token: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚СњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р’В Р В РІР‚В¦Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РІР‚в„– Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РІР‚в„– Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎвЂєР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚Сћ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р РЋРІР‚СљР В Р’В Р В РІР‚В¦Р В Р’В Р СћРІР‚ВР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°"""
    try:
        service = get_drops_service(db)
        
        if widget_token:
            config = service.get_config_by_widget_token(widget_token)
            if not config:
                raise HTTPException(status_code=404, detail="Invalid widget token")
            user_id = config.user_id
            session_id = config.session_id
        elif current_user:
            user_id = current_user.get("id")
            session_id = current_user.get("session_id")
        else:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        session_data = service.get_active_mythical_session(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name
        )
        
        return {"success": True, "data": session_data}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting active mythical session")
        raise HTTPException(status_code=500, detail="Internal server error")

