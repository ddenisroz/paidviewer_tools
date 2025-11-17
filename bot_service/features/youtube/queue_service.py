# bot_service/features/youtube/queue_service.py
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc
from core.database import YouTubeQueue, ChannelPoints, PointsTransaction, get_db
from .youtube_service import YouTubeService
from datetime import datetime

logger = logging.getLogger('bot_service')

class QueueService:
    """
    Сервис для управления очередью YouTube видео
    """
    
    def __init__(self, connection_manager=None):
        self.youtube_service = YouTubeService()
        self.connection_manager = connection_manager
    
    async def add_video_to_queue(
        self, 
        user_id: int = None, 
        session_id: str = None,
        video_url: str = None, 
        channel_name: str = None, 
        platform: str = None, 
        requester_name: str = None, 
        requester_id: str = None,
        is_paid: bool = False,
        points_cost: int = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """Добавление видео в очередь"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            # Проверяем, что указан либо user_id, либо session_id
            if not user_id and not session_id:
                return {
                    'success': False, 
                    'error': 'Необходимо указать user_id или session_id'
                }
            
            # Проверяем валидность URL
            if not self.youtube_service.is_valid_youtube_url(video_url):
                return {
                    'success': False, 
                    'error': 'Неверная ссылка на YouTube. Используйте формат: https://youtube.com/watch?v=...'
                }
            
            # Получаем информацию о видео
            video_info = await self.youtube_service.get_video_info(video_url)
            if not video_info:
                return {
                    'success': False, 
                    'error': 'Видео недоступно или удалено. Проверьте ссылку и попробуйте снова'
                }
            
            # Проверяем, нет ли уже этого видео в очереди (по user_id или session_id)
            existing_filter = and_(
                YouTubeQueue.video_id == video_info['video_id'],
                YouTubeQueue.status == 'pending'
            )
            if user_id:
                existing_filter = and_(existing_filter, YouTubeQueue.user_id == user_id)
            if session_id:
                existing_filter = and_(existing_filter, YouTubeQueue.session_id == session_id)
            
            existing = db.query(YouTubeQueue).filter(existing_filter).first()
            
            if existing:
                return {
                    'success': False, 
                    'error': 'Это видео уже есть в очереди! Выберите другое видео'
                }
            
            # Получаем следующую позицию в очереди (по user_id или session_id)
            position_filter = and_(YouTubeQueue.status == 'pending')
            if user_id:
                position_filter = and_(position_filter, YouTubeQueue.user_id == user_id)
            if session_id:
                position_filter = and_(position_filter, YouTubeQueue.session_id == session_id)
            
            max_position = db.query(YouTubeQueue).filter(position_filter).count()
            
            # Если заказ за баллы, проверяем и списываем баллы
            if is_paid and points_cost:
                points_result = await self._deduct_points(
                    user_id, requester_id, requester_name, 
                    platform, channel_name, points_cost, 
                    f"Song request: {video_info['title']}", db
                )
                if not points_result['success']:
                    return points_result
            
            # Создаем запись в очереди
            queue_item = YouTubeQueue(
                user_id=user_id,
                session_id=session_id,
                video_url=video_url,
                video_id=video_info['video_id'],
                title=video_info['title'],
                duration=video_info['duration'],
                thumbnail_url=video_info['thumbnail_url'],
                channel_name=channel_name,
                platform=platform,
                requester_name=requester_name,
                requester_id=requester_id,
                position=max_position + 1,
                is_paid=is_paid,
                points_cost=points_cost
            )
            
            db.add(queue_item)
            db.commit()
            db.refresh(queue_item)
            
            logger.info(f"Added video to queue: {video_info['title']} by {requester_name}")
            
            # Отправляем команду в YouTube OBS если настроен и есть connection_manager
            if self.connection_manager:
                try:
                    # Если это первое видео в очереди, начинаем воспроизведение
                    if queue_item.position == 1:
                        await self.connection_manager.send_youtube_to_obs(
                            channel_name=channel_name,
                            action="play",
                            data={
                                "video": {
                                    "video_id": video_info['video_id'],
                                    "title": video_info['title'],
                                    "duration": video_info['duration'],
                                    "thumbnail_url": video_info['thumbnail_url']
                                }
                            }
                        )
                    else:
                        # Если не первое, просто обновляем очередь
                        await self.connection_manager.send_youtube_to_obs(
                            channel_name=channel_name,
                            action="queue_update",
                            data={"queue_length": max_position + 1}
                        )
                except Exception as e:
                    logger.error(f"Error sending YouTube OBS command: {e}")
            
            return {
                'success': True,
                'video_info': video_info,  # Добавляем video_info для обратной совместимости
                'queue_item': {
                    'id': queue_item.id,
                    'title': queue_item.title,
                    'duration': queue_item.duration,
                    'position': queue_item.position,
                    'requester': queue_item.requester_name,
                    'is_paid': queue_item.is_paid,
                    'points_cost': queue_item.points_cost
                }
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding video to queue: {e}")
            return {
                'success': False,
                'error': 'Ошибка добавления видео в очередь'
            }
        finally:
            if should_close:
                db.close()
    
    async def _deduct_points(
        self, 
        user_id: int, 
        viewer_id: str, 
        viewer_name: str, 
        platform: str, 
        channel_name: str, 
        cost: int, 
        reason: str, 
        db: Session
    ) -> Dict[str, Any]:
        """Списание баллов за заказ с защитой от race condition"""
        try:
            # ✅ Pessimistic lock - блокируем запись для других транзакций
            points_record = db.query(ChannelPoints).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.viewer_id == viewer_id,
                    ChannelPoints.platform == platform,
                    ChannelPoints.channel_name == channel_name
                )
            ).with_for_update().first()  # ✅ Lock для предотвращения race condition
            
            if not points_record or points_record.points < cost:
                db.rollback()
                return {
                    'success': False,
                    'error': f'Недостаточно баллов. Нужно: {cost}, есть: {points_record.points if points_record else 0}'
                }
            
            # ✅ Внутри транзакции списываем баллы
            points_record.points -= cost
            points_record.total_spent += cost
            points_record.last_activity = datetime.utcnow()
            
            # ✅ Создаем транзакцию для истории
            transaction = PointsTransaction(
                user_id=user_id,
                viewer_id=viewer_id,
                viewer_name=viewer_name,
                platform=platform,
                channel_name=channel_name,
                transaction_type='spend',
                amount=-cost,
                reason=reason
            )
            
            db.add(transaction)
            db.commit()  # ✅ Явный commit для сохранения изменений
            
            logger.info(f"Deducted {cost} points from {viewer_name} for {reason}")
            return {'success': True}
            
        except Exception as e:
            db.rollback()  # ✅ Rollback при ошибке
            logger.error(f"Error deducting points: {e}", exc_info=True)
            return {
                'success': False,
                'error': 'Ошибка списания баллов'
            }
    
    def get_queue(self, user_id: int = None, session_id: str = None, db: Session = None) -> List[Dict[str, Any]]:
        """Получение очереди видео"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            # Фильтр по user_id или session_id
            queue_filter = and_(YouTubeQueue.status == 'pending')
            if user_id:
                queue_filter = and_(queue_filter, YouTubeQueue.user_id == user_id)
            if session_id:
                queue_filter = and_(queue_filter, YouTubeQueue.session_id == session_id)
            
            queue_items = db.query(YouTubeQueue).filter(queue_filter).order_by(asc(YouTubeQueue.position)).all()
            
            result = []
            for item in queue_items:
                result.append({
                    'id': item.id,
                    'video_id': item.video_id,
                    'title': item.title,
                    'duration': item.duration,
                    'thumbnail_url': item.thumbnail_url,
                    'url': item.video_url,
                    'channel_name': item.channel_name,
                    'platform': item.platform,
                    'requester_name': item.requester_name,
                    'position': item.position,
                    'is_paid': item.is_paid,
                    'points_cost': item.points_cost,
                    'added_at': item.added_at.isoformat() if item.added_at else None
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting queue: {e}")
            return []
        finally:
            if should_close:
                db.close()
    
    def remove_from_queue(self, user_id: int, queue_id: int, db: Session = None) -> bool:
        """Удаление видео из очереди"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            queue_item = db.query(YouTubeQueue).filter(
                and_(
                    YouTubeQueue.id == queue_id,
                    YouTubeQueue.user_id == user_id,
                    YouTubeQueue.status == 'pending'
                )
            ).first()
            
            if not queue_item:
                return False
            
            # Возвращаем баллы, если видео было платным
            if queue_item.is_paid and queue_item.points_cost:
                self._refund_points_sync(
                    user_id, queue_item.requester_id, queue_item.requester_name,
                    queue_item.platform, queue_item.channel_name, 
                    queue_item.points_cost, f"Refund: {queue_item.title}", db
                )
            
            # Удаляем из очереди
            queue_item.status = 'skipped'
            
            # Перестраиваем позиции
            self._rebuild_positions(user_id, db)
            
            db.commit()
            
            logger.info(f"Removed video from queue: {queue_item.title}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error removing from queue: {e}")
            return False
        finally:
            if should_close:
                db.close()
    
    def remove_last_user_video(
        self, 
        user_id: int, 
        requester_id: str, 
        requester_name: str,
        platform: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Удаление последнего видео, добавленного конкретным пользователем (команда !wronglink)
        
        Args:
            user_id: ID владельца канала
            requester_id: ID пользователя, который добавил видео
            requester_name: Имя пользователя
            platform: Платформа (twitch/vk)
            db: Database session
        
        Returns:
            Dict с результатом операции
        """
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            # Ищем последнее pending видео этого пользователя
            last_video = db.query(YouTubeQueue).filter(
                and_(
                    YouTubeQueue.user_id == user_id,
                    YouTubeQueue.requester_id == requester_id,
                    YouTubeQueue.platform == platform,
                    YouTubeQueue.status == 'pending'
                )
            ).order_by(desc(YouTubeQueue.added_at)).first()
            
            if not last_video:
                return {
                    "success": False,
                    "error": f"@{requester_name}, у вас нет видео в очереди"
                }
            
            video_title = last_video.title
            
            # Возвращаем баллы, если видео было платным
            if last_video.is_paid and last_video.points_cost:
                self._refund_points_sync(
                    user_id, requester_id, requester_name,
                    platform, last_video.channel_name, 
                    last_video.points_cost, 
                    f"Wronglink refund: {video_title}", 
                    db
                )
            
            # Удаляем из очереди
            last_video.status = 'skipped'
            
            # Перестраиваем позиции
            self._rebuild_positions(user_id, db)
            
            db.commit()
            
            logger.info(f"[WRONGLINK] User {requester_name} removed their video: {video_title}")
            return {
                "success": True,
                "message": f"@{requester_name}, видео '{video_title}' удалено из очереди",
                "refunded": last_video.is_paid,
                "points_refunded": last_video.points_cost if last_video.is_paid else 0
            }
            
        except Exception as e:
            if db:
                db.rollback()
            logger.error(f"[WRONGLINK] Error removing last user video: {e}")
            return {
                "success": False,
                "error": f"@{requester_name}, ошибка удаления видео"
            }
        finally:
            if should_close:
                db.close()
    
    async def _refund_points(
        self, 
        user_id: int, 
        viewer_id: str, 
        viewer_name: str, 
        platform: str, 
        channel_name: str, 
        amount: int, 
        reason: str, 
        db: Session
    ):
        """Возврат баллов (асинхронная версия)"""
        self._refund_points_sync(user_id, viewer_id, viewer_name, platform, channel_name, amount, reason, db)
    
    def _refund_points_sync(
        self, 
        user_id: int, 
        viewer_id: str, 
        viewer_name: str, 
        platform: str, 
        channel_name: str, 
        amount: int, 
        reason: str, 
        db: Session
    ):
        """Возврат баллов (синхронная версия)"""
        try:
            points_record = db.query(ChannelPoints).filter(
                and_(
                    ChannelPoints.user_id == user_id,
                    ChannelPoints.viewer_id == viewer_id,
                    ChannelPoints.platform == platform,
                    ChannelPoints.channel_name == channel_name
                )
            ).first()
            
            if points_record:
                points_record.points += amount
                points_record.total_spent -= amount
                points_record.last_activity = datetime.utcnow()
                
                # Создаем транзакцию возврата
                transaction = PointsTransaction(
                    user_id=user_id,
                    viewer_id=viewer_id,
                    viewer_name=viewer_name,
                    platform=platform,
                    channel_name=channel_name,
                    transaction_type='refund',
                    amount=amount,
                    reason=reason
                )
                
                db.add(transaction)
                
        except Exception as e:
            logger.error(f"Error refunding points: {e}")
    
    def _rebuild_positions(self, user_id: int, db: Session):
        """Перестройка позиций в очереди"""
        try:
            queue_items = db.query(YouTubeQueue).filter(
                and_(
                    YouTubeQueue.user_id == user_id,
                    YouTubeQueue.status == 'pending'
                )
            ).order_by(asc(YouTubeQueue.position)).all()
            
            for i, item in enumerate(queue_items):
                item.position = i + 1
            
        except Exception as e:
            logger.error(f"Error rebuilding positions: {e}")
    
    def clear_queue(self, user_id: int, db: Session = None) -> int:
        """Очистка всей очереди"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            # Получаем все элементы очереди для возврата баллов
            queue_items = db.query(YouTubeQueue).filter(
                and_(
                    YouTubeQueue.user_id == user_id,
                    YouTubeQueue.status == 'pending'
                )
            ).all()
            
            count = 0
            for item in queue_items:
                # Возвращаем баллы, если было платно
                if item.is_paid and item.points_cost:
                    self._refund_points_sync(
                        user_id, item.requester_id, item.requester_name,
                        item.platform, item.channel_name,
                        item.points_cost, f"Queue cleared: {item.title}", db
                    )
                
                item.status = 'skipped'
                count += 1
            
            db.commit()
            
            logger.info(f"Cleared {count} items from queue for user {user_id}")
            return count
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error clearing queue: {e}")
            return 0
        finally:
            if should_close:
                db.close()
    
    def get_next_video(self, user_id: int, db: Session = None) -> Optional[Dict[str, Any]]:
        """Получение следующего видео в очереди"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            next_item = db.query(YouTubeQueue).filter(
                and_(
                    YouTubeQueue.user_id == user_id,
                    YouTubeQueue.status == 'pending'
                )
            ).order_by(asc(YouTubeQueue.position)).first()
            
            if not next_item:
                return None
            
            return {
                'id': next_item.id,
                'video_id': next_item.video_id,
                'title': next_item.title,
                'duration': next_item.duration,
                'thumbnail_url': next_item.thumbnail_url,
                'url': next_item.video_url,
                'requester_name': next_item.requester_name,
                'embed_url': self.youtube_service.get_embed_url(next_item.video_id)
            }
            
        except Exception as e:
            logger.error(f"Error getting next video: {e}")
            return None
        finally:
            if should_close:
                db.close()
    
    def mark_as_played(self, user_id: int, queue_id: int, db: Session = None) -> bool:
        """Отметить видео как проигранное"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            queue_item = db.query(YouTubeQueue).filter(
                and_(
                    YouTubeQueue.id == queue_id,
                    YouTubeQueue.user_id == user_id,
                    YouTubeQueue.status == 'pending'
                )
            ).first()
            
            if not queue_item:
                return False
            
            queue_item.status = 'completed'
            queue_item.played_at = datetime.utcnow()
            
            # Перестраиваем позиции
            self._rebuild_positions(user_id, db)
            
            db.commit()
            
            logger.info(f"Marked video as played: {queue_item.title}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error marking video as played: {e}")
            return False
        finally:
            if should_close:
                db.close()
