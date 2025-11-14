# services/drops_service.py
import logging
import json
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from core.database import DropsConfig, DropsReward, DropsQuality, UserStreak, DropsHistory, MythicalDropsSession
from core.datetime_utils import utcnow_naive
from services.stream_session_service import StreamSessionService

logger = logging.getLogger(__name__)


class DropsCalculationService:
    """Service for calculating drops results with probability-based logic
    
    This service separates business logic (probability calculation) from UI (animation widget).
    All drop results are calculated on the backend before being sent to the frontend.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_drop(
        self,
        user_id: int,
        channel_name: str,
        platform: str,
        quality_name: str
    ) -> Optional[Dict[str, Any]]:
        """Calculate a drop result based on quality
        
        Args:
            user_id: ID of the channel owner
            channel_name: Name of the channel
            platform: Platform (twitch/vk)
            quality_name: Quality tier (Common, Rare, Epic, Legendary, Mythical)
            
        Returns:
            Dictionary with drop result including:
            - reward_id: ID of the selected reward
            - reward_name: Name of the reward
            - reward_type: Type of reward (points, voice, command, custom)
            - reward_value: Value of the reward
            - quality: Quality tier
            - image_url: URL to reward image
            - sound_file: Path to sound file
            - sound_volume: Volume for sound playback
            
        Raises:
            ValueError: If quality not found or no rewards available
        """
        logger.info(f"🎲 [DROPS CALC] Calculating drop for {channel_name} (quality: {quality_name})")
        
        # Get quality by name
        quality = self.db.query(DropsQuality).filter(
            DropsQuality.name == quality_name
        ).first()
        
        if not quality:
            logger.error(f"❌ [DROPS CALC] Quality '{quality_name}' not found")
            raise ValueError(f"Quality '{quality_name}' not found")
        
        # Get all active rewards for this quality
        rewards = self.db.query(DropsReward).filter(
            DropsReward.user_id == user_id,
            DropsReward.channel_name == channel_name,
            DropsReward.quality_id == quality.id,
            DropsReward.is_active == True
        ).all()
        
        if not rewards:
            logger.error(f"❌ [DROPS CALC] No rewards found for quality '{quality_name}'")
            raise ValueError(f"No rewards available for quality '{quality_name}'")
        
        # Calculate weighted random selection
        selected_reward = self._weighted_random_choice(rewards)
        
        if not selected_reward:
            logger.error(f"❌ [DROPS CALC] Failed to select reward")
            raise ValueError("Failed to select reward")
        
        logger.info(
            f"✅ [DROPS CALC] Selected reward: {selected_reward.name} "
            f"(weight: {selected_reward.weight}, quality: {quality_name})"
        )
        
        return {
            "reward_id": selected_reward.id,
            "reward_name": selected_reward.name,
            "reward_type": selected_reward.reward_type,
            "reward_value": selected_reward.reward_value,
            "quality": quality_name,
            "quality_color": quality.color,
            "image_url": selected_reward.image_url,
            "sound_file": selected_reward.sound_file,
            "sound_volume": selected_reward.sound_volume,
            "description": selected_reward.description
        }
    
    def get_probabilities(
        self,
        user_id: int,
        channel_name: str,
        quality_name: str
    ) -> Dict[str, float]:
        """Get probability distribution for rewards of a given quality
        
        Args:
            user_id: ID of the channel owner
            channel_name: Name of the channel
            quality_name: Quality tier
            
        Returns:
            Dictionary mapping reward_id to probability (0.0 to 1.0)
        """
        logger.debug(f"📊 [DROPS CALC] Getting probabilities for {channel_name} (quality: {quality_name})")
        
        # Get quality
        quality = self.db.query(DropsQuality).filter(
            DropsQuality.name == quality_name
        ).first()
        
        if not quality:
            logger.warning(f"⚠️ [DROPS CALC] Quality '{quality_name}' not found")
            return {}
        
        # Get all active rewards
        rewards = self.db.query(DropsReward).filter(
            DropsReward.user_id == user_id,
            DropsReward.channel_name == channel_name,
            DropsReward.quality_id == quality.id,
            DropsReward.is_active == True
        ).all()
        
        if not rewards:
            logger.warning(f"⚠️ [DROPS CALC] No rewards found for quality '{quality_name}'")
            return {}
        
        # Calculate total weight
        total_weight = sum(reward.weight for reward in rewards)
        
        if total_weight == 0:
            logger.warning(f"⚠️ [DROPS CALC] Total weight is 0, using uniform distribution")
            uniform_prob = 1.0 / len(rewards)
            return {reward.id: uniform_prob for reward in rewards}
        
        # Calculate probabilities
        probabilities = {
            reward.id: reward.weight / total_weight
            for reward in rewards
        }
        
        logger.debug(f"📊 [DROPS CALC] Probabilities: {probabilities}")
        
        return probabilities
    
    def validate_probabilities(
        self,
        user_id: int,
        channel_name: str,
        quality_name: str
    ) -> Tuple[bool, Optional[str]]:
        """Validate that probabilities sum to 1.0 and all rewards have valid weights
        
        Args:
            user_id: ID of the channel owner
            channel_name: Name of the channel
            quality_name: Quality tier
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        logger.debug(f"✔️ [DROPS CALC] Validating probabilities for {channel_name} (quality: {quality_name})")
        
        # Get quality
        quality = self.db.query(DropsQuality).filter(
            DropsQuality.name == quality_name
        ).first()
        
        if not quality:
            return False, f"Quality '{quality_name}' not found"
        
        # Get all active rewards
        rewards = self.db.query(DropsReward).filter(
            DropsReward.user_id == user_id,
            DropsReward.channel_name == channel_name,
            DropsReward.quality_id == quality.id,
            DropsReward.is_active == True
        ).all()
        
        if not rewards:
            return False, f"No rewards found for quality '{quality_name}'"
        
        # Check for invalid weights
        invalid_weights = [r for r in rewards if r.weight <= 0]
        if invalid_weights:
            reward_names = [r.name for r in invalid_weights]
            return False, f"Rewards with invalid weights (<=0): {', '.join(reward_names)}"
        
        # Calculate total weight
        total_weight = sum(reward.weight for reward in rewards)
        
        if total_weight == 0:
            return False, "Total weight is 0"
        
        # Calculate probabilities and verify they sum to ~1.0
        probabilities = self.get_probabilities(user_id, channel_name, quality_name)
        total_probability = sum(probabilities.values())
        
        # Allow small floating point error
        if not (0.99 <= total_probability <= 1.01):
            return False, f"Probabilities sum to {total_probability:.4f}, expected 1.0"
        
        logger.debug(f"✅ [DROPS CALC] Probabilities valid for {channel_name} (quality: {quality_name})")
        
        return True, None
    
    def _weighted_random_choice(self, rewards: List[DropsReward]) -> Optional[DropsReward]:
        """Select a random reward based on weights
        
        Algorithm:
            1. Sum all weights: total_weight
            2. Generate random number: 0 <= random_value < total_weight
            3. Iterate through rewards, accumulating weights
            4. When accumulated weight > random_value, return current reward
            
        Args:
            rewards: List of DropsReward objects
            
        Returns:
            Selected reward or None if list is empty
        """
        if not rewards:
            return None
        
        # Calculate total weight
        total_weight = sum(reward.weight for reward in rewards)
        
        if total_weight == 0:
            logger.warning("⚠️ [DROPS CALC] Total weight is 0, using uniform distribution")
            return random.choice(rewards)
        
        # Generate random value
        random_value = random.random() * total_weight
        current_weight = 0
        
        # Select reward
        for reward in rewards:
            current_weight += reward.weight
            if random_value < current_weight:
                logger.debug(
                    f"🎯 [DROPS CALC] Selected '{reward.name}' "
                    f"(weight={reward.weight}/{total_weight}, random={random_value:.2f})"
                )
                return reward
        
        # Fallback (should not happen mathematically)
        logger.warning("⚠️ [DROPS CALC] Fallback to last reward")
        return rewards[-1]

class DropsService:
    """Сервис для управления системой Drops"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_config(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = None) -> Optional[DropsConfig]:
        """Получает конфигурацию Drops для канала
        
        Если platform не указан, возвращает общий конфиг (platform="global").
        Если общий конфиг не существует, создает его на основе существующих записей (twitch/vk).
        """
        # Если platform не указан, используем "global" для общих настроек
        target_platform = platform or "global"
        
        query = self.db.query(DropsConfig).filter(
            DropsConfig.channel_name == channel_name,
            DropsConfig.platform == target_platform
        )
        
        if user_id:
            query = query.filter(DropsConfig.user_id == user_id)
        elif session_id:
            query = query.filter(DropsConfig.session_id == session_id)
        else:
            return None
        
        config = query.first()
        
        # Если platform не указан и общий конфиг не существует, создаем его из существующих записей
        if not config and not platform:
            # Ищем существующие конфиги для этого пользователя/канала
            existing_query = self.db.query(DropsConfig).filter(
                DropsConfig.channel_name == channel_name
            )
            if user_id:
                existing_query = existing_query.filter(DropsConfig.user_id == user_id)
            elif session_id:
                existing_query = existing_query.filter(DropsConfig.session_id == session_id)
            else:
                return None
            
            existing_configs = existing_query.filter(DropsConfig.platform.in_(['twitch', 'vk'])).all()
            
            if existing_configs:
                # Используем первую найденную запись как основу (приоритет: twitch > vk)
                base_config = next((c for c in existing_configs if c.platform == 'twitch'), existing_configs[0])
                
                # Объединяем флаги из всех существующих записей
                streak_enabled_twitch = any(
                    getattr(c, 'streak_enabled_twitch', getattr(c, 'streak_enabled', False))
                    for c in existing_configs if c.platform == 'twitch'
                )
                streak_enabled_vk = any(
                    getattr(c, 'streak_enabled_vk', getattr(c, 'streak_enabled', False))
                    for c in existing_configs if c.platform == 'vk'
                )
                
                # Создаем общий конфиг с объединенными настройками
                config = DropsConfig(
                    user_id=user_id,
                    session_id=session_id,
                    channel_name=channel_name,
                    platform="global",
                    # Копируем общие настройки из базового конфига
                    streak_days_common=base_config.streak_days_common,
                    streak_days_rare=base_config.streak_days_rare,
                    streak_days_epic=base_config.streak_days_epic,
                    streak_days_legendary=base_config.streak_days_legendary,
                    streak_messages_required=base_config.streak_messages_required,
                    streak_reset_on_skip=getattr(base_config, 'streak_reset_on_skip', True),
                    streak_enabled_twitch=streak_enabled_twitch,
                    streak_enabled_vk=streak_enabled_vk,
                    # Донат настройки (общие)
                    donation_enabled=base_config.donation_enabled,
                    donation_amount_common=base_config.donation_amount_common,
                    donation_amount_rare=base_config.donation_amount_rare,
                    donation_amount_epic=base_config.donation_amount_epic,
                    donation_amount_legendary=base_config.donation_amount_legendary,
                    # Мифический лутбокс (общий)
                    mythical_enabled=base_config.mythical_enabled,
                    mythical_min_interval_hours=base_config.mythical_min_interval_hours,
                    mythical_max_interval_hours=base_config.mythical_max_interval_hours,
                    mythical_window_duration_minutes=base_config.mythical_window_duration_minutes,
                    mythical_donation_amount=base_config.mythical_donation_amount,
                    # Настройки виджета (общие)
                    widget_spinning_duration_ms=getattr(base_config, 'widget_spinning_duration_ms', 1500),
                    widget_opening_duration_ms=getattr(base_config, 'widget_opening_duration_ms', 1000),
                    widget_result_duration_ms=getattr(base_config, 'widget_result_duration_ms', 5500),
                    widget_closing_duration_ms=getattr(base_config, 'widget_closing_duration_ms', 500),
                    widget_token=getattr(base_config, 'widget_token', None)
                )
                self.db.add(config)
                self.db.commit()
                self.db.refresh(config)
        
        return config
    
    def create_or_update_config(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = None, config_data: Dict[str, Any] = None) -> DropsConfig:
        """Создает или обновляет конфигурацию Drops
        
        Если platform не указан, создает/обновляет общий конфиг (platform="global").
        """
        # Если platform не указан, используем "global" для общих настроек
        target_platform = platform or "global"
        
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=target_platform)
        
        if not config:
            config = DropsConfig(
                user_id=user_id,
                session_id=session_id,
                channel_name=channel_name,
                platform=target_platform
            )
            self.db.add(config)
        
        # Обновляем поля
        if config_data:
            for field, value in config_data.items():
                if hasattr(config, field):
                    setattr(config, field, value)
        
        config.updated_at = utcnow_naive()
        
        try:
            self.db.commit()
            self.db.refresh(config)
        except Exception as e:
            logger.error(f"❌ Error saving drops config for {channel_name}: {e}")
            self.db.rollback()
            raise
        
        return config
    
    def get_rewards(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", quality_id: Optional[int] = None) -> List[DropsReward]:
        """Получает награды для канала
        
        ВАЖНО: Награды ОБЩИЕ для всех платформ! Параметр platform игнорируется.
        Все награды доступны для всех платформ (Twitch, VK, DonationAlerts).
        
        Args:
            user_id: ID пользователя
            session_id: ID сессии (для гостей)
            channel_name: Имя канала
            platform: Платформа (игнорируется, оставлено для совместимости)
            quality_id: ID качества (опционально)
            
        Returns:
            Список активных наград для канала
        """
        query = self.db.query(DropsReward).filter(
            DropsReward.channel_name == channel_name,
            DropsReward.is_active == True
            # ✅ УБРАН фильтр по platform - награды общие для всех платформ!
        )
        
        if user_id:
            query = query.filter(DropsReward.user_id == user_id)
        elif session_id:
            query = query.filter(DropsReward.session_id == session_id)
        else:
            return []
        
        if quality_id:
            query = query.filter(DropsReward.quality_id == quality_id)
        
        return query.all()
    
    def get_quality_by_name(self, quality_name: str) -> Optional[DropsQuality]:
        """Получает качество по имени"""
        return self.db.query(DropsQuality).filter(DropsQuality.name == quality_name).first()
    
    def get_user_streak(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None) -> Optional[UserStreak]:
        """Получает стрик пользователя"""
        query = self.db.query(UserStreak).filter(
            UserStreak.channel_name == channel_name,
            UserStreak.platform == platform,
            UserStreak.viewer_id == viewer_id
        )
        
        if user_id:
            query = query.filter(UserStreak.user_id == user_id)
        elif session_id:
            query = query.filter(UserStreak.session_id == session_id)
        else:
            return None
        
        return query.first()
    
    def update_user_streak(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None, is_streaming: bool = True) -> UserStreak:
        """Обновляет стрик пользователя
        
        ВАЖНО: Стрик привязан к трансляциям, а не к дням!
        Каждая трансляция = одна отметка о посещении.
        Стрик увеличивается только если зритель написал достаточно сообщений в предыдущей трансляции!
        
        Args:
            user_id: ID владельца канала
            session_id: ID сессии (для гостей)
            channel_name: Имя канала
            platform: Платформа (twitch/vk)
            viewer_id: ID зрителя
            viewer_name: Имя зрителя
            is_streaming: Идет ли стрим сейчас
            
        Returns:
            Обновленный объект UserStreak
        """
        # Получаем конфигурацию для проверки требований
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=None)
        if not config:
            logger.warning(f"No config found for streak update: channel={channel_name}, viewer={viewer_name}")
            return None
        
        # ✅ ЗАЩИТА ОТ RACE CONDITIONS: Используем pessimistic locking
        from sqlalchemy import and_
        query = self.db.query(UserStreak).filter(
            UserStreak.channel_name == channel_name,
            UserStreak.platform == platform,
            UserStreak.viewer_id == viewer_id
        )
        if user_id:
            query = query.filter(UserStreak.user_id == user_id)
        elif session_id:
            query = query.filter(UserStreak.session_id == session_id)
        else:
            return None
        
        # ✅ Блокируем запись для предотвращения race conditions
        streak = query.with_for_update().first()
        
        if not streak:
            streak = UserStreak(
                user_id=user_id,
                session_id=session_id,
                channel_name=channel_name,
                platform=platform,
                viewer_id=viewer_id,
                viewer_name=viewer_name,
                messages_this_stream=0
            )
            self.db.add(streak)
        
        now = utcnow_naive()
        
        # ✅ НОВАЯ ЛОГИКА: Стрик привязан к трансляциям через StreamSession
        stream_session_service = StreamSessionService(self.db)
        
        # Проверяем, онлайн ли стрим сейчас
        is_stream_online = self._check_stream_online(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform)
        
        # Если стрим оффлайн, просто обновляем время последней активности, но не засчитываем стрик
        if not is_stream_online:
            streak.last_activity = now
            streak.updated_at = now
            self.db.commit()
            self.db.refresh(streak)
            return streak
        
        # Получаем или создаем активную сессию трансляции
        active_session = stream_session_service.get_or_create_active_session(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform
        )
        
        if not active_session:
            # Если не удалось создать сессию, просто обновляем время
            streak.last_activity = now
            streak.updated_at = now
            self.db.commit()
            self.db.refresh(streak)
            return streak
        
        # Отмечаем что зритель посетил текущую трансляцию
        stream_session_service.mark_viewer_attended_stream(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id
        )
        
        # Проверяем, это новая трансляция?
        # Если last_stream_session_id отличается от текущей активной сессии - это новая трансляция
        is_new_stream = streak.last_stream_session_id != active_session.id
        
        # ✅ Обрабатываем новую трансляцию (включая первую, когда last_stream_session_id is None)
        if is_new_stream:
            # ✅ НОВАЯ ТРАНСЛЯЦИЯ: Проверяем выполнено ли требование по сообщениям за предыдущую трансляцию
            # Если это первая трансляция (last_stream_session_id is None), считаем что зритель "посетил" предыдущую
            if streak.last_stream_session_id is None:
                # Первая трансляция - зритель автоматически "посетил" предыдущую (её не было)
                attended_previous = True
            else:
                # Проверяем, посетил ли зритель предыдущую трансляцию
                attended_previous = stream_session_service.check_viewer_attended_last_stream(
                    user_id=user_id,
                    session_id=session_id,
                    channel_name=channel_name,
                    platform=platform,
                    viewer_id=viewer_id
                )
            
            if attended_previous and streak.messages_this_stream >= config.streak_messages_required:
                # Зритель посетил предыдущую трансляцию и выполнил требование - увеличиваем стрик
                streak.current_streak += 1
                streak.max_streak = max(streak.max_streak, streak.current_streak)
                logger.info(f"✅ Streak +1 for {viewer_name}: {streak.current_streak} трансляций (messages: {streak.messages_this_stream}/{config.streak_messages_required})")
            elif not attended_previous:
                # Зритель НЕ посетил предыдущую трансляцию - сбрасываем стрик (если включен streak_reset_on_skip)
                if config.streak_reset_on_skip and streak.current_streak > 0:
                    logger.info(f"❌ Streak reset for {viewer_name}: пропустил трансляцию (had {streak.current_streak} трансляций)")
                    streak.current_streak = 0
                else:
                    logger.info(f"⏸️ Streak paused for {viewer_name}: пропустил трансляцию, но streak_reset_on_skip=False (current: {streak.current_streak} трансляций)")
            else:
                # Зритель посетил, но не выполнил требование по сообщениям - сбрасываем стрик
                if config.streak_reset_on_skip and streak.current_streak > 0:
                    logger.info(f"❌ Streak reset for {viewer_name}: посетил, но недостаточно сообщений ({streak.messages_this_stream}/{config.streak_messages_required}, had {streak.current_streak} трансляций)")
                    streak.current_streak = 0
                else:
                    logger.info(f"⏸️ Streak paused for {viewer_name}: недостаточно сообщений ({streak.messages_this_stream}/{config.streak_messages_required}), но streak_reset_on_skip=False")
            
            # Обнуляем счетчик сообщений для новой трансляции
            streak.messages_this_stream = 0
        
        # Обновляем время последней активности
        streak.last_activity = now
        streak.updated_at = now
        
        try:
            self.db.commit()
            self.db.refresh(streak)
        except Exception as e:
            logger.error(f"❌ Error updating streak for {viewer_name}: {e}")
            self.db.rollback()
            raise
        
        return streak
    
    def increment_viewer_message_count(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None) -> UserStreak:
        """Увеличивает счетчик сообщений зрителя за текущий стрим
        
        Этот метод должен вызываться при КАЖДОМ сообщении зрителя в чате.
        
        Args:
            user_id: ID владельца канала
            session_id: ID сессии (для гостей)
            channel_name: Имя канала
            platform: Платформа (twitch/vk)
            viewer_id: ID зрителя
            viewer_name: Имя зрителя
            
        Returns:
            Обновленный объект UserStreak
        """
        streak = self.get_user_streak(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id)
        
        if not streak:
            # Создаем новый стрик если его нет
            streak = UserStreak(
                user_id=user_id,
                session_id=session_id,
                channel_name=channel_name,
                platform=platform,
                viewer_id=viewer_id,
                viewer_name=viewer_name,
                messages_this_stream=1,
                current_streak=0,
                max_streak=0
            )
            self.db.add(streak)
        else:
            # Увеличиваем счетчик сообщений
            streak.messages_this_stream += 1
        
        streak.last_activity = utcnow_naive()
        streak.updated_at = utcnow_naive()
        
        self.db.commit()
        self.db.refresh(streak)
        
        logger.debug(f"📝 Message count for {viewer_name}: {streak.messages_this_stream} (channel: {channel_name})")
        
        return streak
    
    def process_streak_drops(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None) -> Optional[Dict[str, Any]]:
        """Обрабатывает стрик Drops
        
        Получает общий конфиг и проверяет флаг для конкретной платформы.
        """
        # Получаем общий конфиг (platform=None)
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=None)
        if not config:
            return None
        
        # Проверяем, включен ли стрик для конкретной платформы
        streak_enabled = False
        if platform == "twitch":
            streak_enabled = getattr(config, 'streak_enabled_twitch', False)
        elif platform == "vk":
            streak_enabled = getattr(config, 'streak_enabled_vk', False)
        
        if not streak_enabled:
            return None
        
        # Обновляем стрик
        streak = self.update_user_streak(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id, viewer_name=viewer_name)
        
        # Определяем качество по дням стрика
        quality_name = self._get_streak_quality(streak.current_streak, config)
        if not quality_name:
            return None
        
        quality = self.get_quality_by_name(quality_name)
        if not quality:
            return None
        
        # Получаем награду
        reward = self._get_random_reward(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, quality_id=quality.id)
        if not reward:
            return None
        
        # Записываем в историю
        self._record_drops_history(
            user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id, viewer_name=viewer_name,
            drops_type="streak", quality_id=quality.id, reward=reward, streak_days=streak.current_streak
        )
        
        return {
            "type": "streak",
            "viewer_name": viewer_name,
            "quality": quality_name,
            "reward": reward.name,
            "reward_type": reward.reward_type,
            "reward_value": reward.reward_value,
            "streak_days": streak.current_streak,
            "sound_file": reward.sound_file,
            "sound_volume": reward.sound_volume
        }
    
    def process_donation_drops(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None, donation_amount: float = None) -> Optional[Dict[str, Any]]:
        """Обрабатывает донатные Drops
        
        Донаты не зависят от платформы, используем общий конфиг (platform=None).
        """
        # Получаем общий конфиг (platform=None)
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=None)
        if not config or not config.donation_enabled:
            return None
        
        # Определяем качество по сумме доната
        quality_name = self._get_donation_quality(donation_amount, config)
        if not quality_name:
            return None
        
        quality = self.get_quality_by_name(quality_name)
        if not quality:
            return None
        
        # Получаем награду
        reward = self._get_random_reward(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, quality_id=quality.id)
        if not reward:
            return None
        
        # Записываем в историю
        self._record_drops_history(
            user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id, viewer_name=viewer_name,
            drops_type="donation", quality_id=quality.id, reward=reward, donation_amount=donation_amount
        )
        
        return {
            "type": "donation",
            "viewer_name": viewer_name,
            "quality": quality_name,
            "reward": reward.name,
            "reward_type": reward.reward_type,
            "reward_value": reward.reward_value,
            "donation_amount": donation_amount,
            "sound_file": reward.sound_file,
            "sound_volume": reward.sound_volume
        }
    
    def process_mythical_drops(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None) -> Optional[Dict[str, Any]]:
        """Обрабатывает мифические Drops
        
        Мифический лутбокс не зависит от платформы, используем общий конфиг (platform=None).
        """
        # Получаем общий конфиг (platform=None)
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=None)
        if not config or not config.mythical_enabled:
            return None
        
        # Проверяем, можно ли активировать мифический лутбокс
        if not self._can_activate_mythical(config):
            return None
        
        # Получаем мифическое качество
        quality = self.get_quality_by_name("Mythical")
        if not quality:
            return None
        
        # Получаем награду
        reward = self._get_random_reward(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, quality_id=quality.id)
        if not reward:
            return None
        
        # Обновляем время последнего появления
        config.mythical_last_appeared = utcnow_naive()
        self.db.commit()
        
        # Записываем в историю
        self._record_drops_history(
            user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id, viewer_name=viewer_name,
            drops_type="mythical", quality_id=quality.id, reward=reward
        )
        
        return {
            "type": "mythical",
            "viewer_name": viewer_name,
            "quality": "Mythical",
            "reward": reward.name,
            "reward_type": reward.reward_type,
            "reward_value": reward.reward_value,
            "sound_file": reward.sound_file,
            "sound_volume": reward.sound_volume
        }
    
    def _get_streak_quality(self, days: int, config: DropsConfig) -> Optional[str]:
        """Определяет качество по дням стрика"""
        if days >= config.streak_days_legendary:
            return "Legendary"
        elif days >= config.streak_days_epic:
            return "Epic"
        elif days >= config.streak_days_rare:
            return "Rare"
        elif days >= config.streak_days_common:
            return "Common"
        return None
    
    def _get_donation_quality(self, amount: float, config: DropsConfig) -> Optional[str]:
        """Определяет качество по сумме доната"""
        if amount >= config.donation_amount_legendary:
            return "Legendary"
        elif amount >= config.donation_amount_epic:
            return "Epic"
        elif amount >= config.donation_amount_rare:
            return "Rare"
        elif amount >= config.donation_amount_common:
            return "Common"
        return None
    
    def _get_random_reward(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", quality_id: int = None) -> Optional[DropsReward]:
        """Получает случайную награду по качеству с корректным взвешенным случайным выбором
        
        Args:
            user_id: ID пользователя
            session_id: ID сессии (для гостей)
            channel_name: Имя канала
            platform: Платформа (twitch/vk)
            quality_id: ID качества награды
            
        Returns:
            Случайная награда с учетом весов или None если наград нет
            
        Algorithm:
            1. Суммируем все веса: total_weight
            2. Генерируем случайное число: 0 <= random_value < total_weight
            3. Идем по наградам, суммируя их веса
            4. Когда накопленный вес > random_value, возвращаем текущую награду
            
        Example:
            Награды: A (вес 10), B (вес 30), C (вес 60)
            total_weight = 100
            random_value ∈ [0, 100)
            - 0-9 → A (10%)
            - 10-39 → B (30%)
            - 40-99 → C (60%)
        """
        rewards = self.get_rewards(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, quality_id=quality_id)
        if not rewards:
            logger.warning(f"No rewards found for quality_id={quality_id}, platform={platform}, channel={channel_name}")
            return None
        
        # ✅ ПРАВИЛЬНЫЙ взвешенный случайный выбор
        total_weight = sum(reward.weight for reward in rewards)
        if total_weight == 0:
            logger.warning(f"Total weight is 0 for rewards in channel {channel_name}, using uniform distribution")
            return random.choice(rewards)
        
        # Генерируем случайное число от 0 до total_weight (исключая total_weight)
        random_value = random.random() * total_weight  # или random.uniform(0, total_weight)
        current_weight = 0
        
        for reward in rewards:
            current_weight += reward.weight
            if random_value < current_weight:
                logger.debug(f"Selected reward '{reward.name}' (weight={reward.weight}/{total_weight}, random={random_value:.2f})")
                return reward
        
        # Fallback: возвращаем последнюю награду (математически не должно произойти)
        logger.warning(f"Fallback to last reward for channel {channel_name} (random_value={random_value}, total_weight={total_weight})")
        return rewards[-1]
    
    def _record_drops_history(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None, drops_type: str = None, quality_id: int = None, reward: DropsReward = None, **kwargs):
        """Записывает в историю Drops"""
        history_entry = DropsHistory(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
            lootbox_type=drops_type,
            quality_id=quality_id,
            reward_id=reward.id if reward else None,
            reward_name=reward.name if reward else "",
            reward_type=reward.reward_type if reward else "",
            reward_value=reward.reward_value if reward else "",
            **kwargs
        )
        
        self.db.add(history_entry)
        self.db.commit()
    
    def _can_activate_mythical(self, config: DropsConfig) -> bool:
        """Проверяет, можно ли активировать мифический лутбокс"""
        if not config.mythical_last_appeared:
            return True
        
        now = utcnow_naive()
        time_since_last = (now - config.mythical_last_appeared).total_seconds() / 3600  # в часах
        
        return time_since_last >= config.mythical_min_interval_hours
    
    def check_mythical_drops(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch") -> bool:
        """Проверяет, можно ли запустить мифический Drops
        
        ВАЖНО: 
        - Мифический drops требует подключения DonationAlerts (работает на основе донатов)
        - Активация (появление сундука) происходит только когда стрим онлайн!
        """
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform)
        if not config or not config.mythical_enabled:
            return False
        
        # ✅ ПРОВЕРКА: DonationAlerts должен быть подключен
        from core.database import UserToken
        if user_id:
            da_token = self.db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == 'donationalerts',
                UserToken.is_active == True
            ).first()
        elif session_id:
            da_token = self.db.query(UserToken).filter(
                UserToken.session_id == session_id,
                UserToken.platform == 'donationalerts',
                UserToken.is_active == True
            ).first()
        else:
            da_token = None
        
        if not da_token:
            logger.debug(f"🚫 [MYTHICAL] DonationAlerts not connected, cannot activate mythical drops for {channel_name}")
            return False
        
        # ✅ ПРОВЕРКА: Стрим должен быть онлайн для активации
        is_stream_online = self._check_stream_online(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform)
        if not is_stream_online:
            logger.debug(f"🚫 [MYTHICAL] Stream is offline, cannot activate mythical drops for {channel_name}")
            return False
        
        # Проверяем интервал
        if config.mythical_last_appeared:
            time_since_last = utcnow_naive() - config.mythical_last_appeared
            min_interval = timedelta(hours=config.mythical_min_interval_hours)
            if time_since_last < min_interval:
                return False
        
        # Случайно решаем, запускать ли
        max_interval = timedelta(hours=config.mythical_max_interval_hours)
        if config.mythical_last_appeared:
            time_since_last = utcnow_naive() - config.mythical_last_appeared
            if time_since_last > max_interval:
                return True
        else:
            return True
        
        # Случайная вероятность
        return random.random() < 0.1  # 10% шанс каждый раз
    
    def _check_stream_online(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch") -> bool:
        """Проверяет, онлайн ли стрим на указанной платформе"""
        try:
            from core.database import User, UserToken
            from core.connection_manager import get_connection_manager
            
            # Проверяем через connection_manager - если канал активен, значит стрим скорее всего онлайн
            connection_manager = get_connection_manager()
            if connection_manager.is_channel_active(channel_name):
                return True
            
            # Дополнительная проверка через API (если есть токены)
            if user_id:
                user = self.db.query(User).filter(User.id == user_id).first()
                if not user:
                    return False
                
                if platform == "twitch" and user.twitch_username:
                    # Проверяем через connection_manager
                    return connection_manager.is_channel_active(user.twitch_username.lower())
                elif platform == "vk":
                    vk_token = self.db.query(UserToken).filter(
                        UserToken.user_id == user_id,
                        UserToken.platform == 'vk',
                        UserToken.is_active == True
                    ).first()
                    if vk_token and user.vk_channel_name:
                        return connection_manager.is_channel_active(user.vk_channel_name)
            
            return False
        except Exception as e:
            logger.error(f"Error checking stream online status: {e}")
            # В случае ошибки считаем что стрим оффлайн (безопаснее)
            return False
    
    def start_mythical_drops(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch") -> Optional[MythicalDropsSession]:
        """Запускает мифический Drops
        
        ВАЖНО: 
        - Мифический drops требует подключения DonationAlerts (работает на основе донатов)
        - Активация (появление сундука) происходит только когда стрим онлайн!
        """
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform)
        if not config or not config.mythical_enabled:
            return None
        
        # ✅ ПРОВЕРКА: DonationAlerts должен быть подключен
        from core.database import UserToken
        if user_id:
            da_token = self.db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == 'donationalerts',
                UserToken.is_active == True
            ).first()
        elif session_id:
            da_token = self.db.query(UserToken).filter(
                UserToken.session_id == session_id,
                UserToken.platform == 'donationalerts',
                UserToken.is_active == True
            ).first()
        else:
            da_token = None
        
        if not da_token:
            logger.warning(f"🚫 [MYTHICAL] Cannot activate mythical drops: DonationAlerts not connected for {channel_name}")
            return None
        
        # ✅ ПРОВЕРКА: Стрим должен быть онлайн для активации
        is_stream_online = self._check_stream_online(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform)
        if not is_stream_online:
            logger.warning(f"🚫 [MYTHICAL] Cannot activate mythical drops: stream is offline for {channel_name}")
            return None
        
        # Создаем сессию
        now = utcnow_naive()
        expires_at = now + timedelta(minutes=config.mythical_window_duration_minutes)
        
        session = MythicalDropsSession(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform,
            donation_amount=config.mythical_donation_amount,
            window_duration_minutes=config.mythical_window_duration_minutes,
            expires_at=expires_at
        )
        
        self.db.add(session)
        
        # Обновляем время последнего появления
        config.mythical_last_appeared = now
        config.updated_at = now
        
        try:
            self.db.commit()
            self.db.refresh(session)
        except Exception as e:
            logger.error(f"❌ Error starting mythical drops for {channel_name}: {e}")
            self.db.rollback()
            return None
        
        return session
    
    def process_mythical_drops_with_session(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None, amount: float = None) -> Optional[Dict[str, Any]]:
        """Обрабатывает мифический Drops с активной сессией"""
        # Ищем активную сессию
        query = self.db.query(MythicalDropsSession).filter(
            MythicalDropsSession.channel_name == channel_name,
            MythicalDropsSession.platform == platform,
            MythicalDropsSession.is_active == True,
            MythicalDropsSession.expires_at > utcnow_naive()
        )
        
        if user_id:
            query = query.filter(MythicalDropsSession.user_id == user_id)
        elif session_id:
            query = query.filter(MythicalDropsSession.session_id == session_id)
        else:
            return None
        
        session = query.first()
        
        if not session or amount < session.donation_amount:
            return None
        
        # Получаем награду Legendary
        quality = self.get_quality_by_name("Legendary")
        if not quality:
            return None
        
        reward = self._get_random_reward(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, quality_id=quality.id)
        if not reward:
            return None
        
        # Записываем в историю
        self._record_drops_history(
            user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id, viewer_name=viewer_name,
            drops_type="mythical", quality_id=quality.id, reward=reward, donation_amount=amount
        )
        
        # Закрываем сессию
        session.is_active = False
        session.winner_viewer_id = viewer_id
        session.winner_viewer_name = viewer_name
        session.winner_donation_amount = amount
        
        self.db.commit()
        
        return {
            "type": "mythical",
            "viewer_name": viewer_name,
            "quality": "Legendary",
            "reward": reward.name,
            "reward_type": reward.reward_type,
            "reward_value": reward.reward_value,
            "sound_file": reward.sound_file,
            "sound_volume": reward.sound_volume,
            "donation_amount": amount
        }
    
    def get_drops_history(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", limit: int = 50, offset: int = 0) -> List[DropsHistory]:
        """Получает историю Drops"""
        query = self.db.query(DropsHistory).filter(
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        )
        
        if user_id:
            query = query.filter(DropsHistory.user_id == user_id)
        elif session_id:
            query = query.filter(DropsHistory.session_id == session_id)
        else:
            return []
        
        return query.order_by(DropsHistory.created_at.desc()).offset(offset).limit(limit).all()
    
    def get_drops_stats(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch") -> Dict[str, Any]:
        """Получает статистику Drops"""
        query = self.db.query(DropsHistory).filter(
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        )
        
        if user_id:
            query = query.filter(DropsHistory.user_id == user_id)
        elif session_id:
            query = query.filter(DropsHistory.session_id == session_id)
        else:
            return {
                "totalDrops": 0,
                "todayDrops": 0,
                "legendaryDrops": 0,
                "mythicalDrops": 0
            }
        
        total_drops = query.count()
        
        today = utcnow_naive().date()
        today_drops = query.filter(DropsHistory.created_at >= today).count()
        
        legendary_drops = query.join(DropsQuality).filter(DropsQuality.name == "Legendary").count()
        
        mythical_drops = query.filter(DropsHistory.lootbox_type == "mythical").count()
        
        return {
            "totalDrops": total_drops,
            "todayDrops": today_drops,
            "legendaryDrops": legendary_drops,
            "mythicalDrops": mythical_drops
        }
