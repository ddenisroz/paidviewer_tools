# services/drops_service.py
import logging
import json
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from core.database import DropsConfig, DropsReward, DropsQuality, UserStreak, DropsHistory, MythicalDropsSession
from core.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

class DropsService:
    """Сервис для управления системой Drops"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_config(self, user_id: int, channel_name: str, platform: str = "twitch") -> Optional[DropsConfig]:
        """Получает конфигурацию Drops для канала"""
        return self.db.query(DropsConfig).filter(
            DropsConfig.user_id == user_id,
            DropsConfig.channel_name == channel_name,
            DropsConfig.platform == platform
        ).first()
    
    def create_or_update_config(self, user_id: int, channel_name: str, platform: str, config_data: Dict[str, Any]) -> DropsConfig:
        """Создает или обновляет конфигурацию Drops"""
        config = self.get_config(user_id, channel_name, platform)
        
        if not config:
            config = DropsConfig(
                user_id=user_id,
                channel_name=channel_name,
                platform=platform
            )
            self.db.add(config)
        
        # Обновляем поля
        for field, value in config_data.items():
            if hasattr(config, field):
                setattr(config, field, value)
        
        config.updated_at = utcnow_naive()
        self.db.commit()
        self.db.refresh(config)
        
        return config
    
    def get_rewards(self, user_id: int, channel_name: str, platform: str, quality_id: Optional[int] = None) -> List[DropsReward]:
        """Получает награды для канала"""
        query = self.db.query(DropsReward).filter(
            DropsReward.user_id == user_id,
            DropsReward.channel_name == channel_name,
            DropsReward.platform == platform,
            DropsReward.is_active == True
        )
        
        if quality_id:
            query = query.filter(DropsReward.quality_id == quality_id)
        
        return query.all()
    
    def get_quality_by_name(self, quality_name: str) -> Optional[DropsQuality]:
        """Получает качество по имени"""
        return self.db.query(DropsQuality).filter(DropsQuality.name == quality_name).first()
    
    def get_user_streak(self, user_id: int, channel_name: str, platform: str, viewer_id: str) -> Optional[UserStreak]:
        """Получает стрик пользователя"""
        return self.db.query(UserStreak).filter(
            UserStreak.user_id == user_id,
            UserStreak.channel_name == channel_name,
            UserStreak.platform == platform,
            UserStreak.viewer_id == viewer_id
        ).first()
    
    def update_user_streak(self, user_id: int, channel_name: str, platform: str, viewer_id: str, viewer_name: str, is_streaming: bool = True) -> UserStreak:
        """Обновляет стрик пользователя"""
        streak = self.get_user_streak(user_id, channel_name, platform, viewer_id)
        
        if not streak:
            streak = UserStreak(
                user_id=user_id,
                channel_name=channel_name,
                platform=platform,
                viewer_id=viewer_id,
                viewer_name=viewer_name
            )
            self.db.add(streak)
        
        now = utcnow_naive()
        
        # Проверяем, был ли пользователь активен в последние 24 часа
        if streak.last_activity and (now - streak.last_activity).total_seconds() < 24 * 3600:
            # Продолжаем стрик
            if is_streaming:
                streak.current_streak += 1
                streak.max_streak = max(streak.max_streak, streak.current_streak)
        else:
            # Стрик прерван или новый день
            if is_streaming:
                streak.current_streak = 1
            else:
                streak.current_streak = 0
        
        streak.last_activity = now
        streak.updated_at = now
        
        self.db.commit()
        self.db.refresh(streak)
        
        return streak
    
    def process_streak_drops(self, user_id: int, channel_name: str, platform: str, viewer_id: str, viewer_name: str) -> Optional[Dict[str, Any]]:
        """Обрабатывает стрик Drops"""
        config = self.get_config(user_id, channel_name, platform)
        if not config or not config.streak_enabled:
            return None
        
        # Обновляем стрик
        streak = self.update_user_streak(user_id, channel_name, platform, viewer_id, viewer_name)
        
        # Определяем качество по дням стрика
        quality_name = self._get_streak_quality(streak.current_streak, config)
        if not quality_name:
            return None
        
        quality = self.get_quality_by_name(quality_name)
        if not quality:
            return None
        
        # Получаем награду
        reward = self._get_random_reward(user_id, channel_name, platform, quality.id)
        if not reward:
            return None
        
        # Записываем в историю
        self._record_drops_history(
            user_id, channel_name, platform, viewer_id, viewer_name,
            "streak", quality.id, reward, streak_days=streak.current_streak
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
    
    def process_donation_drops(self, user_id: int, channel_name: str, platform: str, viewer_id: str, viewer_name: str, donation_amount: float) -> Optional[Dict[str, Any]]:
        """Обрабатывает донатные Drops"""
        config = self.get_config(user_id, channel_name, platform)
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
        reward = self._get_random_reward(user_id, channel_name, platform, quality.id)
        if not reward:
            return None
        
        # Записываем в историю
        self._record_drops_history(
            user_id, channel_name, platform, viewer_id, viewer_name,
            "donation", quality.id, reward, donation_amount=donation_amount
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
    
    def process_mythical_drops(self, user_id: int, channel_name: str, platform: str, viewer_id: str, viewer_name: str) -> Optional[Dict[str, Any]]:
        """Обрабатывает мифические Drops"""
        config = self.get_config(user_id, channel_name, platform)
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
        reward = self._get_random_reward(user_id, channel_name, platform, quality.id)
        if not reward:
            return None
        
        # Обновляем время последнего появления
        config.mythical_last_appeared = utcnow_naive()
        self.db.commit()
        
        # Записываем в историю
        self._record_drops_history(
            user_id, channel_name, platform, viewer_id, viewer_name,
            "mythical", quality.id, reward
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
    
    def _get_random_reward(self, user_id: int, channel_name: str, platform: str, quality_id: int) -> Optional[DropsReward]:
        """Получает случайную награду по качеству"""
        rewards = self.get_rewards(user_id, channel_name, platform, quality_id)
        if not rewards:
            return None
        
        # Взвешенный случайный выбор
        total_weight = sum(reward.weight for reward in rewards)
        if total_weight == 0:
            return None
        
        random_value = random.randint(1, total_weight)
        current_weight = 0
        
        for reward in rewards:
            current_weight += reward.weight
            if random_value <= current_weight:
                return reward
        
        return rewards[0]  # Fallback
    
    def _record_drops_history(self, user_id: int, channel_name: str, platform: str, viewer_id: str, viewer_name: str, drops_type: str, quality_id: int, reward: DropsReward, **kwargs):
        """Записывает в историю Drops"""
        history_entry = DropsHistory(
            user_id=user_id,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
            drops_type=drops_type,
            quality_id=quality_id,
            reward_id=reward.id,
            reward_name=reward.name,
            reward_type=reward.reward_type,
            reward_value=reward.reward_value,
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
    
    def check_mythical_drops(self, user_id: int, channel_name: str, platform: str) -> bool:
        """Проверяет, можно ли запустить мифический Drops"""
        config = self.get_config(user_id, channel_name, platform)
        if not config or not config.mythical_enabled:
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
    
    def start_mythical_drops(self, user_id: int, channel_name: str, platform: str) -> Optional[MythicalDropsSession]:
        """Запускает мифический Drops"""
        config = self.get_config(user_id, channel_name, platform)
        if not config:
            return None
        
        # Создаем сессию
        now = utcnow_naive()
        expires_at = now + timedelta(minutes=config.mythical_window_duration_minutes)
        
        session = MythicalDropsSession(
            user_id=user_id,
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
        
        self.db.commit()
        self.db.refresh(session)
        
        return session
    
    def process_mythical_drops(self, user_id: int, channel_name: str, platform: str, viewer_id: str, viewer_name: str, amount: float) -> Optional[Dict[str, Any]]:
        """Обрабатывает мифический Drops"""
        # Ищем активную сессию
        session = self.db.query(MythicalDropsSession).filter(
            MythicalDropsSession.user_id == user_id,
            MythicalDropsSession.channel_name == channel_name,
            MythicalDropsSession.platform == platform,
            MythicalDropsSession.is_active == True,
            MythicalDropsSession.expires_at > utcnow_naive()
        ).first()
        
        if not session or amount < session.donation_amount:
            return None
        
        # Получаем награду Legendary
        quality = self.get_quality_by_name("Legendary")
        if not quality:
            return None
        
        reward = self._get_random_reward(user_id, channel_name, platform, quality.id)
        if not reward:
            return None
        
        # Записываем в историю
        self._record_drops_history(
            user_id, channel_name, platform, viewer_id, viewer_name,
            "mythical", quality.id, reward, donation_amount=amount
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
    
    def _get_random_reward(self, user_id: int, channel_name: str, platform: str, quality_id: int) -> Optional[DropsReward]:
        """Получает случайную награду по качеству"""
        rewards = self.get_rewards(user_id, channel_name, platform, quality_id)
        if not rewards:
            return None
        
        # Взвешенный случайный выбор
        total_weight = sum(reward.weight for reward in rewards)
        if total_weight == 0:
            return random.choice(rewards)
        
        random_value = random.randint(1, total_weight)
        current_weight = 0
        
        for reward in rewards:
            current_weight += reward.weight
            if random_value <= current_weight:
                return reward
        
        return rewards[0]  # Fallback
    
    def _record_drops_history(self, user_id: int, channel_name: str, platform: str, viewer_id: str, viewer_name: str, 
                            drops_type: str, quality_id: int, reward: DropsReward, **kwargs):
        """Записывает Drops в историю"""
        history = DropsHistory(
            user_id=user_id,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
            lootbox_type=drops_type,
            quality_id=quality_id,
            reward_id=reward.id,
            reward_name=reward.name,
            reward_type=reward.reward_type,
            reward_value=reward.reward_value,
            **kwargs
        )
        
        self.db.add(history)
        self.db.commit()
    
    def get_drops_history(self, user_id: int, channel_name: str, platform: str, limit: int = 50, offset: int = 0) -> List[DropsHistory]:
        """Получает историю Drops"""
        return self.db.query(DropsHistory).filter(
            DropsHistory.user_id == user_id,
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        ).order_by(DropsHistory.created_at.desc()).offset(offset).limit(limit).all()
    
    def get_drops_stats(self, user_id: int, channel_name: str, platform: str) -> Dict[str, Any]:
        """Получает статистику Drops"""
        total_drops = self.db.query(DropsHistory).filter(
            DropsHistory.user_id == user_id,
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        ).count()
        
        today = utcnow_naive().date()
        today_drops = self.db.query(DropsHistory).filter(
            DropsHistory.user_id == user_id,
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform,
            DropsHistory.created_at >= today
        ).count()
        
        legendary_drops = self.db.query(DropsHistory).join(DropsQuality).filter(
            DropsHistory.user_id == user_id,
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform,
            DropsQuality.name == "Legendary"
        ).count()
        
        mythical_drops = self.db.query(DropsHistory).filter(
            DropsHistory.user_id == user_id,
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform,
            DropsHistory.lootbox_type == "mythical"
        ).count()
        
        return {
            "totalDrops": total_drops,
            "todayDrops": today_drops,
            "legendaryDrops": legendary_drops,
            "mythicalDrops": mythical_drops
        }
