"""
API endpoints для управления наградами VK Live Channel Points

Документация: docs/vk/Методы_Баллы.md
Автор: AI Assistant
Дата: 27 декабря 2025
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
    """Модель для создания награды"""
    name: str = Field(..., min_length=1, max_length=100, description="Название награды")
    price: int = Field(..., ge=1, description="Цена в баллах")
    description: str = Field(default="", max_length=500, description="Описание награды")
    background_color: int = Field(default=0, description="Цвет фона (число)")
    is_message_required: bool = Field(default=False, description="Требуется ли сообщение")
    max_uses_count: Optional[int] = Field(default=None, ge=1, description="Максимум использований")
    max_uses_count_per_user: Optional[int] = Field(default=None, ge=1, description="Максимум на пользователя")
    repair_timeout: Optional[int] = Field(default=None, ge=0, description="Время перезарядки (секунды)")


class RewardUpdate(BaseModel):
    """Модель для обновления награды"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    price: Optional[int] = Field(None, ge=1)
    description: Optional[str] = Field(None, max_length=500)
    background_color: Optional[int] = None
    is_message_required: Optional[bool] = None
    max_uses_count: Optional[int] = Field(None, ge=1)
    max_uses_count_per_user: Optional[int] = Field(None, ge=1)
    repair_timeout: Optional[int] = Field(None, ge=0)


class RewardDemandAction(BaseModel):
    """Модель для принятия/отклонения запросов"""
    demand_ids: List[int] = Field(..., min_length=1, description="Список ID запросов")


# === Helper Functions ===

def get_vk_token(user_id: int, db: Session) -> str:
    """
    Получить VK OAuth токен пользователя через репозиторий
    
    Args:
        user_id: ID пользователя
        db: Database session
        
    Returns:
        str: Расшифрованный VK токен
        
    Raises:
        HTTPException: Если токен не найден
    """
    token_repo = UserTokenRepository(db)
    user_token = token_repo.get_by_user_and_platform(user_id, 'vk')
    
    if not user_token or not user_token.access_token:
        raise HTTPException(
            status_code=404,
            detail="VK токен не найден. Пожалуйста, подключите VK Live."
        )
    
    # Расшифровать токен
    token = user_token.access_token
    if is_token_encrypted(token):
        token = decrypt_token(token)
        
    return token


def get_channel_url(user_id: int, db: Session) -> str:
    """
    Получить VK channel URL пользователя через репозиторий
    
    Args:
        user_id: ID пользователя
        db: Database session
        
    Returns:
        str: VK channel URL
        
    Raises:
        HTTPException: Если channel URL не найден
    """
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    
    if not user or not user.vk_channel_name:
        raise HTTPException(
            status_code=404,
            detail="VK канал не найден. Пожалуйста, подключите VK Live."
        )
        
    return normalize_vk_channel_url(user.vk_channel_name)


# === API Endpoints ===

@router.get("/balance")
async def get_balance(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить баланс баллов на канале
    
    Документация: docs/vk/Методы_Баллы.md
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rewards")
async def get_rewards(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить список наград за баллы
    
    Документация: docs/vk/Методы_Баллы.md
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rewards/manage")
async def get_rewards_manage_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить список наград для управления
    
    Требования:
    - Авторизация: пользователь
    - Доступность: владелец канала
    - Разрешения: channel:points:manage
    
    Документация: docs/vk/Методы_Баллы.md
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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rewards")
async def create_reward(
    reward: RewardCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Создать награду за баллы
    
    Требования:
    - Авторизация: пользователь
    - Доступность: владелец канала
    - Разрешения: channel:points:manage
    
    Документация: docs/vk/Методы_Баллы.md
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rewards/{reward_id}")
async def get_reward_info(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить информацию о награде для управления
    
    Документация: docs/vk/Методы_Баллы.md
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
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/rewards/{reward_id}")
async def update_reward(
    reward_id: str,
    reward: RewardUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Редактировать награду
    
    Документация: docs/vk/Методы_Баллы.md
    POST /v1/channel_point/reward/edit
    """
    try:
        token = get_vk_token(current_user['id'], db)
        channel_url = get_channel_url(current_user['id'], db)
        
        # Собрать только заполненные поля
        reward_fields = reward.model_dump(exclude_none=True)
        
        if not reward_fields:
            raise HTTPException(status_code=400, detail="Нет полей для обновления")
        
        async with VKLiveAPIClient() as client:
            await client.edit_reward(
                token=token,
                channel_url=channel_url,
                reward_id=reward_id,
                **reward_fields
            )
            
        logger.info(f"Reward updated: {reward_id}")
        return {"success": True, "message": "Награда обновлена"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error updating reward: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rewards/{reward_id}/enable")
async def enable_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Включить награду
    
    Документация: docs/vk/Методы_Баллы.md
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
        return {"success": True, "message": "Награда включена"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error enabling reward: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rewards/{reward_id}/disable")
async def disable_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Отключить награду
    
    Документация: docs/vk/Методы_Баллы.md
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
        return {"success": True, "message": "Награда отключена"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error disabling reward: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rewards/{reward_id}")
async def delete_reward(
    reward_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Удалить награду
    
    Документация: docs/vk/Методы_Баллы.md
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
        return {"success": True, "message": "Награда удалена"}
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error deleting reward: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rewards/demands")
async def get_reward_demands(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить список запросов наград
    
    Требования:
    - Авторизация: пользователь
    - Доступность: владелец канала
    - Разрешения: channel:points:rewards:demands:read
    
    Документация: docs/vk/Методы_Баллы.md
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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rewards/demands/accept")
async def accept_reward_demands(
    action: RewardDemandAction,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Принять запросы наград
    
    Документация: docs/vk/Методы_Баллы.md
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
            "message": f"Принято запросов: {len(action.demand_ids)}"
        }
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error accepting reward demands: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rewards/demands/reject")
async def reject_reward_demands(
    action: RewardDemandAction,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Отклонить запросы наград
    
    Документация: docs/vk/Методы_Баллы.md
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
            "message": f"Отклонено запросов: {len(action.demand_ids)}"
        }
        
    except VKAPIError as e:
        logger.error(f"VK API error: {e.error_message}")
        raise HTTPException(status_code=400, detail=e.error_message)
    except Exception as e:
        logger.error(f"Error rejecting reward demands: {e}")
        raise HTTPException(status_code=500, detail=str(e))
