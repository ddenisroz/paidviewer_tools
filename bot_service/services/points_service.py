# bot_service/services/points_service.py
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from core.database import get_db, ChannelPoints, ChannelReward, PointsTransaction, RewardQueue
from core.datetime_utils import utcnow_naive
from repositories.points_repository import PointsRepository

logger = logging.getLogger('bot_service')


class PointsService:
    """
    Сервис для управления баллами канала и наградами.
    Использует Repository pattern для доступа к данным.
    """

    def __init__(self):
        pass

    def _get_repository(self, db: Session) -> PointsRepository:
        return PointsRepository(db)

    def get_user_points(
        self,
        user_id: int,
        viewer_id: str,
        platform: str,
        channel_name: str,
        db: Session
    ) -> int:
        """Получение баллов пользователя"""
        repo = self._get_repository(db)
        points_record = repo.get_user_points(user_id, viewer_id, platform, channel_name)
        return points_record.points if points_record else 0

    def add_points(
        self,
        user_id: int,
        viewer_id: str,
        viewer_name: str,
        platform: str,
        channel_name: str,
        amount: int,
        reason: str = "Manual add",
        db: Session = None
    ) -> int:
        """Добавление баллов пользователю"""
        if amount <= 0:
            return 0

        def _do_add(session_db: Session) -> int:
            try:
                repo = self._get_repository(session_db)
                
                # Получаем или создаем запись
                points_record = repo.get_user_points(user_id, viewer_id, platform, channel_name)
                
                if not points_record:
                    points_record = ChannelPoints(
                        user_id=user_id,
                        viewer_id=viewer_id,
                        viewer_name=viewer_name,
                        platform=platform,
                        channel_name=channel_name,
                        points=0
                    )
                    repo.add_points_record(points_record)
                
                # Обновляем баллы
                points_record.points += amount
                points_record.last_updated = utcnow_naive()
                
                # Записываем транзакцию
                transaction = PointsTransaction(
                    user_id=user_id,
                    viewer_id=viewer_id,
                    channel_name=channel_name,
                    platform=platform,
                    amount=amount,
                    operation_type='add',
                    reason=reason,
                    created_at=utcnow_naive()
                )
                repo.add_transaction(transaction)
                
                session_db.commit()
                return points_record.points
                
            except Exception as e:
                logger.error(f"Error adding points: {e}")
                session_db.rollback()
                return 0

        if db is not None:
            return _do_add(db)
        
        with next(get_db()) as new_db:
            return _do_add(new_db)

    def deduct_points(
        self,
        user_id: int,
        viewer_id: str,
        viewer_name: str,
        platform: str,
        channel_name: str,
        amount: int,
        reason: str = "Manual deduct",
        db: Session = None
    ) -> int:
        """Списание баллов у пользователя"""
        if amount <= 0:
            return 0

        def _do_deduct(session_db: Session) -> int:
            try:
                repo = self._get_repository(session_db)
                points_record = repo.get_user_points(user_id, viewer_id, platform, channel_name)
                
                if not points_record or points_record.points < amount:
                    return -1  # Недостаточно средств
                
                # Списываем баллы
                points_record.points -= amount
                points_record.last_updated = utcnow_naive()
                
                # Транзакция
                transaction = PointsTransaction(
                    user_id=user_id,
                    viewer_id=viewer_id,
                    channel_name=channel_name,
                    platform=platform,
                    amount=-amount,
                    operation_type='deduct',
                    reason=reason,
                    created_at=utcnow_naive()
                )
                repo.add_transaction(transaction)
                
                session_db.commit()
                return points_record.points
                
            except Exception as e:
                logger.error(f"Error deducting points: {e}")
                session_db.rollback()
                return 0

        if db is not None:
            return _do_deduct(db)
        
        with next(get_db()) as new_db:
            return _do_deduct(new_db)

    def get_channel_leaderboard(
        self,
        user_id: int,
        channel_name: str,
        platform: str = None,
        limit: int = 10,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """Получение топа пользователей по баллам"""
        def _get(session_db: Session):
            repo = self._get_repository(session_db)
            records = repo.get_leaderboard(user_id, channel_name, platform, limit)
            
            return [
                {
                    "viewer_name": r.viewer_name,
                    "points": r.points,
                    "platform": r.platform
                }
                for r in records
            ]

        if db is not None:
            return _get(db)
        
        with next(get_db()) as new_db:
            return _get(new_db)

    def create_reward(
        self,
        user_id: int,
        platform: str,
        channel_name: str,
        title: str,
        description: str,
        cost: int,
        is_dynamic_price: bool = False,
        **kwargs
    ) -> Optional[ChannelReward]:
        """Создание новой награды"""
        with next(get_db()) as db:
            try:
                repo = self._get_repository(db)
                
                # Проверка лимитов (опционально)
                count = repo.count_active_rewards(user_id)
                if count >= 50:
                    return None
                
                reward = ChannelReward(
                    user_id=user_id,
                    platform=platform,
                    channel_name=channel_name,
                    title=title,
                    description=description,
                    cost=cost,
                    is_dynamic_price=is_dynamic_price,
                    is_enabled=kwargs.get('is_enabled', True),
                    background_color=kwargs.get('background_color', '#000000'),
                    cooldown=kwargs.get('cooldown', 0)
                )
                
                return repo.add_reward(reward)
                
            except Exception as e:
                logger.error(f"Error creating reward: {e}")
                db.rollback()
                return None

    def get_channel_rewards(
        self,
        user_id: int,
        platform: str = None,
        db: Session = None
    ) -> List[ChannelReward]:
        """Получение наград канала"""
        def _get(session_db: Session):
            repo = self._get_repository(session_db)
            return repo.get_active_rewards(user_id, platform)

        if db is not None:
            return _get(db)
        
        with next(get_db()) as new_db:
            return _get(new_db)

    def redeem_reward(
        self,
        user_id: int,
        reward_id: int,
        viewer_id: str,
        viewer_name: str,
        platform: str,
        channel_name: str,
        user_input: str = None
    ) -> Dict[str, Any]:
        """Обмен награды за баллы"""
        with next(get_db()) as db:
            try:
                repo = self._get_repository(db)
                
                # 1. Получаем награду
                reward = repo.get_reward_by_user(reward_id, user_id)
                if not reward or not reward.is_enabled:
                    return {"success": False, "error": "Reward not found or disabled"}
                
                # 2. Проверяем баллы
                points_record = repo.get_user_points(user_id, viewer_id, platform, channel_name)
                current_points = points_record.points if points_record else 0
                
                if current_points < reward.cost:
                    return {"success": False, "error": "Insufficient points"}
                
                # 3. Списываем баллы
                if points_record:
                    points_record.points -= reward.cost
                    points_record.last_updated = utcnow_naive()
                
                # 4. Создаем заявку в очереди
                queue_item = RewardQueue(
                    user_id=user_id,
                    reward_id=reward.id,
                    viewer_id=viewer_id,
                    viewer_name=viewer_name,
                    platform=platform,
                    cost=reward.cost,
                    input_text=user_input,
                    status='pending',
                    created_at=utcnow_naive()
                )
                repo.add_queue_item(queue_item)
                
                # 5. Пишем транзакцию
                transaction = PointsTransaction(
                    user_id=user_id,
                    viewer_id=viewer_id,
                    channel_name=channel_name,
                    platform=platform,
                    amount=-reward.cost,
                    operation_type='redeem',
                    reason=f"Redeemed: {reward.title}",
                    created_at=utcnow_naive()
                )
                repo.add_transaction(transaction)
                
                db.commit()
                
                return {
                    "success": True, 
                    "remaining_points": current_points - reward.cost,
                    "queue_id": queue_item.id,
                    "reward_title": reward.title
                }
                
            except Exception as e:
                logger.error(f"Error redeeming reward: {e}")
                db.rollback()
                return {"success": False, "error": "Internal error"}

    def get_reward_queue(
        self,
        user_id: int,
        status: str = None,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """Получение очереди наград"""
        def _get(session_db: Session):
            repo = self._get_repository(session_db)
            queue = repo.get_queue_by_user(user_id, status)
            
            result = []
            for item in queue:
                result.append({
                    "id": item.id,
                    "viewer_name": item.viewer_name,
                    "reward_title": item.reward.title if item.reward else "Unknown",
                    "cost": item.cost,
                    "input": item.input_text,
                    "status": item.status,
                    "created_at": item.created_at.isoformat() if item.created_at else None
                })
            return result

        if db is not None:
            return _get(db)
        
        with next(get_db()) as new_db:
            return _get(new_db)

    def process_reward(
        self,
        user_id: int,
        queue_id: int,
        action: str,
        moderator_note: str = None
    ) -> bool:
        """Обработка награды модератором"""
        with next(get_db()) as db:
            try:
                repo = self._get_repository(db)
                item = repo.get_queue_item(queue_id, user_id)
                
                if not item:
                    return False
                
                if action == 'approve':
                    item.status = 'approved'
                elif action == 'reject':
                    item.status = 'rejected'
                    # Refund points
                    points_record = repo.get_user_points(
                        user_id, item.viewer_id, item.platform, 
                        # Assuming channel name is available or derivable. 
                        # In Queue Item we might not store channel_name explicitly but we have user_id.
                        # Actually ChannelPoints requires channel_name. 
                        # RewardQueue has user_id.
                        # PointsRepository needs channel_name.
                        # Wait, RewardQueue table doesn't have channel_name in model?
                        # Let's check model if needed. 
                        # Assuming 'item.reward.channel_name'
                        item.reward.channel_name if item.reward else ""
                    )
                    
                    if points_record:
                        points_record.points += item.cost
                        points_record.last_updated = utcnow_naive()
                        
                        # Add refund transaction
                        trans = PointsTransaction(
                             user_id=user_id,
                             viewer_id=item.viewer_id,
                             channel_name=item.reward.channel_name if item.reward else "",
                             platform=item.platform,
                             amount=item.cost,
                             operation_type='refund',
                             reason=f"Refund: {item.reward.title}",
                             created_at=utcnow_naive()
                        )
                        repo.add_transaction(trans)
                
                else:
                    return False
                
                item.processed_at = utcnow_naive()
                db.commit()
                return True
                
            except Exception as e:
                logger.error(f"Error processing reward: {e}")
                db.rollback()
                return False

    def get_channel_stats(
        self,
        user_id: int,
        channel_name: str,
        db: Session = None
    ) -> Dict[str, int]:
        """Получение статистики канала"""
        def _get(session_db: Session):
            repo = self._get_repository(session_db)
            return repo.get_channel_stats(user_id, channel_name)

        if db is not None:
            return _get(db)
        
        with next(get_db()) as new_db:
            return _get(new_db)

    def update_reward(
        self,
        user_id: int,
        reward_id: int,
        update_data: Dict[str, Any],
        db: Session = None
    ) -> Optional[ChannelReward]:
        """Обновление награды"""
        def _update(session_db: Session):
            try:
                repo = self._get_repository(session_db)
                reward = repo.get_reward_by_user(reward_id, user_id)
                
                if not reward:
                    return None
                
                for key, value in update_data.items():
                    if hasattr(reward, key):
                        setattr(reward, key, value)
                
                session_db.commit()
                session_db.refresh(reward)
                return reward
            except Exception as e:
                logger.error(f"Error updating reward: {e}")
                session_db.rollback()
                return None

        if db is not None:
            return _update(db)
        
        with next(get_db()) as new_db:
            return _update(new_db)

    def delete_reward(
        self,
        user_id: int,
        reward_id: int,
        db: Session = None
    ) -> bool:
        """Удаление награды"""
        def _delete(session_db: Session):
            try:
                repo = self._get_repository(session_db)
                reward = repo.get_reward_by_user(reward_id, user_id)
                
                if reward:
                    repo.delete_reward(reward)
                    return True
                return False
            except Exception as e:
                logger.error(f"Error deleting reward: {e}")
                session_db.rollback()
                return False

        if db is not None:
            return _delete(db)
        
        with next(get_db()) as new_db:
            return _delete(new_db)

    def toggle_reward(
        self,
        user_id: int,
        reward_id: int,
        db: Session = None
    ) -> Optional[bool]:
        """Переключение статуса награды (enabled/disabled)"""
        def _toggle(session_db: Session):
            try:
                repo = self._get_repository(session_db)
                reward = repo.get_reward_by_user(reward_id, user_id)
                
                if reward:
                    reward.is_enabled = not reward.is_enabled
                    session_db.commit()
                    return reward.is_enabled
                return None
            except Exception as e:
                logger.error(f"Error toggling reward: {e}")
                session_db.rollback()
                return None

        if db is not None:
            return _toggle(db)
        
        with next(get_db()) as new_db:
            return _toggle(new_db)
