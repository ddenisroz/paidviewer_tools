# features/drops/drops_rewards_api.py
"""
Drops Rewards API endpoints - CRUD for lootbox rewards.
Clean Architecture: uses DropsRewardRepository for data access.
"""
import logging
import re
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.database import get_db
from auth.auth import get_current_user, get_current_user_optional
from repositories.drops_reward_repository import DropsRewardRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drops", tags=["drops"])


# === PYDANTIC MODELS ===

class DropsRewardCreate(BaseModel):
    """Создание награды в Drops"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    quality_id: int = Field(..., ge=1)
    weight: int = Field(100, ge=1, le=1000)
    reward_type: str = Field(..., pattern="^(points|voice|command|custom)$")
    reward_value: str = Field(default="", max_length=1000)
    image_url: Optional[str] = Field(None, max_length=1000)
    sound_volume: float = Field(1.0, ge=0.0, le=2.0)
    is_active: bool = True


class DropsRewardUpdate(BaseModel):
    """Обновление награды в Drops"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    quality_id: Optional[int] = Field(None, ge=1)
    weight: Optional[int] = Field(None, ge=1, le=1000)
    reward_type: Optional[str] = Field(None, pattern="^(points|voice|command|custom)$")
    reward_value: Optional[str] = Field(None, max_length=1000)
    image_url: Optional[str] = Field(None, max_length=1000)
    sound_volume: Optional[float] = Field(None, ge=0.0, le=2.0)
    is_active: Optional[bool] = None


# === UTILITY FUNCTIONS ===

def sanitize_html(text: str) -> str:
    """Очищает HTML теги из текста"""
    if not text:
        return text
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text)


def _reward_to_dict(reward, quality_info: dict) -> dict:
    """Convert reward model to dict for response."""
    return {
        "id": reward.id,
        "name": reward.name,
        "description": reward.description,
        "quality": quality_info,
        "weight": reward.weight,
        "reward_type": reward.reward_type,
        "reward_value": reward.reward_value,
        "image_url": reward.image_url,
        "sound_file": reward.sound_file,
        "sound_volume": reward.sound_volume,
        "is_active": reward.is_active,
        "created_at": reward.created_at,
        "updated_at": reward.updated_at
    }


# === API ENDPOINTS ===

@router.get("/rewards/{channel_name}")
async def get_drops_rewards(
    channel_name: str,
    platform: str = "twitch",
    quality: Optional[str] = None,
    widget_token: Optional[str] = None,
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получает награды лутбоксов для канала

    ВАЖНО: Награды ОБЩИЕ для всех платформ! Параметр platform игнорируется.
    """
    try:
        repo = DropsRewardRepository(db)
        user_id = None
        
        if current_user and current_user.get("id"):
            user_id = current_user["id"]
        elif widget_token:
            config = repo.get_config_by_token(widget_token)
            if config and config.channel_name == channel_name:
                user_id = config.user_id
            else:
                raise HTTPException(status_code=403, detail="Invalid widget token or channel mismatch")
        else:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Get quality ID if filtering by name
        quality_id = None
        if quality:
            quality_obj = repo.get_quality_by_name(quality)
            if quality_obj:
                quality_id = quality_obj.id

        rewards = repo.get_by_user_and_channel(user_id, channel_name, quality_id)

        # Batch fetch qualities
        quality_ids = {reward.quality_id for reward in rewards if reward.quality_id}
        qualities = repo.get_qualities_by_ids(list(quality_ids))

        return {
            "success": True,
            "data": [_reward_to_dict(r, qualities.get(r.quality_id, {})) for r in rewards]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting drops rewards: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения наград лутбоксов")


@router.post("/rewards/{channel_name}")
async def create_drops_reward(
    channel_name: str,
    reward_data: DropsRewardCreate,
    platform: str = "twitch",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создает новую награду в лутбоксе

    ВАЖНО: Награда будет ОБЩЕЙ для всех платформ.
    """
    try:
        repo = DropsRewardRepository(db)
        
        quality = repo.get_quality_by_id(reward_data.quality_id)
        if not quality:
            available_qualities = repo.get_all_qualities()
            available_ids = [q.id for q in available_qualities]
            logger.warning(f"Quality with id {reward_data.quality_id} not found. Available: {available_ids}")
            raise HTTPException(status_code=400, detail=f"Качество с ID {reward_data.quality_id} не найдено")

        reward = repo.create(
            user_id=current_user["id"],
            channel_name=channel_name,
            platform=platform,
            name=sanitize_html(reward_data.name),
            description=sanitize_html(reward_data.description) if reward_data.description else None,
            quality_id=reward_data.quality_id,
            weight=reward_data.weight,
            reward_type=reward_data.reward_type,
            reward_value=reward_data.reward_value,
            image_url=reward_data.image_url,
            sound_volume=reward_data.sound_volume,
            is_active=reward_data.is_active
        )

        # WebSocket notification
        try:
            from services.memory_websocket_manager import get_memory_websocket_manager
            user_id = current_user.get('id')
            if user_id and user_id != -1:
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": f"drops_rewards_{channel_name}",
                    "reason": "drops_reward_created"
                }
                await get_memory_websocket_manager().send_to_user(user_id, cache_invalidation_event)
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification: {ws_error}")

        return {
            "success": True,
            "message": "Награда создана",
            "data": {
                "id": reward.id,
                "name": reward.name,
                "quality": quality.name,
                "reward_type": reward.reward_type,
                "created_at": reward.created_at
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating drops reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания награды")


@router.put("/rewards/{reward_id}")
async def update_drops_reward(
    reward_id: int,
    reward_data: DropsRewardUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновляет награду в лутбоксе"""
    try:
        repo = DropsRewardRepository(db)
        reward = repo.get_by_id_and_user(reward_id, current_user["id"])

        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")

        # Sanitize HTML in text fields
        update_data = reward_data.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"]:
            update_data["name"] = sanitize_html(update_data["name"])
        if "description" in update_data and update_data["description"]:
            update_data["description"] = sanitize_html(update_data["description"])

        reward = repo.update(reward, update_data)

        # WebSocket notification
        try:
            from services.memory_websocket_manager import get_memory_websocket_manager
            user_id = current_user.get('id')
            if user_id and user_id != -1:
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": f"drops_rewards_{reward.channel_name}",
                    "reason": "drops_reward_updated"
                }
                await get_memory_websocket_manager().send_to_user(user_id, cache_invalidation_event)
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification: {ws_error}")

        return {
            "success": True,
            "message": "Награда обновлена",
            "data": {
                "id": reward.id,
                "name": reward.name,
                "updated_at": reward.updated_at
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating drops reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления награды")


@router.delete("/rewards/{reward_id}")
async def delete_drops_reward(
    reward_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаляет награду из лутбокса"""
    try:
        repo = DropsRewardRepository(db)
        reward = repo.get_by_id_and_user(reward_id, current_user["id"])

        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")

        channel_name = repo.delete(reward)

        # WebSocket notification
        try:
            from services.memory_websocket_manager import get_memory_websocket_manager
            user_id = current_user.get('id')
            if user_id and user_id != -1:
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": f"drops_rewards_{channel_name}",
                    "reason": "drops_reward_deleted"
                }
                await get_memory_websocket_manager().send_to_user(user_id, cache_invalidation_event)
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification: {ws_error}")

        return {
            "success": True,
            "message": "Награда удалена"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting drops reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления награды")


@router.post("/rewards/{reward_id}/image")
async def upload_reward_image(
    reward_id: int,
    image_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Загружает изображение для награды"""
    try:
        import os

        repo = DropsRewardRepository(db)
        reward = repo.get_by_id_and_user(reward_id, current_user["id"])

        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")

        if not image_file.content_type or not image_file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Файл должен быть изображением")

        upload_dir = f"uploads/drops/{current_user['id']}/images"
        os.makedirs(upload_dir, exist_ok=True)

        file_extension = os.path.splitext(image_file.filename)[1] or '.png'
        filename = f"reward_{reward_id}_{int(time.time())}{file_extension}"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as buffer:
            content = await image_file.read()
            buffer.write(content)

        image_url = f"/static/uploads/drops/{current_user['id']}/images/{filename}"
        repo.update_image(reward, image_url)

        return {
            "success": True,
            "message": "Изображение загружено",
            "data": {
                "image_url": image_url,
                "filename": filename
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading reward image: {e}")
        raise HTTPException(status_code=500, detail="Ошибка загрузки изображения")


@router.post("/rewards/{reward_id}/sound")
async def upload_reward_sound(
    reward_id: int,
    sound_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Загружает звук для награды"""
    try:
        import os

        repo = DropsRewardRepository(db)
        reward = repo.get_by_id_and_user(reward_id, current_user["id"])

        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")

        from validators.file_validators import validate_sound_file
        validate_sound_file(sound_file)

        upload_dir = f"uploads/sounds/{current_user['id']}"
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"reward_{reward_id}_{sound_file.filename}"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as buffer:
            content = await sound_file.read()
            buffer.write(content)

        repo.update_sound(reward, file_path)

        return {
            "success": True,
            "message": "Звук загружен",
            "data": {
                "sound_file": file_path,
                "filename": filename
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading reward sound: {e}")
        raise HTTPException(status_code=500, detail="Ошибка загрузки звука")

