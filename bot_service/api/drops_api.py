# api/drops_api.py
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
import random
import time

from core.database import get_db, DropsConfig, DropsReward, DropsQuality, DropsType, UserStreak, DropsHistory, MythicalDropsSession, DonationAlert, UserToken
from auth.auth import get_current_user
from core.datetime_utils import utcnow_naive
from utils.enhanced_logger import log_request, log_response, drops_logger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drops", tags=["drops"])

# === PYDANTIC MODELS ===

class DropsConfigCreate(BaseModel):
    """Создание конфигурации Drops"""
    channel_name: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(..., pattern="^(twitch|vk)$")
    
    # Стрик настройки
    streak_enabled: bool = True
    streak_days_common: int = Field(1, ge=1, le=365)
    streak_days_rare: int = Field(3, ge=1, le=365)
    streak_days_epic: int = Field(7, ge=1, le=365)
    streak_days_legendary: int = Field(14, ge=1, le=365)
    streak_messages_required: int = Field(5, ge=1, le=100)
    
    # Донат настройки
    donation_enabled: bool = True
    donation_amount_common: float = Field(50.0, ge=0.01, le=1000000)
    donation_amount_rare: float = Field(100.0, ge=0.01, le=1000000)
    donation_amount_epic: float = Field(500.0, ge=0.01, le=1000000)
    donation_amount_legendary: float = Field(1000.0, ge=0.01, le=1000000)
    
    # Мифический лутбокс
    mythical_enabled: bool = True
    mythical_min_interval_hours: int = Field(2, ge=0, le=24)
    mythical_max_interval_hours: int = Field(8, ge=0, le=24)
    mythical_window_duration_minutes: int = Field(5, ge=1, le=60)
    mythical_donation_amount: float = Field(2000.0, ge=0.01, le=1000000)

class DropsConfigUpdate(BaseModel):
    """Обновление конфигурации Drops"""
    streak_enabled: Optional[bool] = None
    streak_days_common: Optional[int] = Field(None, ge=1, le=365)
    streak_days_rare: Optional[int] = Field(None, ge=1, le=365)
    streak_days_epic: Optional[int] = Field(None, ge=1, le=365)
    streak_days_legendary: Optional[int] = Field(None, ge=1, le=365)
    streak_messages_required: Optional[int] = Field(None, ge=1, le=100)
    
    donation_enabled: Optional[bool] = None
    donation_amount_common: Optional[float] = Field(None, ge=0.01, le=1000000)
    donation_amount_rare: Optional[float] = Field(None, ge=0.01, le=1000000)
    donation_amount_epic: Optional[float] = Field(None, ge=0.01, le=1000000)
    donation_amount_legendary: Optional[float] = Field(None, ge=0.01, le=1000000)
    
    mythical_enabled: Optional[bool] = None
    mythical_min_interval_hours: Optional[int] = Field(None, ge=0, le=24)
    mythical_max_interval_hours: Optional[int] = Field(None, ge=0, le=24)
    mythical_window_duration_minutes: Optional[int] = Field(None, ge=1, le=60)
    mythical_donation_amount: Optional[float] = Field(None, ge=0.01, le=1000000)

class DropsRewardCreate(BaseModel):
    """Создание награды в Drops"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    quality_id: int = Field(..., ge=1)
    weight: int = Field(100, ge=1, le=1000)
    reward_type: str = Field(..., pattern="^(points|voice|command|custom)$")
    reward_value: str = Field(..., min_length=1, max_length=1000)
    sound_volume: float = Field(1.0, ge=0.0, le=2.0)
    is_active: bool = True

class DropsRewardUpdate(BaseModel):
    """Обновление награды в Drops"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    quality_id: Optional[int] = Field(None, ge=1)
    weight: Optional[int] = Field(None, ge=1, le=1000)
    reward_type: Optional[str] = Field(None, pattern="^(points|voice|command|custom)$")
    reward_value: Optional[str] = Field(None, min_length=1, max_length=1000)
    sound_volume: Optional[float] = Field(None, ge=0.0, le=2.0)
    is_active: Optional[bool] = None

class DropsOpenRequest(BaseModel):
    """Запрос на получение Drops"""
    drops_type: str = Field(..., pattern="^(streak|donation|mythical)$")
    viewer_id: str = Field(..., min_length=1, max_length=100)
    viewer_name: str = Field(..., min_length=1, max_length=100)
    donation_amount: Optional[float] = Field(None, ge=0.01)
    streak_days: Optional[int] = Field(None, ge=1)
    messages_count: Optional[int] = Field(None, ge=0)

# === UTILITY FUNCTIONS ===

def sanitize_html(text: str) -> str:
    """Очищает HTML теги из текста"""
    import re
    if not text:
        return text
    # Удаляем HTML теги
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text)

def get_drops_quality_by_days(days: int, config: DropsConfig) -> str:
    """Определяет качество Drops по дням стрика"""
    if days >= config.streak_days_legendary:
        return "Legendary"
    elif days >= config.streak_days_epic:
        return "Epic"
    elif days >= config.streak_days_rare:
        return "Rare"
    else:
        return "Common"

def get_drops_quality_by_donation(amount: float, config: DropsConfig) -> str:
    """Определяет качество Drops по сумме доната"""
    if amount >= config.donation_amount_legendary:
        return "Legendary"
    elif amount >= config.donation_amount_epic:
        return "Epic"
    elif amount >= config.donation_amount_rare:
        return "Rare"
    else:
        return "Common"

# === API ENDPOINTS ===

@router.get("/config/{channel_name}")
async def get_drops_config(
    channel_name: str,
    platform: str = "twitch",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает конфигурацию Drops для канала"""
    try:
        config = db.query(DropsConfig).filter(
            DropsConfig.user_id == current_user["id"],
            DropsConfig.channel_name == channel_name,
            DropsConfig.platform == platform
        ).first()
        
        if not config:
            # Создаем конфигурацию по умолчанию
            config = DropsConfig(
                user_id=current_user["id"],
                channel_name=channel_name,
                platform=platform
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        
        return {
            "success": True,
            "data": {
                "id": config.id,
                "channel_name": config.channel_name,
                "platform": config.platform,
                "streak_enabled": config.streak_enabled,
                "streak_days_common": config.streak_days_common,
                "streak_days_rare": config.streak_days_rare,
                "streak_days_epic": config.streak_days_epic,
                "streak_days_legendary": config.streak_days_legendary,
                "streak_messages_required": config.streak_messages_required,
                "donation_enabled": config.donation_enabled,
                "donation_amount_common": config.donation_amount_common,
                "donation_amount_rare": config.donation_amount_rare,
                "donation_amount_epic": config.donation_amount_epic,
                "donation_amount_legendary": config.donation_amount_legendary,
                "mythical_enabled": config.mythical_enabled,
                "mythical_min_interval_hours": config.mythical_min_interval_hours,
                "mythical_max_interval_hours": config.mythical_max_interval_hours,
                "mythical_window_duration_minutes": config.mythical_window_duration_minutes,
                "mythical_donation_amount": config.mythical_donation_amount,
                "mythical_last_appeared": config.mythical_last_appeared,
                "created_at": config.created_at,
                "updated_at": config.updated_at
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting drops config: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения конфигурации Drops")

@router.put("/config/{channel_name}")
async def update_drops_config(
    channel_name: str,
    config_data: DropsConfigUpdate,
    platform: str = "twitch",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновляет конфигурацию лутбоксов для канала"""
    try:
        config = db.query(DropsConfig).filter(
            DropsConfig.user_id == current_user["id"],
            DropsConfig.channel_name == channel_name,
            DropsConfig.platform == platform
        ).first()
        
        if not config:
            raise HTTPException(status_code=404, detail="Конфигурация не найдена")
        
        # Обновляем только переданные поля
        update_data = config_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(config, field, value)
        
        config.updated_at = utcnow_naive()
        db.commit()
        
        return {
            "success": True,
            "message": "Конфигурация лутбоксов обновлена",
            "data": {
                "id": config.id,
                "channel_name": config.channel_name,
                "platform": config.platform,
                "updated_at": config.updated_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating drops config: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления конфигурации лутбоксов")

@router.get("/rewards/{channel_name}")
async def get_drops_rewards(
    channel_name: str,
    platform: str = "twitch",
    quality: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает награды лутбоксов для канала"""
    try:
        query = db.query(DropsReward).filter(
            DropsReward.user_id == current_user["id"],
            DropsReward.channel_name == channel_name,
            DropsReward.platform == platform
        )
        
        if quality:
            # Фильтруем по качеству
            quality_obj = db.query(DropsQuality).filter(DropsQuality.name == quality).first()
            if quality_obj:
                query = query.filter(DropsReward.quality_id == quality_obj.id)
        
        rewards = query.all()
        
        # Получаем информацию о качествах
        qualities = {q.id: {"name": q.name, "color": q.color} for q in db.query(DropsQuality).all()}
        
        return {
            "success": True,
            "data": [
                {
                    "id": reward.id,
                    "name": reward.name,
                    "description": reward.description,
                    "quality": qualities.get(reward.quality_id, {}),
                    "weight": reward.weight,
                    "reward_type": reward.reward_type,
                    "reward_value": reward.reward_value,
                    "sound_file": reward.sound_file,
                    "sound_volume": reward.sound_volume,
                    "is_active": reward.is_active,
                    "created_at": reward.created_at,
                    "updated_at": reward.updated_at
                }
                for reward in rewards
            ]
        }
        
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
    """Создает новую награду в лутбоксе"""
    try:
        # Проверяем существование качества
        quality = db.query(DropsQuality).filter(DropsQuality.id == reward_data.quality_id).first()
        if not quality:
            raise HTTPException(status_code=400, detail="Качество не найдено")
        
        # Санитизируем входные данные
        reward_data.name = sanitize_html(reward_data.name)
        if reward_data.description:
            reward_data.description = sanitize_html(reward_data.description)
        
        reward = DropsReward(
            user_id=current_user["id"],
            channel_name=channel_name,
            platform=platform,
            name=reward_data.name,
            description=reward_data.description,
            quality_id=reward_data.quality_id,
            weight=reward_data.weight,
            reward_type=reward_data.reward_type,
            reward_value=reward_data.reward_value,
            sound_volume=reward_data.sound_volume,
            is_active=reward_data.is_active
        )
        
        db.add(reward)
        db.commit()
        db.refresh(reward)
        
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
        reward = db.query(DropsReward).filter(
            DropsReward.id == reward_id,
            DropsReward.user_id == current_user["id"]
        ).first()
        
        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")
        
        # Обновляем только переданные поля
        update_data = reward_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field in ["name", "description"] and value:
                value = sanitize_html(value)
            setattr(reward, field, value)
        
        reward.updated_at = utcnow_naive()
        db.commit()
        
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
        reward = db.query(DropsReward).filter(
            DropsReward.id == reward_id,
            DropsReward.user_id == current_user["id"]
        ).first()
        
        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")
        
        db.delete(reward)
        db.commit()
        
        return {
            "success": True,
            "message": "Награда удалена"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting drops reward: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления награды")

@router.post("/rewards/{reward_id}/sound")
async def upload_reward_sound(
    reward_id: int,
    sound_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Загружает звук для награды"""
    try:
        reward = db.query(DropsReward).filter(
            DropsReward.id == reward_id,
            DropsReward.user_id == current_user["id"]
        ).first()
        
        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")
        
        # Проверяем тип файла
        if not sound_file.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="Файл должен быть аудио")
        
        # Сохраняем файл
        import os
        upload_dir = f"uploads/sounds/{current_user['id']}"
        os.makedirs(upload_dir, exist_ok=True)
        
        filename = f"reward_{reward_id}_{sound_file.filename}"
        file_path = os.path.join(upload_dir, filename)
        
        with open(file_path, "wb") as buffer:
            content = await sound_file.read()
            buffer.write(content)
        
        # Обновляем путь к файлу в БД
        reward.sound_file = file_path
        reward.updated_at = utcnow_naive()
        db.commit()
        
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

@router.get("/qualities")
async def get_drops_qualities(
    db: Session = Depends(get_db)
):
    """Получает список качеств лутбоксов"""
    try:
        qualities = db.query(DropsQuality).all()
        
        return {
            "success": True,
            "data": [
                {
                    "id": quality.id,
                    "name": quality.name,
                    "color": quality.color,
                    "weight": quality.weight
                }
                for quality in qualities
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting drops qualities: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения качеств лутбоксов")

@router.get("/history/{channel_name}")
async def get_drops_history(
    channel_name: str,
    platform: str = "twitch",
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает историю лутбоксов для канала"""
    try:
        history = db.query(DropsHistory).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        ).order_by(DropsHistory.created_at.desc()).offset(offset).limit(limit).all()
        
        # Получаем информацию о качествах
        qualities = {q.id: {"name": q.name, "color": q.color} for q in db.query(DropsQuality).all()}
        
        return {
            "success": True,
            "data": [
                {
                    "id": entry.id,
                    "viewer_name": entry.viewer_name,
                    "drops_type": entry.drops_type,
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
        
    except Exception as e:
        logger.error(f"Error getting drops history: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения истории лутбоксов")

@router.post("/open")
async def open_drops(
    request: DropsOpenRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Открывает лутбокс для зрителя"""
    try:
        from services.drops_service import DropsService
        drops_service = DropsService(db)
        
        # Получаем конфигурацию для канала (используем первый доступный канал)
        config = db.query(DropsConfig).filter(
            DropsConfig.user_id == current_user["id"]
        ).first()
        
        if not config:
            raise HTTPException(status_code=404, detail="Конфигурация Drops не найдена")
        
        result = None
        
        if request.drops_type == "streak":
            result = drops_service.process_streak_drops(
                current_user["id"], config.channel_name, config.platform,
                request.viewer_id, request.viewer_name
            )
        elif request.drops_type == "donation":
            result = drops_service.process_donation_drops(
                current_user["id"], config.channel_name, config.platform,
                request.viewer_id, request.viewer_name, request.donation_amount
            )
        elif request.drops_type == "mythical":
            result = drops_service.process_mythical_drops(
                current_user["id"], config.channel_name, config.platform,
                request.viewer_id, request.viewer_name
            )
        
        if result:
            return {
                "success": True,
                "data": result
            }
        else:
            return {
                "success": False,
                "message": "Лутбокс не доступен"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error opening drops: {e}")
        raise HTTPException(status_code=500, detail="Ошибка открытия лутбокса")

@router.get("/stats/{channel_name}")
async def get_drops_stats(
    channel_name: str,
    platform: str = "twitch",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает статистику Drops для канала"""
    try:
        # Общая статистика
        total_drops = db.query(DropsHistory).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        ).count()
        
        # Статистика по типам
        streak_drops = db.query(DropsHistory).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform,
            DropsHistory.drops_type == "streak"
        ).count()
        
        donation_drops = db.query(DropsHistory).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform,
            DropsHistory.drops_type == "donation"
        ).count()
        
        mythical_drops = db.query(DropsHistory).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform,
            DropsHistory.drops_type == "mythical"
        ).count()
        
        # Топ зрителей
        top_viewers = db.query(
            DropsHistory.viewer_name,
            db.func.count(DropsHistory.id).label('drops_count')
        ).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        ).group_by(DropsHistory.viewer_name).order_by(
            db.func.count(DropsHistory.id).desc()
        ).limit(10).all()
        
        return {
            "success": True,
            "data": {
                "total_drops": total_drops,
                "streak_drops": streak_drops,
                "donation_drops": donation_drops,
                "mythical_drops": mythical_drops,
                "top_viewers": [
                    {"viewer_name": viewer, "drops_count": count}
                    for viewer, count in top_viewers
                ]
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting drops stats: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения статистики Drops")

# === TRIGGERS API (STUB) ===
@router.get("/triggers")
async def get_drops_triggers(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает список триггеров Drops (stub)"""
    try:
        logger.info(f"📦 [DROPS] Getting triggers for user {current_user.get('id')}")
        # Возвращаем пустой список триггеров - функция в разработке
        return {
            "success": True,
            "triggers": []
        }
    except Exception as e:
        logger.error(f"❌ [DROPS] Error getting triggers: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения триггеров")

@router.post("/triggers")
async def create_drops_trigger(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создает новый триггер Drops (stub)"""
    try:
        logger.info(f"📦 [DROPS] Creating trigger for user {current_user.get('id')}")
        return {
            "success": True,
            "message": "Триггер будет создан",
            "trigger_id": 1
        }
    except Exception as e:
        logger.error(f"❌ [DROPS] Error creating trigger: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания триггера")

@router.put("/triggers/{trigger_id}")
async def update_drops_trigger(
    trigger_id: int,
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновляет триггер Drops (stub)"""
    try:
        logger.info(f"📦 [DROPS] Updating trigger {trigger_id} for user {current_user.get('id')}")
        return {
            "success": True,
            "message": "Триггер будет обновлен"
        }
    except Exception as e:
        logger.error(f"❌ [DROPS] Error updating trigger: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления триггера")

@router.delete("/triggers/{trigger_id}")
async def delete_drops_trigger(
    trigger_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удаляет триггер Drops (stub)"""
    try:
        logger.info(f"📦 [DROPS] Deleting trigger {trigger_id} for user {current_user.get('id')}")
        return {
            "success": True,
            "message": "Триггер будет удален"
        }
    except Exception as e:
        logger.error(f"❌ [DROPS] Error deleting trigger: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления триггера")

@router.post("/triggers/test/{trigger_id}")
async def test_drops_trigger(
    trigger_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Тестирует триггер Drops (stub)"""
    try:
        logger.info(f"📦 [DROPS] Testing trigger {trigger_id} for user {current_user.get('id')}")
        return {
            "success": True,
            "message": "Триггер тестируется"
        }
    except Exception as e:
        logger.error(f"❌ [DROPS] Error testing trigger: {e}")
        raise HTTPException(status_code=500, detail="Ошибка тестирования триггера")

@router.post("/widget-url")
async def generate_widget_url(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Генерирует URL для OBS виджета"""
    try:
        import secrets
        import os
        
        # Генерируем уникальный токен
        token = secrets.token_urlsafe(32)
        
        # Сохраняем токен в БД (можно использовать существующую таблицу или создать новую)
        # Для простоты используем obs_token пользователя
        user = db.query(User).filter(User.id == current_user["id"]).first()
        if user:
            user.obs_token = token
            db.commit()
        
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        widget_url = f"{frontend_url}/drops-widget/{token}"
        
        return {
            "success": True,
            "data": {
                "url": widget_url,
                "token": token
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating widget URL: {e}")
        raise HTTPException(status_code=500, detail="Ошибка генерации URL виджета")

@router.post("/donationalerts/webhook")
async def donationalerts_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Обработка вебхука от DonationAlerts для Drops"""
    try:
        from services.drops_service import DropsService
        from core.database import DonationAlert
        
        # Получаем данные из вебхука
        data = await request.json()
        
        # Извлекаем информацию о донате
        donation_amount = data.get('amount', 0)
        donor_name = data.get('username', 'Anonymous')
        donor_id = data.get('user_id', 'unknown')
        message = data.get('message', '')
        alert_id = data.get('id', '')  # Уникальный ID от DonationAlerts
        
        logger.info(f"🎁 [DONATION DROPS] Received donation: {donor_name} - {donation_amount}₽")
        
        # Получаем пользователя по DonationAlerts ID
        user_token = db.query(UserToken).filter(
            UserToken.platform == 'donationalerts',
            UserToken.platform_user_id == str(data.get('user_id', ''))
        ).first()
        
        if not user_token:
            logger.warning(f"No user found for DonationAlerts ID: {data.get('user_id')}")
            return {"success": False, "message": "User not found"}
        
        # Получаем username пользователя для channel_name
        user = db.query(User).filter(User.id == user_token.user_id).first()
        if not user:
            logger.warning(f"User not found for user_id: {user_token.user_id}")
            return {"success": False, "message": "User record not found"}
        
        # Используем username того канала который подключен (twitch или vk)
        channel_name = user.twitch_username or user.vk_channel_name or 'default'
        
        # === СОХРАНЯЕМ ДОНАТ В БД ===
        try:
            # Проверяем, не обработан ли этот донат уже
            existing_donation = db.query(DonationAlert).filter(
                DonationAlert.alert_id == alert_id
            ).first()
            
            if not existing_donation:
                # Создаем новую запись о донате
                donation_record = DonationAlert(
                    user_id=user_token.user_id,
                    channel_name=channel_name,
                    amount=float(donation_amount),
                    currency=data.get('currency', 'RUB'),
                    message=message,
                    alert_id=alert_id,
                    is_processed=False
                )
                db.add(donation_record)
                logger.info(f"✅ [DONATION RECORD] Saved donation {alert_id} from {donor_name}")
            else:
                logger.info(f"ℹ️ [DONATION RECORD] Donation {alert_id} already recorded")
        except Exception as e:
            logger.error(f"Error saving donation record: {e}")
            # Не прерываем обработку Drops если сохранение не удалось
        
        # Инициализируем DropsService
        drops_service = DropsService(db)
        
        # Обрабатываем донат Drops
        result = drops_service.process_donation_drops(
            user_id=user_token.user_id,
            channel_name=channel_name,
            platform='donationalerts',
            viewer_id=donor_id,
            viewer_name=donor_name,
            donation_amount=donation_amount
        )
        
        # Сохраняем изменения в БД (донат и drops)
        try:
            db.commit()
        except Exception as e:
            logger.error(f"Error committing donation and drops to DB: {e}")
            db.rollback()
        
        if result:
            logger.info(f"🎁 [DONATION DROPS] {donor_name} получил {result['reward']} ({result['quality']})")
            
            # Отправляем событие в WebSocket для OBS виджета
            from utils.websocket_helper import broadcast_drops_event
            await broadcast_drops_event(result)
            
            return {
                "success": True,
                "message": "Drops processed successfully",
                "data": result
            }
        else:
            return {
                "success": False,
                "message": "No drops available for this donation"
            }
            
    except Exception as e:
        logger.error(f"Error processing DonationAlerts webhook: {e}")
        return {
            "success": False,
            "error": str(e)
        }