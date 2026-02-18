from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, field_validator
import logging

from core.database import get_db
from services.points_service import PointsService
from validators.input_validators import sanitize_input
from auth.auth import get_current_user
from core.security_modern import limiter

logger = logging.getLogger('bot_service')

points_core_router = APIRouter(tags=["points"])
points_service = PointsService()

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class AddPointsRequest(BaseModel):
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    amount: int
    reason: Optional[str] = "Manual add"

class DeductPointsRequest(BaseModel):
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    amount: int
    reason: Optional[str] = "Manual deduct"

class CreateRewardRequest(BaseModel):
    platform: str
    channel_name: str
    title: str
    description: str
    cost: int
    icon_url: Optional[str] = None
    background_color: Optional[str] = "#3B82F6"
    is_user_input_required: Optional[bool] = False
    max_per_stream: Optional[int] = None
    max_per_user_per_stream: Optional[int] = None
    prompt: Optional[str] = None
    reward_type: Optional[str] = "custom"

    # VK Live СЃРїРµС†РёС„РёС‡РЅС‹Рµ РїРѕР»СЏ (РїСЂРёРѕСЂРёС‚РµС‚ РЅР°Рґ generic РїРѕР»СЏРјРё)
    repair_timeout: Optional[int] = None
    max_uses_count: Optional[int] = None
    max_uses_count_per_user: Optional[int] = None
    is_message_required: Optional[bool] = None

    # Twitch СЃРїРµС†РёС„РёС‡РЅС‹Рµ РїРѕР»СЏ
    global_cooldown_seconds: Optional[int] = None
    is_enabled: Optional[bool] = True
    should_redemptions_skip_request_queue: Optional[bool] = False

    @field_validator('title')
    @classmethod
    def sanitize_title(cls, v):
        """РЎР°РЅРёС‚РёР·Р°С†РёСЏ РЅР°Р·РІР°РЅРёСЏ РЅР°РіСЂР°РґС‹"""
        return sanitize_input(v, max_length=45)

    @field_validator('description')
    @classmethod
    def sanitize_description(cls, v):
        """РЎР°РЅРёС‚РёР·Р°С†РёСЏ РѕРїРёСЃР°РЅРёСЏ РЅР°РіСЂР°РґС‹"""
        return sanitize_input(v, max_length=200)

    @field_validator('prompt')
    @classmethod
    def sanitize_prompt(cls, v):
        """РЎР°РЅРёС‚РёР·Р°С†РёСЏ РїРѕРґСЃРєР°Р·РєРё"""
        if v is not None:
            return sanitize_input(v, max_length=100)
        return v

class RedeemRewardRequest(BaseModel):
    reward_id: int
    viewer_id: str
    viewer_name: str
    platform: str
    channel_name: str
    user_input: Optional[str] = None

class ProcessRewardRequest(BaseModel):
    queue_id: int
    action: str  # approve, reject, fulfill
    moderator_note: Optional[str] = None

class ToggleRewardRequest(BaseModel):
    is_enabled: bool

class ProcessVKDemandsRequest(BaseModel):
    demand_ids: List[int]  # VK demand IDs are integers
    action: str  # 'accept' or 'reject'

class UpdateRewardRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[int] = None
    icon_url: Optional[str] = None
    background_color: Optional[str] = None
    is_user_input_required: Optional[bool] = None
    max_per_stream: Optional[int] = None
    max_per_user_per_stream: Optional[int] = None
    prompt: Optional[str] = None
    enabled: Optional[bool] = None

# ============================================================================
# CORE ENDPOINTS
# ============================================================================

@points_core_router.get("/rewards")
async def get_rewards(
    platform: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РµРЅРёРµ РЅР°РіСЂР°Рґ РєР°РЅР°Р»Р°"""
    try:
        rewards = points_service.get_channel_rewards(user["id"], platform, db)

        return {
            "success": True,
            "rewards": rewards
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting rewards")
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РЅР°РіСЂР°Рґ")

@points_core_router.post("/rewards/redeem")
async def redeem_reward(
    request: RedeemRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±РјРµРЅ РЅР°РіСЂР°РґС‹ Р·Р° Р±Р°Р»Р»С‹"""
    try:
        result = points_service.redeem_reward(
            user["id"],
            request.reward_id,
            request.viewer_id,
            request.viewer_name,
            request.platform,
            request.channel_name,
            request.user_input
        )

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail="Reward operation failed")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error redeeming reward")
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РѕР±РјРµРЅР° РЅР°РіСЂР°РґС‹")

@points_core_router.get("/rewards/queue")
async def get_reward_queue(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РµРЅРёРµ РѕС‡РµСЂРµРґРё РЅР°РіСЂР°Рґ"""
    try:
        queue = points_service.get_reward_queue(user["id"], status, db)

        return {
            "success": True,
            "queue": queue
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting reward queue")
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РѕС‡РµСЂРµРґРё РЅР°РіСЂР°Рґ")

@points_core_router.post("/rewards/process")
async def process_reward(
    request: ProcessRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±СЂР°Р±РѕС‚РєР° РЅР°РіСЂР°РґС‹ РјРѕРґРµСЂР°С‚РѕСЂРѕРј"""
    try:
        result = points_service.process_reward(
            user["id"],
            request.queue_id,
            request.action,
            request.moderator_note
        )

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail="Reward operation failed")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error processing reward")
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РѕР±СЂР°Р±РѕС‚РєРё РЅР°РіСЂР°РґС‹")

@points_core_router.get("/stats")
async def get_channel_stats(
    channel_name: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРѕР»СѓС‡РµРЅРёРµ СЃС‚Р°С‚РёСЃС‚РёРєРё РєР°РЅР°Р»Р°"""
    try:
        stats = points_service.get_channel_stats(user["id"], channel_name, db)

        return {
            "success": True,
            "stats": stats,
            "channel_name": channel_name
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting channel stats")
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ СЃС‚Р°С‚РёСЃС‚РёРєРё")

@points_core_router.put("/rewards/{reward_id}")
@limiter.limit("30/minute")
async def update_reward(
    http_request: Request,
    reward_id: int,
    request: UpdateRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РћР±РЅРѕРІР»РµРЅРёРµ РЅР°РіСЂР°РґС‹"""
    try:
        result = points_service.update_reward(
            user["id"],
            reward_id,
            request.dict(exclude_unset=True),
            db
        )

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail="Reward update failed")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error updating reward %s", reward_id)
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ РЅР°РіСЂР°РґС‹")

@points_core_router.delete("/rewards/{reward_id}")
@limiter.limit("20/minute")
async def delete_reward(
    request: Request,
    reward_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РЈРґР°Р»РµРЅРёРµ РЅР°РіСЂР°РґС‹"""
    try:
        result = points_service.delete_reward(user["id"], reward_id, db)

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail="Reward deletion failed")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error deleting reward %s", reward_id)
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РЅР°РіСЂР°РґС‹")

@points_core_router.patch("/rewards/{reward_id}/toggle")
async def toggle_reward(
    reward_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """РџРµСЂРµРєР»СЋС‡РµРЅРёРµ СЃС‚Р°С‚СѓСЃР° РЅР°РіСЂР°РґС‹ (enabled/disabled)"""
    try:
        result = points_service.toggle_reward(user["id"], reward_id, db)

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail="Reward toggle failed")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error toggling reward %s", reward_id)
        raise HTTPException(status_code=500, detail="РћС€РёР±РєР° РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ РЅР°РіСЂР°РґС‹")

