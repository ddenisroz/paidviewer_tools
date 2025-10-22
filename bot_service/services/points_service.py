# bot_service/services/points_service.py
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc, func
from core.database import ChannelPoints, ChannelReward, PointsTransaction, RewardQueue, get_db
from datetime import datetime, timedelta

logger = logging.getLogger('bot_service')

class PointsService:
    """
    Сервис для управления баллами канала и наградами
    """
    
    def __init__(self):
        pass
    
    # === УПРАВЛЕНИЕ БАЛЛАМИ ===
    
    def get_user_points(self, user_id: int, viewer_id: str, platform: str, channel_name: str, db: Session) -> int:
        """Получение баллов пользователя"""
        try:
            points_record = db.query(ChannelPoints).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.viewer_id == viewer_id,
                    ChannelPoints.platform == platform,
                    ChannelPoints.channel_name == channel_name
                )
            ).first()
            
            return points_record.points if points_record else 0
            
        except Exception as e:
            logger.error(f"Error getting user points: {e}")
            return 0
    
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
    ) -> bool:
        """Добавление баллов пользователю"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            # Находим или создаем запись баллов
            points_record = db.query(ChannelPoints).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.viewer_id == viewer_id,
                    ChannelPoints.platform == platform,
                    ChannelPoints.channel_name == channel_name
                )
            ).first()
            
            if not points_record:
                points_record = ChannelPoints(
                    user_id=user_id,
                    viewer_id=viewer_id,
                    viewer_name=viewer_name,
                    platform=platform,
                    channel_name=channel_name,
                    points=0,
                    total_earned=0,
                    total_spent=0
                )
                db.add(points_record)
            
            # Добавляем баллы
            points_record.points += amount
            points_record.total_earned += amount
            points_record.last_activity = datetime.utcnow()
            
            # Создаем транзакцию
            transaction = PointsTransaction(
                user_id=user_id,
                viewer_id=viewer_id,
                viewer_name=viewer_name,
                platform=platform,
                channel_name=channel_name,
                transaction_type='earn',
                amount=amount,
                reason=reason
            )
            
            db.add(transaction)
            db.commit()
            
            logger.info(f"Added {amount} points to {viewer_name}: {reason}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding points: {e}")
            return False
        finally:
            if should_close:
                db.close()
    
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
    ) -> Dict[str, Any]:
        """Списание баллов у пользователя"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            points_record = db.query(ChannelPoints).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.viewer_id == viewer_id,
                    ChannelPoints.platform == platform,
                    ChannelPoints.channel_name == channel_name
                )
            ).first()
            
            if not points_record or points_record.points < amount:
                return {
                    'success': False,
                    'error': f'Недостаточно баллов. Нужно: {amount}, есть: {points_record.points if points_record else 0}'
                }
            
            # Списываем баллы
            points_record.points -= amount
            points_record.total_spent += amount
            points_record.last_activity = datetime.utcnow()
            
            # Создаем транзакцию
            transaction = PointsTransaction(
                user_id=user_id,
                viewer_id=viewer_id,
                viewer_name=viewer_name,
                platform=platform,
                channel_name=channel_name,
                transaction_type='spend',
                amount=-amount,
                reason=reason
            )
            
            db.add(transaction)
            db.commit()
            
            logger.info(f"Deducted {amount} points from {viewer_name}: {reason}")
            return {'success': True}
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deducting points: {e}")
            return {'success': False, 'error': 'Ошибка списания баллов'}
        finally:
            if should_close:
                db.close()
    
    def get_channel_leaderboard(self, user_id: int, channel_name: str, platform: str = None, limit: int = 10, db: Session = None) -> List[Dict[str, Any]]:
        """Получение топа пользователей по баллам"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            query = db.query(ChannelPoints).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.channel_name == channel_name
                )
            )
            
            if platform:
                query = query.filter(ChannelPoints.platform == platform)
            
            top_users = query.order_by(desc(ChannelPoints.points)).limit(limit).all()
            
            result = []
            for i, user in enumerate(top_users):
                result.append({
                    'rank': i + 1,
                    'viewer_name': user.viewer_name,
                    'points': user.points,
                    'total_earned': user.total_earned,
                    'total_spent': user.total_spent,
                    'platform': user.platform,
                    'last_activity': user.last_activity.isoformat() if user.last_activity else None
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting leaderboard: {e}")
            return []
        finally:
            if should_close:
                db.close()
    
    # === УПРАВЛЕНИЕ НАГРАДАМИ ===
    
    def create_reward(
        self, 
        user_id: int, 
        platform: str, 
        channel_name: str, 
        title: str, 
        description: str, 
        cost: int,
        **kwargs
    ) -> Dict[str, Any]:
        """Создание новой награды"""
        
        db = next(get_db())
        try:
            reward = ChannelReward(
                user_id=user_id,
                platform=platform,
                channel_name=channel_name,
                title=title,
                description=description,
                cost=cost,
                icon_url=kwargs.get('icon_url'),
                background_color=kwargs.get('background_color', '#3B82F6'),
                is_user_input_required=kwargs.get('is_user_input_required', False),
                max_per_stream=kwargs.get('max_per_stream'),
                max_per_user_per_stream=kwargs.get('max_per_user_per_stream'),
                prompt=kwargs.get('prompt'),
                reward_type=kwargs.get('reward_type', 'custom')
            )
            
            db.add(reward)
            db.commit()
            db.refresh(reward)
            
            logger.info(f"Created reward: {title} for {cost} points")
            
            return {
                'success': True,
                'reward_id': reward.id,
                'reward': {
                    'id': reward.id,
                    'title': reward.title,
                    'description': reward.description,
                    'cost': reward.cost,
                    'is_enabled': reward.is_enabled
                }
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating reward: {e}")
            return {'success': False, 'error': 'Ошибка создания награды'}
        finally:
            db.close()
    
    def get_channel_rewards(self, user_id: int, platform: str = None, db: Session = None) -> List[Dict[str, Any]]:
        """Получение наград канала"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            query = db.query(ChannelReward).filter(ChannelReward.user_id == user_id)
            
            if platform:
                query = query.filter(ChannelReward.platform == platform)
            
            rewards = query.order_by(asc(ChannelReward.cost)).all()
            
            result = []
            for reward in rewards:
                result.append({
                    'id': reward.id,
                    'title': reward.title,
                    'description': reward.description,
                    'cost': reward.cost,
                    'platform': reward.platform,
                    'icon_url': reward.icon_url,
                    'background_color': reward.background_color,
                    'is_enabled': reward.is_enabled,
                    'is_user_input_required': reward.is_user_input_required,
                    'max_per_stream': reward.max_per_stream,
                    'max_per_user_per_stream': reward.max_per_user_per_stream,
                    'prompt': reward.prompt,
                    'reward_type': reward.reward_type,
                    'created_at': reward.created_at.isoformat() if reward.created_at else None
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting rewards: {e}")
            return []
        finally:
            if should_close:
                db.close()
    
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
        
        db = next(get_db())
        try:
            # Получаем награду
            reward = db.query(ChannelReward).filter(
                and_(
                    ChannelReward.id == reward_id,
                    ChannelReward.user_id == user_id,
                    ChannelReward.is_enabled == True
                )
            ).first()
            
            if not reward:
                return {'success': False, 'error': 'Награда не найдена или отключена'}
            
            # Проверяем баллы
            points_result = self.deduct_points(
                user_id, viewer_id, viewer_name, platform, channel_name,
                reward.cost, f"Reward: {reward.title}", db
            )
            
            if not points_result['success']:
                return points_result
            
            # Создаем запись в очереди наград
            reward_queue_item = RewardQueue(
                user_id=user_id,
                reward_id=reward_id,
                viewer_id=viewer_id,
                viewer_name=viewer_name,
                platform=platform,
                channel_name=channel_name,
                user_input=user_input,
                points_cost=reward.cost,
                status='pending'
            )
            
            db.add(reward_queue_item)
            db.commit()
            db.refresh(reward_queue_item)
            
            logger.info(f"{viewer_name} redeemed reward: {reward.title} for {reward.cost} points")
            
            return {
                'success': True,
                'message': f'Награда "{reward.title}" обменена за {reward.cost} баллов',
                'queue_id': reward_queue_item.id
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error redeeming reward: {e}")
            return {'success': False, 'error': 'Ошибка обмена награды'}
        finally:
            db.close()
    
    def get_reward_queue(self, user_id: int, status: str = None, db: Session = None) -> List[Dict[str, Any]]:
        """Получение очереди наград"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            query = db.query(RewardQueue).filter(RewardQueue.user_id == user_id)
            
            if status:
                query = query.filter(RewardQueue.status == status)
            
            queue_items = query.order_by(desc(RewardQueue.created_at)).all()
            
            result = []
            for item in queue_items:
                # Получаем информацию о награде
                reward = db.query(ChannelReward).filter(ChannelReward.id == item.reward_id).first()
                
                result.append({
                    'id': item.id,
                    'reward_title': reward.title if reward else 'Unknown Reward',
                    'reward_description': reward.description if reward else '',
                    'viewer_name': item.viewer_name,
                    'platform': item.platform,
                    'channel_name': item.channel_name,
                    'user_input': item.user_input,
                    'points_cost': item.points_cost,
                    'status': item.status,
                    'moderator_note': item.moderator_note,
                    'created_at': item.created_at.isoformat() if item.created_at else None,
                    'processed_at': item.processed_at.isoformat() if item.processed_at else None
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting reward queue: {e}")
            return []
        finally:
            if should_close:
                db.close()
    
    def process_reward(self, user_id: int, queue_id: int, action: str, moderator_note: str = None) -> Dict[str, Any]:
        """Обработка награды модератором"""
        
        db = next(get_db())
        try:
            queue_item = db.query(RewardQueue).filter(
                and_(
                    RewardQueue.id == queue_id,
                    RewardQueue.user_id == user_id,
                    RewardQueue.status == 'pending'
                )
            ).first()
            
            if not queue_item:
                return {'success': False, 'error': 'Запрос на награду не найден'}
            
            if action == 'approve':
                queue_item.status = 'approved'
            elif action == 'reject':
                queue_item.status = 'rejected'
                # Возвращаем баллы
                self.add_points(
                    user_id, queue_item.viewer_id, queue_item.viewer_name,
                    queue_item.platform, queue_item.channel_name,
                    queue_item.points_cost, f"Refund: {moderator_note or 'Reward rejected'}", db
                )
            elif action == 'fulfill':
                queue_item.status = 'fulfilled'
            else:
                return {'success': False, 'error': 'Неверное действие'}
            
            queue_item.moderator_note = moderator_note
            queue_item.processed_at = datetime.utcnow()
            
            db.commit()
            
            logger.info(f"Processed reward queue item {queue_id}: {action}")
            
            return {
                'success': True,
                'message': f'Запрос на награду {action}',
                'status': queue_item.status
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing reward: {e}")
            return {'success': False, 'error': 'Ошибка обработки награды'}
        finally:
            db.close()
    
    # === СТАТИСТИКА ===
    
    def get_channel_stats(self, user_id: int, channel_name: str, db: Session = None) -> Dict[str, Any]:
        """Получение статистики канала"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            # Общее количество пользователей
            total_users = db.query(func.count(ChannelPoints.id)).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.channel_name == channel_name
                )
            ).scalar() or 0
            
            # Общее количество баллов в обращении
            total_points = db.query(func.sum(ChannelPoints.points)).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.channel_name == channel_name
                )
            ).scalar() or 0
            
            # Количество активных наград
            active_rewards = db.query(func.count(ChannelReward.id)).filter(
                and_(
                    ChannelReward.user_id == user_id,
                    ChannelReward.is_enabled == True
                )
            ).scalar() or 0
            
            # Количество ожидающих наград
            pending_rewards = db.query(func.count(RewardQueue.id)).filter(
                and_(
                    RewardQueue.user_id == user_id,
                    RewardQueue.status == 'pending'
                )
            ).scalar() or 0
            
            return {
                'total_users': total_users,
                'total_points': total_points,
                'active_rewards': active_rewards,
                'pending_rewards': pending_rewards
            }
            
        except Exception as e:
            logger.error(f"Error getting channel stats: {e}")
            return {
                'total_users': 0,
                'total_points': 0,
                'active_rewards': 0,
                'pending_rewards': 0
            }
        finally:
            if should_close:
                db.close()
    
    # === УПРАВЛЕНИЕ НАГРАДАМИ (НОВЫЕ МЕТОДЫ) ===
    
    def update_reward(self, user_id: int, reward_id: int, update_data: Dict[str, Any], db: Session = None) -> Dict[str, Any]:
        """Обновление награды"""
        should_close = False
        if db is None:
            db = next(get_db())
            should_close = True
        
        try:
            # Находим награду
            reward = db.query(ChannelReward).filter(
                and_(
                    ChannelReward.id == reward_id,
                    ChannelReward.user_id == user_id
                )
            ).first()
            
            if not reward:
                return {"success": False, "error": "Награда не найдена"}
            
            # Обновляем поля
            for key, value in update_data.items():
                if hasattr(reward, key) and value is not None:
                    setattr(reward, key, value)
            
            reward.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(reward)
            
            logger.info(f"Reward {reward_id} updated successfully")
            return {
                "success": True,
                "message": "Награда обновлена",
                "reward": {
                    "id": reward.id,
                    "title": reward.title,
                    "cost": reward.cost,
                    "enabled": reward.enabled
                }
            }
            
        except Exception as e:
            logger.error(f"Error updating reward {reward_id}: {e}")
            db.rollback()
            return {"success": False, "error": str(e)}
        finally:
            if should_close:
                db.close()
    
    def delete_reward(self, user_id: int, reward_id: int, db: Session = None) -> Dict[str, Any]:
        """Удаление награды"""
        should_close = False
        if db is None:
            db = next(get_db())
            should_close = True
        
        try:
            # Находим награду
            reward = db.query(ChannelReward).filter(
                and_(
                    ChannelReward.id == reward_id,
                    ChannelReward.user_id == user_id
                )
            ).first()
            
            if not reward:
                return {"success": False, "error": "Награда не найдена"}
            
            # Проверяем, нет ли активных запросов на обмен
            pending_requests = db.query(RewardQueue).filter(
                and_(
                    RewardQueue.reward_id == reward_id,
                    RewardQueue.status == 'pending'
                )
            ).count()
            
            if pending_requests > 0:
                return {
                    "success": False, 
                    "error": f"Невозможно удалить награду: есть {pending_requests} активных запросов"
                }
            
            # Удаляем награду
            db.delete(reward)
            db.commit()
            
            logger.info(f"Reward {reward_id} deleted successfully")
            return {"success": True, "message": "Награда удалена"}
            
        except Exception as e:
            logger.error(f"Error deleting reward {reward_id}: {e}")
            db.rollback()
            return {"success": False, "error": str(e)}
        finally:
            if should_close:
                db.close()
    
    def toggle_reward(self, user_id: int, reward_id: int, db: Session = None) -> Dict[str, Any]:
        """Переключение статуса награды (enabled/disabled)"""
        should_close = False
        if db is None:
            db = next(get_db())
            should_close = True
        
        try:
            # Находим награду
            reward = db.query(ChannelReward).filter(
                and_(
                    ChannelReward.id == reward_id,
                    ChannelReward.user_id == user_id
                )
            ).first()
            
            if not reward:
                return {"success": False, "error": "Награда не найдена"}
            
            # Переключаем статус
            reward.enabled = not reward.enabled
            reward.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(reward)
            
            status = "включена" if reward.enabled else "отключена"
            logger.info(f"Reward {reward_id} toggled to {reward.enabled}")
            
            return {
                "success": True,
                "message": f"Награда {status}",
                "reward": {
                    "id": reward.id,
                    "title": reward.title,
                    "enabled": reward.enabled
                }
            }
            
        except Exception as e:
            logger.error(f"Error toggling reward {reward_id}: {e}")
            db.rollback()
            return {"success": False, "error": str(e)}
        finally:
            if should_close:
                db.close()