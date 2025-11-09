# api/drops_api.py
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field, validator
import random
import time

from core.database import get_db, DropsConfig, DropsReward, DropsQuality, DropsType, UserStreak, DropsHistory, MythicalDropsSession, DonationAlert, UserToken, User
from auth.auth import get_current_user, get_current_user_optional
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
    # Общие настройки стрика
    streak_days_common: Optional[int] = Field(None, ge=1, le=365)
    streak_days_rare: Optional[int] = Field(None, ge=1, le=365)
    streak_days_epic: Optional[int] = Field(None, ge=1, le=365)
    streak_days_legendary: Optional[int] = Field(None, ge=1, le=365)
    streak_messages_required: Optional[int] = Field(None, ge=1, le=100)
    streak_reset_on_skip: Optional[bool] = None
    # Флаги включения стрика для каждой платформы
    streak_enabled_twitch: Optional[bool] = None
    streak_enabled_vk: Optional[bool] = None
    # Устаревшее поле (для обратной совместимости)
    streak_enabled: Optional[bool] = None  # DEPRECATED
    
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
    
    # Настройки виджета (OBS анимация)
    widget_spinning_duration_ms: Optional[int] = Field(None, ge=500, le=5000)
    widget_opening_duration_ms: Optional[int] = Field(None, ge=500, le=3000)
    widget_result_duration_ms: Optional[int] = Field(None, ge=2000, le=15000)
    widget_closing_duration_ms: Optional[int] = Field(None, ge=200, le=2000)

class DropsRewardCreate(BaseModel):
    """Создание награды в Drops"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    quality_id: int = Field(..., ge=1)
    weight: int = Field(100, ge=1, le=1000)
    reward_type: str = Field(..., pattern="^(points|voice|command|custom)$")
    reward_value: str = Field(default="", max_length=1000)  # Пустая строка разрешена - награда это просто сундук
    image_url: Optional[str] = Field(None, max_length=1000)  # URL изображения для карточки в гача крутке
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
    image_url: Optional[str] = Field(None, max_length=1000)  # URL изображения для карточки в гача крутке
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

def get_user_or_session_filters(current_user: dict) -> tuple:
    """Возвращает user_id, session_id и is_guest для текущего пользователя"""
    if not current_user:
        return None, None, False
    
    user_id = current_user.get('id') if current_user.get('id') and current_user.get('id') > 0 else None
    session_id = current_user.get('session_id') if current_user.get('id') == -1 else None
    is_guest = (current_user.get('id') == -1)
    
    return user_id, session_id, is_guest

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
    platform: Optional[str] = None,  # Опциональный параметр, если не указан - возвращаем общий конфиг
    widget_token: Optional[str] = None,  # ✅ Для виджета без авторизации
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получает конфигурацию Drops для канала
    
    Если platform не указан, возвращает общий конфиг (platform="global").
    Поддерживает widget_token для доступа без авторизации (для OBS виджета).
    """
    try:
        # ✅ Проверяем токен виджета если нет авторизованного пользователя
        user_id = None
        session_id = None
        is_guest = False
        
        if current_user and current_user.get("id"):
            user_id, session_id, is_guest = get_user_or_session_filters(current_user)
        elif widget_token:
            # Проверяем токен виджета
            config = db.query(DropsConfig).filter(DropsConfig.widget_token == widget_token).first()
            if config and config.channel_name == channel_name:
                user_id = config.user_id
            else:
                raise HTTPException(status_code=403, detail="Invalid widget token or channel mismatch")
        else:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Используем DropsService для получения конфига (без platform = общий конфиг)
        from services.drops_service import DropsService
        drops_service = DropsService(db)
        
        config = drops_service.get_config(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform  # Если None, вернется общий конфиг (platform="global")
        )
        
        if not config:
            # Создаем конфигурацию по умолчанию (общий конфиг, если platform не указан)
            config = drops_service.create_or_update_config(
                user_id=user_id,
                session_id=session_id,
                channel_name=channel_name,
                platform=platform,  # Если None, создастся общий конфиг (platform="global")
                config_data={}
            )
        
        # Безопасное получение полей (на случай если миграция не применена)
        streak_reset_on_skip = getattr(config, 'streak_reset_on_skip', True)
        widget_token = getattr(config, 'widget_token', None)
        streak_enabled_twitch = getattr(config, 'streak_enabled_twitch', False)
        streak_enabled_vk = getattr(config, 'streak_enabled_vk', False)
        
        return {
            "success": True,
            "data": {
                "id": config.id,
                "channel_name": config.channel_name,
                "platform": config.platform,
                "streak_days_common": config.streak_days_common,
                "streak_days_rare": config.streak_days_rare,
                "streak_days_epic": config.streak_days_epic,
                "streak_days_legendary": config.streak_days_legendary,
                "streak_messages_required": config.streak_messages_required,
                "streak_reset_on_skip": streak_reset_on_skip,
                "streak_enabled_twitch": streak_enabled_twitch,
                "streak_enabled_vk": streak_enabled_vk,
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
                "widget_spinning_duration_ms": config.widget_spinning_duration_ms,
                "widget_opening_duration_ms": config.widget_opening_duration_ms,
                "widget_result_duration_ms": config.widget_result_duration_ms,
                "widget_closing_duration_ms": config.widget_closing_duration_ms,
                "widget_token": widget_token,
                "created_at": config.created_at,
                "updated_at": config.updated_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting drops config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка получения конфигурации Drops: {str(e)}")

@router.put("/config/{channel_name}")
async def update_drops_config(
    channel_name: str,
    config_data: DropsConfigUpdate,
    platform: Optional[str] = None,  # Опциональный параметр, если не указан - обновляем общий конфиг
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Обновляет конфигурацию лутбоксов для канала
    
    Если platform не указан, обновляет общий конфиг (platform="global").
    """
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        user_id, session_id, is_guest = get_user_or_session_filters(current_user)
        
        from services.drops_service import DropsService
        drops_service = DropsService(db)
        
        # Получаем или создаем конфиг (общий, если platform не указан)
        config = drops_service.get_config(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform  # Если None, вернется общий конфиг (platform="global")
        )
        
        if not config:
            # Создаем конфигурацию по умолчанию (общий конфиг, если platform не указан)
            config = drops_service.create_or_update_config(
                user_id=user_id,
                session_id=session_id,
                channel_name=channel_name,
                platform=platform,  # Если None, создастся общий конфиг (platform="global")
                config_data={}
            )
        
        # Обновляем только переданные поля
        update_data = config_data.dict(exclude_unset=True)
        
        config = drops_service.create_or_update_config(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform,  # Если None, обновится общий конфиг (platform="global")
            config_data=update_data
        )
        
        # Отправляем WebSocket уведомление для синхронизации фронтенда
        try:
            from services.memory_websocket_manager import memory_websocket_manager
            if user_id and user_id != -1:  # Только для авторизованных пользователей
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": f"drops_config_{channel_name}_{platform}",
                    "reason": "drops_config_updated"
                }
                await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                logger.debug(f"🔄 [DROPS CONFIG] Sent cache invalidation to user {user_id}")
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification for drops config: {ws_error}")
        
        # ✅ ВАЖНО: Возвращаем полный конфиг для корректного обновления фронтенда
        # Безопасное получение полей (на случай если миграция не применена)
        streak_reset_on_skip = getattr(config, 'streak_reset_on_skip', True)
        widget_token = getattr(config, 'widget_token', None)
        streak_enabled_twitch = getattr(config, 'streak_enabled_twitch', False)
        streak_enabled_vk = getattr(config, 'streak_enabled_vk', False)
        
        return {
            "success": True,
            "message": "Конфигурация лутбоксов обновлена",
            "data": {
                "id": config.id,
                "channel_name": config.channel_name,
                "platform": config.platform,
                "streak_days_common": config.streak_days_common,
                "streak_days_rare": config.streak_days_rare,
                "streak_days_epic": config.streak_days_epic,
                "streak_days_legendary": config.streak_days_legendary,
                "streak_messages_required": config.streak_messages_required,
                "streak_reset_on_skip": streak_reset_on_skip,
                "streak_enabled_twitch": streak_enabled_twitch,
                "streak_enabled_vk": streak_enabled_vk,
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
                "widget_spinning_duration_ms": config.widget_spinning_duration_ms,
                "widget_opening_duration_ms": config.widget_opening_duration_ms,
                "widget_result_duration_ms": config.widget_result_duration_ms,
                "widget_closing_duration_ms": config.widget_closing_duration_ms,
                "widget_token": widget_token,
                "created_at": config.created_at,
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
    platform: str = "twitch",  # Параметр оставлен для совместимости, но игнорируется
    quality: Optional[str] = None,
    widget_token: Optional[str] = None,  # Для виджета без авторизации
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получает награды лутбоксов для канала
    
    ВАЖНО: Награды ОБЩИЕ для всех платформ! Параметр platform игнорируется.
    """
    try:
        # Проверяем токен виджета если нет авторизованного пользователя
        user_id = None
        if current_user and current_user.get("id"):
            user_id = current_user["id"]
        elif widget_token:
            # Проверяем токен виджета (конфиг может быть "global" или платформенным)
            config = db.query(DropsConfig).filter(DropsConfig.widget_token == widget_token).first()
            if config and config.channel_name == channel_name:
                user_id = config.user_id
            else:
                raise HTTPException(status_code=403, detail="Invalid widget token or channel mismatch")
        else:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # ✅ НАГРАДЫ ОБЩИЕ ДЛЯ ВСЕХ ПЛАТФОРМ - не фильтруем по platform
        query = db.query(DropsReward).filter(
            DropsReward.user_id == user_id,
            DropsReward.channel_name == channel_name
            # platform убран - награды общие для всех платформ!
        )
        
        if quality:
            # Фильтруем по качеству
            quality_obj = db.query(DropsQuality).filter(DropsQuality.name == quality).first()
            if quality_obj:
                query = query.filter(DropsReward.quality_id == quality_obj.id)
        
        rewards = query.all()
        
        # Получаем информацию о качествах одним запросом (оптимизация N+1)
        # Используем только те quality_id, которые реально используются в rewards
        quality_ids = {reward.quality_id for reward in rewards if reward.quality_id}
        if quality_ids:
            qualities = {
                q.id: {"name": q.name, "color": q.color, "id": q.id}
                for q in db.query(DropsQuality).filter(DropsQuality.id.in_(quality_ids)).all()
            }
        else:
            qualities = {}
        
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
                    "image_url": reward.image_url,
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
    platform: str = "twitch",  # Параметр оставлен для совместимости, но награда будет общей для всех платформ
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создает новую награду в лутбоксе
    
    ВАЖНО: Награда будет ОБЩЕЙ для всех платформ (Twitch, VK, DonationAlerts).
    Параметр platform сохраняется в БД для совместимости, но не влияет на доступность награды.
    """
    try:
        # ✅ NULL CHECK: Проверяем существование качества
        quality = db.query(DropsQuality).filter(DropsQuality.id == reward_data.quality_id).first()
        if not quality:
            # Логируем для отладки - какие качества есть в БД
            available_qualities = db.query(DropsQuality).all()
            available_ids = [q.id for q in available_qualities]
            logger.warning(f"Quality with id {reward_data.quality_id} not found. Available quality IDs: {available_ids}")
            raise HTTPException(status_code=400, detail=f"Качество с ID {reward_data.quality_id} не найдено. Доступные ID: {available_ids}")
        
        # ✅ SAFETY CHECK: Убеждаемся что quality объект корректен
        if not hasattr(quality, 'id') or not hasattr(quality, 'name'):
            raise HTTPException(status_code=500, detail="Quality object corrupted")
        
        # Санитизируем входные данные
        reward_data.name = sanitize_html(reward_data.name)
        if reward_data.description:
            reward_data.description = sanitize_html(reward_data.description)
        
        # ✅ SAFETY: Создаем reward с проверкой
        try:
            # ✅ Награда создается с platform для совместимости, но доступна для всех платформ
            reward = DropsReward(
                user_id=current_user["id"],
                channel_name=channel_name,
                platform=platform,  # Сохраняется для совместимости, но не используется при фильтрации
                name=reward_data.name,
                description=reward_data.description,
                quality_id=reward_data.quality_id,
                weight=reward_data.weight,
                reward_type=reward_data.reward_type,
                reward_value=reward_data.reward_value,
                image_url=reward_data.image_url,
                sound_volume=reward_data.sound_volume,
                is_active=reward_data.is_active
            )
            if not reward:
                raise ValueError("Failed to create DropsReward object")
        except Exception as creation_error:
            logger.error(f"❌ Error creating DropsReward object: {creation_error}")
            raise HTTPException(status_code=500, detail="Ошибка создания объекта награды")
        
        # ✅ TRANSACTION: Добавляем reward в БД
        try:
            db.add(reward)
            db.commit()
            db.refresh(reward)  # ✅ Обновляем объект из БД
        except Exception as db_error:
            db.rollback()
            logger.error(f"❌ Error saving DropsReward to DB: {db_error}")
            raise HTTPException(status_code=500, detail="Ошибка сохранения награды в базу данных")
        
        # Отправляем WebSocket уведомление для синхронизации фронтенда
        try:
            from services.memory_websocket_manager import memory_websocket_manager
            user_id = current_user.get('id')
            if user_id and user_id != -1:
                # ✅ Награды общие, инвалидируем кеш для всех платформ
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": f"drops_rewards_{channel_name}",  # Убрали platform из ключа
                    "reason": "drops_reward_created"
                }
                await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                logger.debug(f"🔄 [DROPS REWARD] Sent cache invalidation to user {user_id}")
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification for drops reward: {ws_error}")
        
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
        # ✅ NULL CHECK: Запрашиваем reward
        reward = db.query(DropsReward).filter(
            DropsReward.id == reward_id,
            DropsReward.user_id == current_user["id"]
        ).first()
        
        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")
        
        # ✅ SAFETY CHECK: Убеждаемся что reward объект корректен
        if not hasattr(reward, 'id'):
            raise HTTPException(status_code=500, detail="Reward object corrupted")
        
        # ✅ SAFETY: Обновляем только переданные поля с обработкой ошибок
        try:
            update_data = reward_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                if field in ["name", "description"] and value:
                    value = sanitize_html(value)
                setattr(reward, field, value)
            
            reward.updated_at = utcnow_naive()
            db.commit()
            db.refresh(reward)  # ✅ Обновляем объект из БД
        except Exception as update_error:
            db.rollback()
            logger.error(f"❌ Error updating DropsReward: {update_error}")
            raise HTTPException(status_code=500, detail="Ошибка обновления награды")
        
        # Отправляем WebSocket уведомление для синхронизации фронтенда
        try:
            from services.memory_websocket_manager import memory_websocket_manager
            user_id = current_user.get('id')
            if user_id and user_id != -1:
                # ✅ Награды общие, инвалидируем кеш для всех платформ
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": f"drops_rewards_{reward.channel_name}",  # Убрали platform из ключа
                    "reason": "drops_reward_updated"
                }
                await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                logger.debug(f"🔄 [DROPS REWARD] Sent cache invalidation to user {user_id}")
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification for drops reward: {ws_error}")
        
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
        
        channel_name = reward.channel_name
        
        db.delete(reward)
        db.commit()
        
        # Отправляем WebSocket уведомление для синхронизации фронтенда
        try:
            from services.memory_websocket_manager import memory_websocket_manager
            user_id = current_user.get('id')
            if user_id and user_id != -1:
                # ✅ Награды общие, инвалидируем кеш для всех платформ
                cache_invalidation_event = {
                    "type": "cache_invalidate",
                    "cache_key": f"drops_rewards_{channel_name}",  # Убрали platform из ключа
                    "reason": "drops_reward_deleted"
                }
                await memory_websocket_manager.send_to_user(user_id, cache_invalidation_event)
                logger.debug(f"🔄 [DROPS REWARD] Sent cache invalidation to user {user_id}")
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification for drops reward: {ws_error}")
        
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
    """Загружает изображение для награды (карточка в гача крутке)"""
    try:
        reward = db.query(DropsReward).filter(
            DropsReward.id == reward_id,
            DropsReward.user_id == current_user["id"]
        ).first()
        
        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")
        
        # Проверяем тип файла
        if not image_file.content_type or not image_file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Файл должен быть изображением")
        
        # Сохраняем файл
        import os
        upload_dir = f"uploads/drops/{current_user['id']}/images"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Генерируем имя файла
        file_extension = os.path.splitext(image_file.filename)[1] or '.png'
        filename = f"reward_{reward_id}_{int(time.time())}{file_extension}"
        file_path = os.path.join(upload_dir, filename)
        
        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            content = await image_file.read()
            buffer.write(content)
        
        # Обновляем путь к файлу в БД
        # Формируем URL относительно статики или полный путь
        image_url = f"/static/uploads/drops/{current_user['id']}/images/{filename}"
        reward.image_url = image_url
        reward.updated_at = utcnow_naive()
        db.commit()
        
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
        reward = db.query(DropsReward).filter(
            DropsReward.id == reward_id,
            DropsReward.user_id == current_user["id"]
        ).first()
        
        if not reward:
            raise HTTPException(status_code=404, detail="Награда не найдена")
        
        # Проверяем валидность файла
        from validators.file_validators import validate_sound_file
        validate_sound_file(sound_file)
        
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
    platform: Optional[str] = None,  # Опциональный параметр, если не указан - возвращаем общую историю
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает историю лутбоксов для канала
    
    Если platform не указан, возвращает общую историю для всех платформ.
    """
    try:
        # Загружаем историю (общую для всех платформ, если platform не указан)
        query = db.query(DropsHistory).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name
        )
        
        # Если platform указан, фильтруем по нему
        if platform:
            query = query.filter(DropsHistory.platform == platform)
        
        history = query.order_by(DropsHistory.created_at.desc()).offset(offset).limit(limit).all()
        
        # Получаем информацию о качествах одним запросом (оптимизация N+1)
        # Используем только те quality_id, которые реально используются в истории
        quality_ids = {entry.quality_id for entry in history if entry.quality_id}
        if quality_ids:
            qualities = {
                q.id: {"name": q.name, "color": q.color, "id": q.id}
                for q in db.query(DropsQuality).filter(DropsQuality.id.in_(quality_ids)).all()
            }
        else:
            qualities = {}
        
        return {
            "success": True,
            "data": [
                {
                    "id": entry.id,
                    "viewer_name": entry.viewer_name,
                    "drops_type": entry.lootbox_type,  # Поле в БД называется lootbox_type
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
            func.count(DropsHistory.id).label('drops_count')
        ).filter(
            DropsHistory.user_id == current_user["id"],
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        ).group_by(DropsHistory.viewer_name).order_by(
            func.count(DropsHistory.id).desc()
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

@router.get("/streaks/{channel_name}")
async def get_user_streaks(
    channel_name: str,
    platform: Optional[str] = None,  # Опциональный параметр, если не указан - возвращаем общую статистику
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получает список стриков пользователей
    
    Если platform не указан, возвращает общую статистику для всех платформ.
    """
    try:
        # Check if streak is enabled (проверяем общий конфиг)
        from services.drops_service import DropsService
        drops_service = DropsService(db)
        user_id, session_id, is_guest = get_user_or_session_filters(current_user)
        
        config = drops_service.get_config(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=None  # Получаем общий конфиг
        )
        
        # Проверяем, включен ли стрик хотя бы на одной платформе
        streak_enabled = False
        if config:
            streak_enabled_twitch = getattr(config, 'streak_enabled_twitch', False)
            streak_enabled_vk = getattr(config, 'streak_enabled_vk', False)
            streak_enabled = streak_enabled_twitch or streak_enabled_vk
        
        # If streak is disabled, return empty list
        if not config or not streak_enabled:
            return {
                "success": True,
                "data": []
            }
        
        # Загружаем стрики (общие для всех платформ, если platform не указан)
        query = db.query(UserStreak).filter(
            UserStreak.user_id == current_user["id"],
            UserStreak.channel_name == channel_name
        )
        
        # Если platform указан, фильтруем по нему
        if platform:
            query = query.filter(UserStreak.platform == platform)
        
        streaks = query.order_by(UserStreak.current_streak.desc()).offset(offset).limit(limit).all()
        
        return {
            "success": True,
            "data": [
                {
                    "viewer_name": streak.viewer_name,
                    "current_streak": streak.current_streak,
                    "max_streak": streak.max_streak,
                    "messages_this_stream": streak.messages_this_stream,
                    "last_activity": streak.last_activity
                }
                for streak in streaks
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting user streaks: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения стриков пользователей")

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

@router.get("/user-from-token/{token}")
async def get_user_from_token(
    token: str,
    db: Session = Depends(get_db)
):
    """Получить user_id по токену виджета (для виджета, без авторизации)"""
    try:
        # Ищем конфигурацию по токену виджета
        config = db.query(DropsConfig).filter(DropsConfig.widget_token == token).first()
        
        if not config or not config.user_id:
            logger.warning(f"Drops widget: Config not found for token: {token[:8]}...")
            raise HTTPException(status_code=404, detail="Invalid widget token")
        
        return {
            "user_id": config.user_id,
            "channel_name": config.channel_name,
            "platform": config.platform or "global",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user from token: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error validating widget token")

@router.post("/widget-url")
async def generate_widget_url(
    regenerate: bool = False,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Генерирует или возвращает существующий URL для OBS виджета"""
    try:
        import secrets
        import os
        
        # Получаем channel_name из пользователя
        user = db.query(User).filter(User.id == current_user["id"]).first()
        
        if not user:
            raise HTTPException(
                status_code=400, 
                detail="Пользователь не найден"
            )
        
        # Определяем channel_name (приоритет: twitch -> vk)
        channel_name = user.twitch_username or user.vk_channel_name or user.username or "unknown"
        
        if channel_name == "unknown":
            raise HTTPException(
                status_code=400, 
                detail="Необходимо подключить платформу (Twitch/VK) для создания виджета"
            )
        
        # Ищем общий конфиг пользователя (platform="global" или None)
        from services.drops_service import DropsService
        drops_service = DropsService(db)
        config = drops_service.get_config(
            user_id=current_user["id"],
            session_id=None,
            channel_name=channel_name,
            platform=None  # Используем общий конфиг
        )
        
        # Если есть токен и не требуется регенерация, возвращаем существующий
        widget_token_value = None
        if config and hasattr(config, 'widget_token'):
            widget_token_value = config.widget_token
        
        if config and widget_token_value and not regenerate:
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            widget_url = f"{frontend_url}/drops-widget/{widget_token_value}"
            return {
                "success": True,
                "data": {
                    "url": widget_url,
                    "token": widget_token_value
                }
            }
        
        # Генерируем новый токен
        token = secrets.token_urlsafe(32)
        
        # Сохраняем токен в конфигурацию
        if config:
            try:
                from sqlalchemy import text
                db.execute(
                    text("UPDATE drops_configs SET widget_token = :token WHERE id = :config_id"),
                    {"token": token, "config_id": config.id}
                )
                # Обновляем объект в памяти
                if hasattr(config, 'widget_token'):
                    config.widget_token = token
            except Exception as e:
                logger.warning(f"Cannot set widget_token: {e}. Field may not exist in database. Creating migration needed.")
        
        # Если конфигурации нет, создаем общий конфиг (platform=None -> "global")
        if not config:
            config = drops_service.create_or_update_config(
                user_id=current_user["id"],
                session_id=None,
                channel_name=channel_name,
                platform=None,  # Создаем общий конфиг (platform="global")
                config_data={}
            )
            
            # Пытаемся сохранить токен через прямой SQL UPDATE если поле существует
            # Это безопаснее, чем через ORM, если столбец еще не существует
            try:
                from sqlalchemy import text
                result = db.execute(
                    text("UPDATE drops_configs SET widget_token = :token WHERE id = :config_id"),
                    {"token": token, "config_id": config.id}
                )
                # Обновляем объект в памяти
                if hasattr(config, 'widget_token'):
                    config.widget_token = token
            except Exception as e:
                logger.warning(f"Cannot set widget_token on new config: {e}. Field may not exist in database. Creating migration needed.")
        
        db.commit()
        
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        widget_url = f"{frontend_url}/drops-widget/{token}"
        
        return {
            "success": True,
            "data": {
                "url": widget_url,
                "token": token
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating widget URL: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка генерации URL виджета: {str(e)}")

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
        # ✅ Используем транзакцию для атомарности операции
        try:
            # ✅ Проверяем дублирование с блокировкой для предотвращения race condition
            existing_donation = db.query(DonationAlert).filter(
                DonationAlert.alert_id == alert_id
            ).with_for_update().first()  # ✅ Lock для предотвращения дублирования
            
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
            
            # ✅ Атомарный commit всех изменений (донат + drops)
            db.commit()
            
        except Exception as e:
            # ✅ Rollback при любой ошибке
            db.rollback()
            logger.error(f"❌ Error processing donation {alert_id}: {e}", exc_info=True)
            # Не прерываем обработку, но логируем ошибку
        
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

@router.get("/mythical-session/{channel_name}")
async def get_active_mythical_session(
    channel_name: str,
    widget_token: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Получить активную сессию мифического сундука (для виджета OBS)"""
    try:
        # Если есть widget_token, используем его для авторизации
        if widget_token:
            config = db.query(DropsConfig).filter(DropsConfig.widget_token == widget_token).first()
            if not config:
                raise HTTPException(status_code=404, detail="Invalid widget token")
            user_id = config.user_id
            session_id = config.session_id
        elif current_user:
            user_id = current_user.get("id")
            session_id = current_user.get("session_id")
        else:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Ищем активную сессию
        query = db.query(MythicalDropsSession).filter(
            MythicalDropsSession.channel_name == channel_name,
            MythicalDropsSession.is_active == True,
            MythicalDropsSession.expires_at > utcnow_naive()
        )
        
        if user_id:
            query = query.filter(MythicalDropsSession.user_id == user_id)
        elif session_id:
            query = query.filter(MythicalDropsSession.session_id == session_id)
        else:
            return {"success": False, "data": None}
        
        session = query.first()
        
        if not session:
            return {
                "success": True,
                "data": None
            }
        
        # Вычисляем оставшееся время
        now = utcnow_naive()
        time_remaining = (session.expires_at - now).total_seconds()
        time_remaining = max(0, int(time_remaining))
        
        return {
            "success": True,
            "data": {
                "id": session.id,
                "is_active": session.is_active,
                "donation_amount": session.donation_amount,
                "window_duration_minutes": session.window_duration_minutes,
                "started_at": session.started_at.isoformat() if session.started_at else None,
                "expires_at": session.expires_at.isoformat() if session.expires_at else None,
                "time_remaining_seconds": time_remaining,
                "time_remaining_minutes": int(time_remaining / 60),
                "time_remaining_formatted": f"{int(time_remaining / 60)}:{int(time_remaining % 60):02d}"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active mythical session: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения активной сессии")

@router.post("/streak/reset/{channel_name}")
async def reset_streak_statistics(
    channel_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сбрасывает всю статистику стриков для канала для всех платформ (только статистика, не настройки)"""
    try:
        user_id, session_id, is_guest = get_user_or_session_filters(current_user)
        
        from services.drops_service import DropsService
        drops_service = DropsService(db)
        
        # Проверяем, что конфигурация существует и принадлежит пользователю (общий конфиг)
        config = drops_service.get_config(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=None  # Проверяем общий конфиг
        )
        
        if not config:
            raise HTTPException(status_code=404, detail="Конфигурация не найдена")
        
        # Удаляем все записи UserStreak для этого канала (для всех платформ)
        query = db.query(UserStreak).filter(
            UserStreak.channel_name == channel_name
        )
        
        if user_id:
            query = query.filter(UserStreak.user_id == user_id)
        elif session_id:
            query = query.filter(UserStreak.session_id == session_id)
        else:
            raise HTTPException(status_code=400, detail="Не удалось определить пользователя")
        
        deleted_count = query.delete(synchronize_session=False)
        db.commit()
        
        drops_logger.info(f"🗑️ [STREAK RESET] Удалено {deleted_count} записей стриков для {channel_name} (все платформы)")
        
        return {
            "success": True,
            "message": f"Статистика стриков сброшена",
            "data": {
                "channel_name": channel_name,
                "platform": platform,
                "deleted_count": deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting streak statistics: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка сброса статистики стриков")