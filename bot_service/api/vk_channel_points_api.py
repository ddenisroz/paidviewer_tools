"""
API endpoints РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РЅР°РіСЂР°РґР°РјРё VK Live Channel Points

Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
РђРІС‚РѕСЂ: AI Assistant
Р”Р°С‚Р°: 27 РґРµРєР°Р±СЂСЏ 2025
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user
from utils.vk_api_client import VKLiveAPIClient, VKAPIError
from core.token_encryption import decrypt_token, is_token_encrypted
from repositories.user_token_repository import UserTokenRepository
from repositories.user_repository import UserRepository
from utils.vk_channel_url import normalize_vk_channel_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vk/channel_points", tags=["vk-channel-points"])


# === Pydantic Models ===

class RewardCreate(BaseModel):
    """РњРѕРґРµР»СЊ РґР»СЏ СЃРѕР·РґР°РЅРёСЏ РЅР°РіСЂР°РґС‹"""
    name: str = Field(..., min_length=1, max_length=100, description="РќР°Р·РІР°РЅРёРµ РЅР°РіСЂР°РґС‹")
    price: int = Field(..., ge=1, description="Р¦РµРЅР° РІ Р±Р°Р»Р»Р°С…")
    description: str = Field(default="", max_length=500, description="РћРїРёСЃР°РЅРёРµ РЅР°РіСЂР°РґС‹")
    background_color: int = Field(default=0, description="Р¦РІРµС‚ С„РѕРЅР° (С‡РёСЃР»Рѕ)")
    is_message_required: bool = Field(default=False, description="РўСЂРµР±СѓРµС‚СЃСЏ Р»Рё СЃРѕРѕР±С‰РµРЅРёРµ")
    max_uses_count: Optional[int] = Field(default=None, ge=1, description="РњР°РєСЃРёРјСѓРј РёСЃРїРѕР»СЊР·РѕРІР°РЅРёР№")
    max_uses_count_per_user: Optional[int] = Field(default=None, ge=1, description="РњР°РєСЃРёРјСѓРј РЅР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ")
    repair_timeout: Optional[int] = Field(default=None, ge=0, description="Р’СЂРµРјСЏ РїРµСЂРµР·Р°СЂСЏРґРєРё (СЃРµРєСѓРЅРґС‹)")


class RewardUpdate(BaseModel):
    """РњРѕРґРµР»СЊ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РЅР°РіСЂР°РґС‹"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    price: Optional[int] = Field(None, ge=1)
    description: Optional[str] = Field(None, max_length=500)
    background_color: Optional[int] = None
    is_message_required: Optional[bool] = None
    max_uses_count: Optional[int] = Field(None, ge=1)
    max_uses_count_per_user: Optional[int] = Field(None, ge=1)
    repair_timeout: Optional[int] = Field(None, ge=0)


class RewardDemandAction(BaseModel):
    """РњРѕРґРµР»СЊ РґР»СЏ РїСЂРёРЅСЏС‚РёСЏ/РѕС‚РєР»РѕРЅРµРЅРёСЏ Р·Р°РїСЂРѕСЃРѕРІ"""
    demand_ids: List[int] = Field(..., min_length=1, description="РЎРїРёСЃРѕРє ID Р·Р°РїСЂРѕСЃРѕРІ")


# === Helper Functions ===

def get_vk_token(user_id: int, db: Session) -> str:
    """
    РџРѕР»СѓС‡РёС‚СЊ VK OAuth С‚РѕРєРµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ С‡РµСЂРµР· СЂРµРїРѕР·РёС‚РѕСЂРёР№
    
    Args:
        user_id: ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        db: Database session
        
    Returns:
        str: Р Р°СЃС€РёС„СЂРѕРІР°РЅРЅС‹Р№ VK С‚РѕРєРµРЅ
        
    Raises:
        HTTPException: Р•СЃР»Рё С‚РѕРєРµРЅ РЅРµ РЅР°Р№РґРµРЅ
    """
    token_repo = UserTokenRepository(db)
    user_token = token_repo.get_by_user_and_platform(user_id, 'vk')
    
    if not user_token or not user_token.access_token:
        raise HTTPException(
            status_code=404,
            detail="VK С‚РѕРєРµРЅ РЅРµ РЅР°Р№РґРµРЅ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїРѕРґРєР»СЋС‡РёС‚Рµ VK Live."
        )
    
    # Р Р°СЃС€РёС„СЂРѕРІР°С‚СЊ С‚РѕРєРµРЅ
    token = user_token.access_token
    if is_token_encrypted(token):
        token = decrypt_token(token)
        
    return token


def get_channel_url(user_id: int, db: Session) -> str:
    """
    РџРѕР»СѓС‡РёС‚СЊ VK channel URL РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ С‡РµСЂРµР· СЂРµРїРѕР·РёС‚РѕСЂРёР№
    
    Args:
        user_id: ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        db: Database session
        
    Returns:
        str: VK channel URL
        
    Raises:
        HTTPException: Р•СЃР»Рё channel URL РЅРµ РЅР°Р№РґРµРЅ
    """
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    
    if not user or not user.vk_channel_name:
        raise HTTPException(
            status_code=404,
            detail="VK РєР°РЅР°Р» РЅРµ РЅР°Р№РґРµРЅ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїРѕРґРєР»СЋС‡РёС‚Рµ VK Live."
        )
        
    return normalize_vk_channel_url(user.vk_channel_name)


# === API Endpoints ===

@router.get("/balance")
async def get_balance(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РџРѕР»СѓС‡РёС‚СЊ Р±Р°Р»Р°РЅСЃ Р±Р°Р»Р»РѕРІ РЅР° РєР°РЅР°Р»Рµ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    GET /v1/channel_point
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            result = await client.get_channel_points_balance(
                token=token,
                channel_url=channel_url
            )
            
        return result['data']
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/rewards")
async def get_rewards(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РЅР°РіСЂР°Рґ Р·Р° Р±Р°Р»Р»С‹
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    GET /v1/channel_point/rewards
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            result = await client.get_channel_rewards(
                token=token,
                channel_url=channel_url
            )
            
        return result['data']
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error getting rewards: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/rewards/manage")
async def get_rewards_manage_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РЅР°РіСЂР°Рґ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - РђРІС‚РѕСЂРёР·Р°С†РёСЏ: РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ
    - Р”РѕСЃС‚СѓРїРЅРѕСЃС‚СЊ: РІР»Р°РґРµР»РµС† РєР°РЅР°Р»Р°
    - Р Р°Р·СЂРµС€РµРЅРёСЏ: channel:points:manage
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    GET /v1/channel_point/rewards/manage_info
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            result = await client.get_rewards_manage_info(
                token=token,
                channel_url=channel_url
            )
            
        return result['data']
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error getting rewards manage info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/rewards")
async def create_reward(
    reward: RewardCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РЎРѕР·РґР°С‚СЊ РЅР°РіСЂР°РґСѓ Р·Р° Р±Р°Р»Р»С‹
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - РђРІС‚РѕСЂРёР·Р°С†РёСЏ: РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ
    - Р”РѕСЃС‚СѓРїРЅРѕСЃС‚СЊ: РІР»Р°РґРµР»РµС† РєР°РЅР°Р»Р°
    - Р Р°Р·СЂРµС€РµРЅРёСЏ: channel:points:manage
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    POST /v1/channel_point/reward/create
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            result = await client.create_reward(
                token=token,
                channel_url=channel_url,
                name=reward.name,
                price=reward.price,
                description=reward.description,
                background_color=reward.background_color,
                is_message_required=reward.is_message_required,
                max_uses_count=reward.max_uses_count,
                max_uses_count_per_user=reward.max_uses_count_per_user,
                repair_timeout=reward.repair_timeout
            )
            
        logger.info(f"Reward created: {result['data']['reward']['id']}")
        return result['data']
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error creating reward: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/rewards/{reward_id}")
async def get_reward_info(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РџРѕР»СѓС‡РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РЅР°РіСЂР°РґРµ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    GET /v1/channel_point/reward/manage_info
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            result = await client.get_reward_manage_info(
                token=token,
                channel_url=channel_url,
                reward_id=reward_id
            )
            
        return result['data']
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error getting reward info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/rewards/{reward_id}")
async def update_reward(
    reward_id: str,
    reward: RewardUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РЅР°РіСЂР°РґСѓ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    POST /v1/channel_point/reward/edit
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        # РЎРѕР±СЂР°С‚СЊ С‚РѕР»СЊРєРѕ Р·Р°РїРѕР»РЅРµРЅРЅС‹Рµ РїРѕР»СЏ
        reward_fields = reward.model_dump(exclude_none=True)
        
        if not reward_fields:
            raise HTTPException(status_code=400, detail="РќРµС‚ РїРѕР»РµР№ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ")
        
        async with VKLiveAPIClient() as client:
            await client.edit_reward(
                token=token,
                channel_url=channel_url,
                reward_id=reward_id,
                **reward_fields
            )
            
        logger.info(f"Reward updated: {reward_id}")
        return {"success": True, "message": "РќР°РіСЂР°РґР° РѕР±РЅРѕРІР»РµРЅР°"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error updating reward: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/rewards/{reward_id}/enable")
async def enable_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Р’РєР»СЋС‡РёС‚СЊ РЅР°РіСЂР°РґСѓ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    POST /v1/channel_point/reward/enable
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            await client.enable_reward(
                token=token,
                channel_url=channel_url,
                reward_id=reward_id
            )
            
        logger.info(f"Reward enabled: {reward_id}")
        return {"success": True, "message": "РќР°РіСЂР°РґР° РІРєР»СЋС‡РµРЅР°"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error enabling reward: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/rewards/{reward_id}/disable")
async def disable_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РћС‚РєР»СЋС‡РёС‚СЊ РЅР°РіСЂР°РґСѓ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    POST /v1/channel_point/reward/disable
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            await client.disable_reward(
                token=token,
                channel_url=channel_url,
                reward_id=reward_id
            )
            
        logger.info(f"Reward disabled: {reward_id}")
        return {"success": True, "message": "РќР°РіСЂР°РґР° РѕС‚РєР»СЋС‡РµРЅР°"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error disabling reward: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/rewards/{reward_id}")
async def delete_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РЈРґР°Р»РёС‚СЊ РЅР°РіСЂР°РґСѓ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    POST /v1/channel_point/reward/delete
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            await client.delete_reward(
                token=token,
                channel_url=channel_url,
                reward_id=reward_id
            )
            
        logger.info(f"Reward deleted: {reward_id}")
        return {"success": True, "message": "РќР°РіСЂР°РґР° СѓРґР°Р»РµРЅР°"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error deleting reward: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/rewards/demands")
async def get_reward_demands(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє Р·Р°РїСЂРѕСЃРѕРІ РЅР°РіСЂР°Рґ
    
    РўСЂРµР±РѕРІР°РЅРёСЏ:
    - РђРІС‚РѕСЂРёР·Р°С†РёСЏ: РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ
    - Р”РѕСЃС‚СѓРїРЅРѕСЃС‚СЊ: РІР»Р°РґРµР»РµС† РєР°РЅР°Р»Р°
    - Р Р°Р·СЂРµС€РµРЅРёСЏ: channel:points:rewards:demands:read
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    GET /v1/channel_point/reward/demands
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            result = await client.get_reward_demands(
                token=token,
                channel_url=channel_url,
                limit=limit,
                offset=offset
            )
            
        return result
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error getting reward demands: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/rewards/demands/accept")
async def accept_reward_demands(
    action: RewardDemandAction,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РџСЂРёРЅСЏС‚СЊ Р·Р°РїСЂРѕСЃС‹ РЅР°РіСЂР°Рґ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    POST /v1/channel_point/reward/demand/accept
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            await client.accept_reward_demands(
                token=token,
                channel_url=channel_url,
                demand_ids=action.demand_ids
            )
            
        logger.info(f"Accepted {len(action.demand_ids)} reward demands")
        return {
            "success": True,
            "message": f"РџСЂРёРЅСЏС‚Рѕ Р·Р°РїСЂРѕСЃРѕРІ: {len(action.demand_ids)}"
        }
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error accepting reward demands: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/rewards/demands/reject")
async def reject_reward_demands(
    action: RewardDemandAction,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    РћС‚РєР»РѕРЅРёС‚СЊ Р·Р°РїСЂРѕСЃС‹ РЅР°РіСЂР°Рґ
    
    Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: docs/vk/РњРµС‚РѕРґС‹_Р‘Р°Р»Р»С‹.md
    POST /v1/channel_point/reward/demand/reject
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        async with VKLiveAPIClient() as client:
            await client.reject_reward_demands(
                token=token,
                channel_url=channel_url,
                demand_ids=action.demand_ids
            )
            
        logger.info(f"Rejected {len(action.demand_ids)} reward demands")
        return {
            "success": True,
            "message": f"РћС‚РєР»РѕРЅРµРЅРѕ Р·Р°РїСЂРѕСЃРѕРІ: {len(action.demand_ids)}"
        }
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error rejecting reward demands: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
