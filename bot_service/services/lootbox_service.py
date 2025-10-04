# services/lootbox_service.py
import logging
import random
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from core.database import (
    ChatMessage, UserProgression, Achievement, UserAchievement, 
    Lootbox, LootboxReward, LootboxOpening, DonationAlert, User
)

logger = logging.getLogger(__name__)

class LootboxService:
    """Сервис для управления системой лутбоксов и геймификации"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # === УПРАВЛЕНИЕ АКТИВНОСТЬЮ ===
    
    def record_chat_message(self, user_id: int, channel_name: str, platform: str, message: str):
        """Записывает сообщение в чат для отслеживания активности"""
        try:
            chat_message = ChatMessage(
                user_id=user_id,
                channel_name=channel_name,
                platform=platform,
                message=message
            )
            self.db.add(chat_message)
            self.db.commit()
            
            # Обновляем прогрессию пользователя
            self._update_user_progression(user_id, channel_name, platform)
            
        except Exception as e:
            logger.error(f"Error recording chat message: {e}")
            self.db.rollback()
    
    def _update_user_progression(self, user_id: int, channel_name: str, platform: str):
        """Обновляет прогрессию пользователя"""
        try:
            progression = self.db.query(UserProgression).filter(
                and_(
                    UserProgression.user_id == user_id,
                    UserProgression.channel_name == channel_name,
                    UserProgression.platform == platform
                )
            ).first()
            
            today = datetime.utcnow().date()
            
            if not progression:
                # Создаем новую запись прогрессии
                progression = UserProgression(
                    user_id=user_id,
                    channel_name=channel_name,
                    platform=platform,
                    total_days_active=1,
                    current_streak=1,
                    longest_streak=1,
                    last_activity_date=today,
                    total_messages=1
                )
                self.db.add(progression)
            else:
                # Обновляем существующую запись
                progression.total_messages += 1
                
                if progression.last_activity_date != today:
                    # Новый день активности
                    if progression.last_activity_date == (today - timedelta(days=1)):
                        # Продолжаем серию
                        progression.current_streak += 1
                    else:
                        # Сброс серии
                        progression.current_streak = 1
                    
                    progression.total_days_active += 1
                    progression.longest_streak = max(progression.longest_streak, progression.current_streak)
                    progression.last_activity_date = today
                
                progression.updated_at = datetime.utcnow()
            
            self.db.commit()
            
            # Проверяем достижения
            self._check_achievements(user_id, channel_name, platform, progression)
            
        except Exception as e:
            logger.error(f"Error updating user progression: {e}")
            self.db.rollback()
    
    def _check_achievements(self, user_id: int, channel_name: str, platform: str, progression: UserProgression):
        """Проверяет и выдает достижения пользователю"""
        try:
            # Получаем все активные достижения для канала
            achievements = self.db.query(Achievement).filter(
                and_(
                    Achievement.channel_name == channel_name,
                    Achievement.is_active == True
                )
            ).all()
            
            for achievement in achievements:
                # Проверяем, не получил ли уже пользователь это достижение
                existing = self.db.query(UserAchievement).filter(
                    and_(
                        UserAchievement.user_id == user_id,
                        UserAchievement.achievement_id == achievement.id,
                        UserAchievement.channel_name == channel_name
                    )
                ).first()
                
                if existing:
                    continue
                
                # Проверяем условия достижения
                if self._check_achievement_condition(achievement, progression):
                    # Выдаем достижение
                    user_achievement = UserAchievement(
                        user_id=user_id,
                        achievement_id=achievement.id,
                        channel_name=channel_name
                    )
                    self.db.add(user_achievement)
                    
                    # Выдаем награду
                    self._give_achievement_reward(user_id, channel_name, achievement)
                    
                    logger.info(f"User {user_id} earned achievement: {achievement.name}")
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Error checking achievements: {e}")
            self.db.rollback()
    
    def _check_achievement_condition(self, achievement: Achievement, progression: UserProgression) -> bool:
        """Проверяет условие достижения"""
        if achievement.type == "daily_streak":
            return progression.current_streak >= achievement.requirement_value
        elif achievement.type == "total_days":
            return progression.total_days_active >= achievement.requirement_value
        elif achievement.type == "total_messages":
            return progression.total_messages >= achievement.requirement_value
        elif achievement.type == "total_donated":
            return progression.total_donated >= achievement.requirement_value
        elif achievement.type == "longest_streak":
            return progression.longest_streak >= achievement.requirement_value
        
        return False
    
    def _give_achievement_reward(self, user_id: int, channel_name: str, achievement: Achievement):
        """Выдает награду за достижение"""
        if achievement.reward_type == "free_lootbox":
            # Выдаем бесплатный лутбокс
            self.give_free_lootbox(user_id, channel_name, achievement.reward_value)
        elif achievement.reward_type == "paid_lootbox":
            # Выдаем платный лутбокс
            self.give_paid_lootbox(user_id, channel_name, achievement.reward_value)
    
    # === УПРАВЛЕНИЕ ЛУТБОКСАМИ ===
    
    def give_free_lootbox(self, user_id: int, channel_name: str, count: int = 1):
        """Выдает бесплатный лутбокс пользователю"""
        try:
            # Находим бесплатный лутбокс для канала
            lootbox = self.db.query(Lootbox).filter(
                and_(
                    Lootbox.channel_name == channel_name,
                    Lootbox.type == "free",
                    Lootbox.is_active == True
                )
            ).first()
            
            if not lootbox:
                logger.warning(f"No free lootbox found for channel {channel_name}")
                return False
            
            # Обновляем статистику пользователя
            progression = self.db.query(UserProgression).filter(
                and_(
                    UserProgression.user_id == user_id,
                    UserProgression.channel_name == channel_name
                )
            ).first()
            
            if progression:
                progression.free_lootboxes_opened += count
                progression.updated_at = datetime.utcnow()
            
            self.db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error giving free lootbox: {e}")
            self.db.rollback()
            return False
    
    def give_paid_lootbox(self, user_id: int, channel_name: str, count: int = 1):
        """Выдает платный лутбокс пользователю"""
        try:
            # Находим платный лутбокс для канала
            lootbox = self.db.query(Lootbox).filter(
                and_(
                    Lootbox.channel_name == channel_name,
                    Lootbox.type == "paid",
                    Lootbox.is_active == True
                )
            ).first()
            
            if not lootbox:
                logger.warning(f"No paid lootbox found for channel {channel_name}")
                return False
            
            # Обновляем статистику пользователя
            progression = self.db.query(UserProgression).filter(
                and_(
                    UserProgression.user_id == user_id,
                    UserProgression.channel_name == channel_name
                )
            ).first()
            
            if progression:
                progression.paid_lootboxes_opened += count
                progression.updated_at = datetime.utcnow()
            
            self.db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error giving paid lootbox: {e}")
            self.db.rollback()
            return False
    
    def open_lootbox(self, user_id: int, channel_name: str, lootbox_id: int) -> Optional[Dict]:
        """Открывает лутбокс и возвращает награду"""
        try:
            # Получаем лутбокс
            lootbox = self.db.query(Lootbox).filter(
                and_(
                    Lootbox.id == lootbox_id,
                    Lootbox.channel_name == channel_name,
                    Lootbox.is_active == True
                )
            ).first()
            
            if not lootbox:
                return None
            
            # Получаем награды лутбокса
            rewards = self.db.query(LootboxReward).filter(
                and_(
                    LootboxReward.lootbox_id == lootbox_id,
                    LootboxReward.is_active == True
                )
            ).all()
            
            if not rewards:
                return None
            
            # Выбираем случайную награду на основе весов
            total_weight = sum(reward.weight for reward in rewards)
            random_value = random.randint(1, total_weight)
            
            current_weight = 0
            selected_reward = None
            
            for reward in rewards:
                current_weight += reward.weight
                if random_value <= current_weight:
                    selected_reward = reward
                    break
            
            if not selected_reward:
                selected_reward = rewards[0]  # Fallback
            
            # Записываем открытие лутбокса
            opening = LootboxOpening(
                user_id=user_id,
                lootbox_id=lootbox_id,
                channel_name=channel_name,
                reward_id=selected_reward.id
            )
            self.db.add(opening)
            self.db.commit()
            
            # Формируем результат
            result = {
                "opening_id": opening.id,
                "lootbox_name": lootbox.name,
                "reward": {
                    "id": selected_reward.id,
                    "name": selected_reward.name,
                    "description": selected_reward.description,
                    "type": selected_reward.type,
                    "value": json.loads(selected_reward.value) if selected_reward.value else {}
                },
                "opened_at": opening.opened_at.isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error opening lootbox: {e}")
            self.db.rollback()
            return None
    
    def get_user_progression(self, user_id: int, channel_name: str) -> Optional[Dict]:
        """Получает прогрессию пользователя"""
        try:
            progression = self.db.query(UserProgression).filter(
                and_(
                    UserProgression.user_id == user_id,
                    UserProgression.channel_name == channel_name
                )
            ).first()
            
            if not progression:
                return None
            
            # Получаем достижения пользователя
            achievements = self.db.query(UserAchievement, Achievement).join(
                Achievement, UserAchievement.achievement_id == Achievement.id
            ).filter(
                and_(
                    UserAchievement.user_id == user_id,
                    UserAchievement.channel_name == channel_name
                )
            ).all()
            
            return {
                "user_id": user_id,
                "channel_name": channel_name,
                "platform": progression.platform,
                "total_days_active": progression.total_days_active,
                "current_streak": progression.current_streak,
                "longest_streak": progression.longest_streak,
                "total_messages": progression.total_messages,
                "total_donated": progression.total_donated,
                "total_donations_count": progression.total_donations_count,
                "free_lootboxes_opened": progression.free_lootboxes_opened,
                "paid_lootboxes_opened": progression.paid_lootboxes_opened,
                "achievements": [
                    {
                        "id": achievement.id,
                        "name": achievement.name,
                        "description": achievement.description,
                        "earned_at": user_achievement.earned_at.isoformat(),
                        "is_claimed": user_achievement.is_claimed
                    }
                    for user_achievement, achievement in achievements
                ],
                "last_activity": progression.last_activity_date.isoformat() if progression.last_activity_date else None
            }
            
        except Exception as e:
            logger.error(f"Error getting user progression: {e}")
            return None
    
    def get_channel_progression(self, channel_name: str) -> Optional[Dict]:
        """Получает общую статистику канала"""
        try:
            # Получаем общую статистику канала
            total_users = self.db.query(UserProgression).filter(
                UserProgression.channel_name == channel_name
            ).count()
            
            total_messages = self.db.query(ChatMessage).filter(
                ChatMessage.channel_name == channel_name
            ).count()
            
            total_donations = self.db.query(DonationAlert).filter(
                DonationAlert.channel_name == channel_name
            ).count()
            
            total_lootboxes_opened = self.db.query(LootboxOpening).join(
                Lootbox, LootboxOpening.lootbox_id == Lootbox.id
            ).filter(
                Lootbox.channel_name == channel_name
            ).count()
            
            return {
                "channel_name": channel_name,
                "total_users": total_users,
                "total_messages": total_messages,
                "total_donations": total_donations,
                "total_lootboxes_opened": total_lootboxes_opened,
                "message": "Channel statistics loaded successfully"
            }
            
        except Exception as e:
            logger.error(f"Error getting channel progression: {e}")
            return None
    
    def get_channel_lootboxes(self, channel_name: str) -> List[Dict]:
        """Получает лутбоксы канала"""
        try:
            lootboxes = self.db.query(Lootbox).filter(
                and_(
                    Lootbox.channel_name == channel_name,
                    Lootbox.is_active == True
                )
            ).all()
            
            result = []
            for lootbox in lootboxes:
                # Получаем награды лутбокса
                rewards = self.db.query(LootboxReward).filter(
                    and_(
                        LootboxReward.lootbox_id == lootbox.id,
                        LootboxReward.is_active == True
                    )
                ).all()
                
                result.append({
                    "id": lootbox.id,
                    "name": lootbox.name,
                    "description": lootbox.description,
                    "type": lootbox.type,
                    "price": lootbox.price,
                    "rewards": [
                        {
                            "id": reward.id,
                            "name": reward.name,
                            "description": reward.description,
                            "type": reward.type,
                            "weight": reward.weight
                        }
                        for reward in rewards
                    ]
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting channel lootboxes: {e}")
            return []
    
    def get_recent_openings(self, channel_name: str, limit: int = 10) -> List[Dict]:
        """Получает последние открытия лутбоксов в канале"""
        try:
            openings = self.db.query(LootboxOpening, LootboxReward, User).join(
                LootboxReward, LootboxOpening.reward_id == LootboxReward.id
            ).join(
                User, LootboxOpening.user_id == User.id
            ).filter(
                LootboxOpening.channel_name == channel_name
            ).order_by(desc(LootboxOpening.opened_at)).limit(limit).all()
            
            result = []
            for opening, reward, user in openings:
                result.append({
                    "id": opening.id,
                    "user_name": user.display_name or user.username,
                    "reward_name": reward.name,
                    "reward_description": reward.description,
                    "opened_at": opening.opened_at.isoformat(),
                    "is_obs_animated": opening.is_obs_animated
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting recent openings: {e}")
            return []
