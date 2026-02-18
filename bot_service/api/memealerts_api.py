"""MemeAlerts API endpoints for grants, settings, and automation."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional
from repositories.user_token_repository import UserTokenRepository
from services.memealerts_service import MemeAlertsService
import logging
import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memealerts", tags=["memealerts"])

MEMEALERTS_API_BASE = "https://memealerts.com/api"


def decode_memealerts_token(token: str) -> dict:
    """
    Decode MemeAlerts JWT token without verification.
    Returns payload with 'id' (streamer ID), 'scope', 'tid', etc.
    """
    try:
        return jwt.decode(token, options={"verify_signature": False})
    except jwt.DecodeError as e:
        logger.error(f"Failed to decode MemeAlerts token: {e}")
        raise ValueError("Invalid token format")


class PlatformRewardSettingsPatch(BaseModel):
    enabled: Optional[bool] = None
    reward_id: Optional[str] = None
    reward_title: Optional[str] = None
    coins_amount: Optional[int] = Field(default=None, ge=1, le=1_000_000)
    reward_cost: Optional[int] = Field(default=None, ge=1, le=1_000_000)


class DonationAutoSettingsPatch(BaseModel):
    enabled: Optional[bool] = None
    coins_per_currency: Optional[float] = Field(default=None, ge=0.01, le=1_000_000)
    min_donation_amount: Optional[float] = Field(default=None, ge=0.01, le=1_000_000)


class MemeAlertsSettingsPatch(BaseModel):
    twitch: Optional[PlatformRewardSettingsPatch] = None
    vk: Optional[PlatformRewardSettingsPatch] = None
    donation_auto: Optional[DonationAutoSettingsPatch] = None


class CreatePointsRewardRequest(BaseModel):
    platform: Literal["twitch", "vk"]
    title: str = Field(default="MemeCoins", min_length=1, max_length=80)
    cost: int = Field(default=500, ge=1, le=1_000_000)
    coins_amount: int = Field(default=10, ge=1, le=1_000_000)
    cooldown_seconds: int = Field(default=0, ge=0, le=86_400)


@router.get("/status")
async def get_memealerts_status(
    user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Check MemeAlerts connection status"""
    try:
        if not user or not user.get('id'):
            return {"success": True, "connected": False}

        user_id = user.get('id')
        token_repo = UserTokenRepository(db)
        token = token_repo.get_by_user_and_platform(user_id, "memealerts")

        if token and token.access_token:
            # Try to decode token to get streamer info
            try:
                decoded = decode_memealerts_token(token.access_token)
                return {
                    "success": True, 
                    "connected": True,
                    "streamer_id": decoded.get("id"),
                    "platform_user_id": token.platform_user_id
                }
            except ValueError:
                # Token is invalid, but exists
                return {"success": True, "connected": True}
        
        return {"success": True, "connected": False}
    except Exception as e:
        logger.error(f"Error getting MemeAlerts status: {e}")
        return {"success": False, "error": "Internal server error"}


@router.get("/settings")
async def get_memealerts_settings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Load MemeAlerts automation settings."""
    try:
        user_id = user.get("id")
        service = MemeAlertsService(db)
        settings = service.get_settings(user_id)
        return {"success": True, "settings": settings}
    except Exception as e:
        logger.error(f"Error getting MemeAlerts settings: {e}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.post("/settings")
async def save_memealerts_settings(
    payload: MemeAlertsSettingsPatch,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save MemeAlerts automation settings."""
    try:
        user_id = user.get("id")
        service = MemeAlertsService(db)

        patch: dict = {}
        points_patch: dict = {}
        if payload.twitch is not None:
            points_patch["twitch"] = payload.twitch.model_dump(exclude_unset=True)
        if payload.vk is not None:
            points_patch["vk"] = payload.vk.model_dump(exclude_unset=True)
        if points_patch:
            patch["points_reward"] = points_patch
        if payload.donation_auto is not None:
            patch["donation_auto"] = payload.donation_auto.model_dump(exclude_unset=True)

        settings = service.save_settings(user_id, patch)
        return {"success": True, "settings": settings}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving MemeAlerts settings: {e}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.post("/rewards/create")
async def create_memealerts_points_reward(
    payload: CreatePointsRewardRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create Twitch/VK reward that grants MemeCoins by supporter nickname."""
    try:
        user_id = user.get("id")
        service = MemeAlertsService(db)
        result = await service.create_points_reward(
            user_id=user_id,
            platform=payload.platform,
            title=payload.title,
            cost=payload.cost,
            coins_amount=payload.coins_amount,
            cooldown_seconds=payload.cooldown_seconds,
        )
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating MemeAlerts points reward: {e}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.post("/connect")
async def connect_memealerts(
    token_data: dict = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save MemeAlerts token obtained from popup OAuth flow.
    Expects: { access_token: string, refresh_token?: string }
    """
    try:
        user_id = user.get('id')
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")

        if not access_token:
            raise HTTPException(status_code=400, detail="access_token is required")

        # Validate and decode token to extract streamer ID
        try:
            decoded = decode_memealerts_token(access_token)
            streamer_id = decoded.get("id")
            token_scope = decoded.get("scope")
            
            if not streamer_id:
                raise HTTPException(status_code=400, detail="Token does not contain streamer ID")
            
            logger.info(f"MemeAlerts token decoded: streamer_id={streamer_id}, scope={token_scope}")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid token format")

        # Optional: Validate token by making a test API call
        # This verifies the token is actually valid and not expired
        # Commenting out for now as we don't know a safe endpoint
        # async with httpx.AsyncClient() as client:
        #     response = await client.get(
        #         f"{MEMEALERTS_API_BASE}/user/me",
        #         headers={"Authorization": f"Bearer {access_token}"}
        #     )
        #     if response.status_code != 200:
        #         raise HTTPException(status_code=400, detail="Token validation failed")

        # Store token in database
        token_repo = UserTokenRepository(db)
        token_repo.upsert(
            user_id=user_id,
            platform="memealerts",
            access_token=access_token,
            refresh_token=refresh_token,
            platform_user_id=streamer_id
        )

        logger.info(f"[OK] MemeAlerts connected for user {user_id}, streamer_id={streamer_id}")
        return {"success": True, "connected": True, "streamer_id": streamer_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting MemeAlerts: {e}")
        return {"success": False, "error": "Internal server error"}


@router.post("/disconnect")
async def disconnect_memealerts(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove MemeAlerts token"""
    try:
        user_id = user.get('id')
        token_repo = UserTokenRepository(db)
        token_repo.delete_by_user_and_platform(user_id, "memealerts")
        
        logger.info(f"[OK] MemeAlerts disconnected for user {user_id}")
        return {"success": True, "connected": False}
    except Exception as e:
        logger.error(f"Error disconnecting MemeAlerts: {e}")
        return {"success": False, "error": "Internal server error"}


@router.post("/grant")
async def grant_coins(
    grant_data: dict = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Grant MemeCoins to a user.
    Expects: { userId?: string, nickname?: string, value: number }
    """
    try:
        user_id = user.get('id')
        target_user_id = (grant_data.get("userId") or "").strip()
        nickname = (grant_data.get("nickname") or "").strip()
        value = grant_data.get("value")

        if value is None:
            raise HTTPException(status_code=400, detail="value is required")
        if not target_user_id and not nickname:
            raise HTTPException(status_code=400, detail="userId or nickname is required")

        try:
            amount = int(value)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="value must be an integer")

        service = MemeAlertsService(db)
        result = await service.grant_coins(
            user_id=user_id,
            nickname_or_id=target_user_id or nickname,
            amount=amount,
            platform="dashboard",
            channel_name="dashboard",
            issued_by=str(user.get("username") or user_id),
            source="ui",
        )

        if not result.get("success"):
            return {"success": False, "error": result.get("error"), "detail": result.get("detail")}

        logger.info(f"[OK] MemeAlerts grant successful: {result}")
        return {"success": True, "data": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error granting coins: {e}", exc_info=True)
        return {"success": False, "error": "Internal server error"}


@router.get("/history")
async def get_memealerts_history(
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get MemeAlerts grant/purchase history from MemeAlerts API."""
    try:
        user_id = user.get("id")
        service = MemeAlertsService(db)
        result = await service.fetch_history(user_id=user_id, limit=limit)
        return result
    except Exception as e:
        logger.error(f"Error loading MemeAlerts history: {e}", exc_info=True)
        return {"success": False, "error": "Internal server error", "grants": [], "purchases": [], "unknown": []}

