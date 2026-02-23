"""Text cleaned."""
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
router = APIRouter(prefix='/api/vk/channel_points', tags=['vk-channel-points'])

class RewardCreate(BaseModel):
    """Text cleaned."""
    name: str = Field(..., min_length=1, max_length=100, description='Description.')
    price: int = Field(..., ge=1, description='Цена в баллах')
    description: str = Field(default='', max_length=500, description='Description.')
    background_color: int = Field(default=0, description='Description.')
    is_message_required: bool = Field(default=False, description='Description.')
    max_uses_count: Optional[int] = Field(default=None, ge=1, description='Description.')
    max_uses_count_per_user: Optional[int] = Field(default=None, ge=1, description='Description.')
    repair_timeout: Optional[int] = Field(default=None, ge=0, description='Description.')

class RewardUpdate(BaseModel):
    """Text cleaned."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    price: Optional[int] = Field(None, ge=1)
    description: Optional[str] = Field(None, max_length=500)
    background_color: Optional[int] = None
    is_message_required: Optional[bool] = None
    max_uses_count: Optional[int] = Field(None, ge=1)
    max_uses_count_per_user: Optional[int] = Field(None, ge=1)
    repair_timeout: Optional[int] = Field(None, ge=0)

class RewardDemandAction(BaseModel):
    """Text cleaned."""
    demand_ids: List[int] = Field(..., min_length=1, description='Description.')

def get_vk_token(user_id: int, db: Session) -> str:
    """Text cleaned."""
    token_repo = UserTokenRepository(db)
    user_token = token_repo.get_by_user_and_platform(user_id, 'vk')
    if not user_token or not user_token.access_token:
        raise HTTPException(status_code=404, detail='Operation failed.')
    token = user_token.access_token
    if is_token_encrypted(token):
        token = decrypt_token(token)
    return token

def get_channel_url(user_id: int, db: Session) -> str:
    """Text cleaned."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user or not user.vk_channel_name:
        raise HTTPException(status_code=404, detail='Operation failed.')
    return normalize_vk_channel_url(user.vk_channel_name)

@router.get('/balance')
async def get_balance(current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            result = await client.get_channel_points_balance(token=token, channel_url=channel_url)
        return result['data']
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting balance')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.get('/rewards')
async def get_rewards(current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            result = await client.get_channel_rewards(token=token, channel_url=channel_url)
        return result['data']
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting rewards')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.get('/rewards/manage')
async def get_rewards_manage_info(current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            result = await client.get_rewards_manage_info(token=token, channel_url=channel_url)
        return result['data']
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting rewards manage info')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/rewards')
async def create_reward(reward: RewardCreate, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            result = await client.create_reward(token=token, channel_url=channel_url, name=reward.name, price=reward.price, description=reward.description, background_color=reward.background_color, is_message_required=reward.is_message_required, max_uses_count=reward.max_uses_count, max_uses_count_per_user=reward.max_uses_count_per_user, repair_timeout=reward.repair_timeout)
        logger.info(f"Reward created: {result['data']['reward']['id']}")
        return result['data']
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error creating reward')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.get('/rewards/{reward_id}')
async def get_reward_info(reward_id: str, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            result = await client.get_reward_manage_info(token=token, channel_url=channel_url, reward_id=reward_id)
        return result['data']
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting reward info')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.put('/rewards/{reward_id}')
async def update_reward(reward_id: str, reward: RewardUpdate, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        reward_fields = reward.model_dump(exclude_none=True)
        if not reward_fields:
            raise HTTPException(status_code=400, detail='Operation failed.')
        async with VKLiveAPIClient() as client:
            await client.edit_reward(token=token, channel_url=channel_url, reward_id=reward_id, **reward_fields)
        logger.info(f'Reward updated: {reward_id}')
        return {'success': True, 'message': 'Operation completed.'}
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error updating reward')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/rewards/{reward_id}/enable')
async def enable_reward(reward_id: str, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            await client.enable_reward(token=token, channel_url=channel_url, reward_id=reward_id)
        logger.info(f'Reward enabled: {reward_id}')
        return {'success': True, 'message': 'Operation completed.'}
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error enabling reward')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/rewards/{reward_id}/disable')
async def disable_reward(reward_id: str, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            await client.disable_reward(token=token, channel_url=channel_url, reward_id=reward_id)
        logger.info(f'Reward disabled: {reward_id}')
        return {'success': True, 'message': 'Operation completed.'}
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error disabling reward')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.delete('/rewards/{reward_id}')
async def delete_reward(reward_id: str, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            await client.delete_reward(token=token, channel_url=channel_url, reward_id=reward_id)
        logger.info(f'Reward deleted: {reward_id}')
        return {'success': True, 'message': 'Operation completed.'}
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error deleting reward')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.get('/rewards/demands')
async def get_reward_demands(limit: int=50, offset: int=0, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            result = await client.get_reward_demands(token=token, channel_url=channel_url, limit=limit, offset=offset)
        return result
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error getting reward demands')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/rewards/demands/accept')
async def accept_reward_demands(action: RewardDemandAction, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            await client.accept_reward_demands(token=token, channel_url=channel_url, demand_ids=action.demand_ids)
        logger.info(f'Accepted {len(action.demand_ids)} reward demands')
        return {'success': True, 'message': f'Operation completed.{len(action.demand_ids)}'}
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error accepting reward demands')
        raise HTTPException(status_code=500, detail='Internal server error')

@router.post('/rewards/demands/reject')
async def reject_reward_demands(action: RewardDemandAction, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db)):
    """Text cleaned."""
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        async with VKLiveAPIClient() as client:
            await client.reject_reward_demands(token=token, channel_url=channel_url, demand_ids=action.demand_ids)
        logger.info(f'Rejected {len(action.demand_ids)} reward demands')
        return {'success': True, 'message': f'Operation completed.{len(action.demand_ids)}'}
    except VKAPIError as e:
        logger.error(f'VK API error: {e.error_message}')
        raise HTTPException(status_code=400, detail='VK API request failed')
    except HTTPException:
        raise
    except Exception:
        logger.exception('Error rejecting reward demands')
        raise HTTPException(status_code=500, detail='Internal server error')
