# bot_service/services/youtube/queue_service.py
"""
YouTube Queue Service — управление очередью видео.
Использует репозитории для работы с БД (Clean Architecture).
"""
import asyncio
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from core.database import YouTubeQueue, ChannelPoints, PointsTransaction, get_db
from core.datetime_utils import utcnow_naive
from repositories.youtube_queue_repository import YouTubeQueueRepository
from repositories.points_repository import PointsRepository
from utils.websocket_broadcast import broadcast_youtube_queue_update

# [Modified Import] Relative import from the same package
from .youtube_service import YouTubeService

logger = logging.getLogger('bot_service')


class QueueService:
    """
    Сервис для управления очередью YouTube видео.
    Использует YouTubeQueueRepository и PointsRepository.
    """

    def __init__(self, connection_manager=None):
        self.youtube_service = YouTubeService()
        self.connection_manager = connection_manager

    async def _broadcast_queue_update(self, user_id: int | None) -> None:
        if not user_id:
            return
        try:
            await broadcast_youtube_queue_update(user_id)
        except Exception as e:
            logger.debug(f"[QUEUE] Failed to broadcast queue update: {e}")

    def _broadcast_queue_update_sync(self, user_id: int | None) -> None:
        if not user_id:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(broadcast_youtube_queue_update(user_id))

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
            # Инициализируем репозитории
            queue_repo = YouTubeQueueRepository(db)
            
            # Проверяем, что указан либо user_id, либо session_id
            if not user_id and not session_id:
                return {
                    'success': False,
                    'error': 'Необходимо указать user_id или session_id'
                }

            # Проверяем валидность URL или выполняем поиск по запросу
            video_input = (video_url or "").strip()
            if not video_input:
                return {
                    'success': False,
                    'error': 'Укажите ссылку или поисковый запрос.'
                }

            if not self.youtube_service.is_valid_youtube_url(video_input):
                if len(video_input) < 2:
                    return {
                        'success': False,
                        'error': 'Слишком короткий поисковый запрос.'
                    }
                search_results = await self.youtube_service.search_videos(video_input, max_results=5)
                if not search_results:
                    return {
                        'success': False,
                        'error': 'Видео не найдено. Попробуйте другой запрос или ссылку.'
                    }

                selected_url = None
                for candidate in search_results:
                    candidate_id = candidate.get('video_id')
                    candidate_url = candidate.get('url')
                    if not candidate_id or not candidate_url:
                        continue
                    if queue_repo.get_banned_by_video_id(candidate_id, user_id=user_id, session_id=session_id):
                        continue
                    if queue_repo.get_pending_by_video_id(candidate_id, user_id=user_id, session_id=session_id):
                        continue
                    selected_url = candidate_url
                    break

                if not selected_url:
                    return {
                        'success': False,
                        'error': 'Все найденные видео уже есть в очереди или забанены. Уточните запрос.'
                    }

                video_url = selected_url
            else:
                video_url = video_input

            # Получаем информацию о видео
            video_info = await self.youtube_service.get_video_info(video_url)
            if not video_info:
                return {
                    'success': False,
                    'error': 'Видео недоступно или удалено. Проверьте ссылку и попробуйте снова'
                }

            # Проверяем, нет ли уже этого видео в очереди (через репозиторий)
            # ??????????????????, ???? ???????????????? ???? ??????????
            banned = queue_repo.get_banned_by_video_id(
                video_id=video_info['video_id'],
                user_id=user_id,
                session_id=session_id
            )
            if banned:
                return {
                    'success': False,
                    'error': 'Video is banned for this channel.'
                }

            existing = queue_repo.get_pending_by_video_id(
                video_id=video_info['video_id'],
                user_id=user_id,
                session_id=session_id
            )

            if existing:
                return {
                    'success': False,
                    'error': 'Это видео уже есть в очереди! Выберите другое видео'
                }

            # Получаем следующую позицию в очереди (через репозиторий)
            max_position = queue_repo.count_pending(user_id=user_id, session_id=session_id)

            # Если заказ за баллы, проверяем и списываем баллы
            if is_paid and points_cost:
                points_result = await self._deduct_points(
                    user_id, requester_id, requester_name,
                    platform, channel_name, points_cost,
                    f"Song request: {video_info['title']}", db
                )
                if not points_result['success']:
                    return points_result

            # Создаем запись в очереди через репозиторий
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

            # [CLEAN] Use repository instead of direct db.add/commit
            queue_item = queue_repo.add_item(queue_item)

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

            await self._broadcast_queue_update(user_id)

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

    async def add_video(
        self,
        user_id: int,
        url: str,
        requested_by: str,
        requester_id: str = None,
        platform: str = None,
        channel_name: str = None,
        is_paid: bool = False,
        points_cost: int = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """Backward-compatible wrapper for adding a video to the queue."""
        return await self.add_video_to_queue(
            user_id=user_id,
            session_id=None,
            video_url=url,
            channel_name=channel_name,
            platform=platform,
            requester_name=requested_by,
            requester_id=requester_id,
            is_paid=is_paid,
            points_cost=points_cost,
            db=db
        )

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
            # [OK] Pessimistic lock - блокируем запись для других транзакций
            # [OK] Pessimistic lock - блокируем запись для других транзакций
            points_repo = PointsRepository(db)
            points_record = points_repo.get_user_points_for_update(
                user_id=user_id,
                viewer_id=viewer_id,
                platform=platform,
                channel_name=channel_name
            )

            if not points_record or points_record.points < cost:
                db.rollback()
                return {
                    'success': False,
                    'error': f'Недостаточно баллов. Нужно: {cost}, есть: {points_record.points if points_record else 0}'
                }

            # [OK] Внутри транзакции списываем баллы
            points_record.points -= cost
            points_record.total_spent += cost
            points_record.last_activity = utcnow_naive()

            # [CLEAN] Создаем транзакцию для истории через репозиторий
            points_repo.create_transaction(
                user_id=user_id,
                viewer_id=viewer_id,
                viewer_name=viewer_name,
                platform=platform,
                channel_name=channel_name,
                transaction_type='spend',
                amount=-cost,
                reason=reason
            )

            logger.info(f"Deducted {cost} points from {viewer_name} for {reason}")
            return {'success': True}

        except Exception as e:
            db.rollback()  # [OK] Rollback при ошибке
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
            queue_repo = YouTubeQueueRepository(db)
            queue_items = queue_repo.get_pending_queue(user_id=user_id, session_id=session_id)

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
            queue_repo = YouTubeQueueRepository(db)
            queue_item = queue_repo.get_pending_item(queue_id, user_id)

            if not queue_item:
                return False

            # Возвращаем баллы, если видео было платным
            if queue_item.is_paid and queue_item.points_cost:
                self._refund_points_sync(
                    user_id, queue_item.requester_id, queue_item.requester_name,
                    queue_item.platform, queue_item.channel_name,
                    queue_item.points_cost, f"Refund: {queue_item.title}", db
                )

            # Skip the item using repository
            queue_repo.update_status(queue_item, 'skipped')

            # Rebuild positions
            self._rebuild_positions(user_id, db)

            logger.info(f"Removed video from queue: {queue_item.title}")
            self._broadcast_queue_update_sync(user_id)
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"Error removing from queue: {e}")
            return False
        finally:
            if should_close:
                db.close()

    def ban_video(self, user_id: int, queue_id: int, db: Session = None) -> Dict[str, Any]:
        """Ban a video by queue item ID (removes from queue and blocks future adds)."""
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False

        try:
            queue_repo = YouTubeQueueRepository(db)
            queue_item = queue_repo.get_item_by_id(queue_id, user_id)
            if not queue_item:
                return {"success": False, "error": "Video not found in queue"}

            video_id = queue_item.video_id
            pending_items = queue_repo.get_pending_by_video_id_all(video_id, user_id=user_id)

            banned_count = 0
            for item in pending_items:
                queue_repo.update_status(item, 'banned')
                banned_count += 1

            # If nothing pending, still mark the selected item as banned to persist block
            if banned_count == 0:
                queue_repo.update_status(queue_item, 'banned')
                banned_count = 1

            # Rebuild positions after removing banned items
            self._rebuild_positions(user_id, db)

            logger.info(f"Banned video {video_id} for user {user_id} (count={banned_count})")
            self._broadcast_queue_update_sync(user_id)
            return {"success": True, "video_id": video_id, "banned_count": banned_count}
        except Exception as e:
            db.rollback()
            logger.error(f"Error banning video: {e}")
            return {"success": False, "error": "Failed to ban video"}
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
            queue_repo = YouTubeQueueRepository(db)
            # Ищем последнее pending видео этого пользователя
            last_video = queue_repo.get_last_pending_by_requester(user_id, requester_id, platform)

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

            # Skip the item using repository
            queue_repo.update_status(last_video, 'skipped')

            # Rebuild positions
            self._rebuild_positions(user_id, db)

            logger.info(f"[WRONGLINK] User {requester_name} removed their video: {video_title}")
            self._broadcast_queue_update_sync(user_id)
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
            points_repo = PointsRepository(db)
            points_record = points_repo.get_user_points(
                user_id=user_id,
                viewer_id=viewer_id,
                platform=platform,
                channel_name=channel_name
            )

            if points_record:
                points_record.points += amount
                points_record.total_spent -= amount
                points_record.last_activity = utcnow_naive()

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
            queue_repo = YouTubeQueueRepository(db)
            queue_items = queue_repo.get_pending_ordered(user_id)

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
            queue_repo = YouTubeQueueRepository(db)
            queue_items = queue_repo.get_all_pending_for_user(user_id)

            count = 0
            for item in queue_items:
                # Refund points if paid
                if item.is_paid and item.points_cost:
                    self._refund_points_sync(
                        user_id, item.requester_id, item.requester_name,
                        item.platform, item.channel_name,
                        item.points_cost, f"Queue cleared: {item.title}", db
                    )

                # Skip using repository (each call commits)
                queue_repo.update_status(item, 'skipped')
                count += 1

            logger.info(f"Cleared {count} items from queue for user {user_id}")
            self._broadcast_queue_update_sync(user_id)
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
            queue_repo = YouTubeQueueRepository(db)
            next_item = queue_repo.get_next_pending(user_id)

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
            queue_repo = YouTubeQueueRepository(db)
            queue_item = queue_repo.get_item_by_id(queue_id, user_id)

            if not queue_item:
                return False

            queue_item.status = 'played'
            queue_item.played_at = utcnow_naive()

            # Перестраиваем позиции
            self._rebuild_positions(user_id, db)

            db.commit()

            logger.info(f"Marked video as played: {queue_item.title}")
            self._broadcast_queue_update_sync(user_id)
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"Error marking video as played: {e}")
            return False
        finally:
            if should_close:
                db.close()

    def move_to_top(self, user_id: int, queue_id: int, db: Session = None) -> bool:
        """Move selected queue item to the top (play next)."""
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False

        try:
            queue_repo = YouTubeQueueRepository(db)
            items = queue_repo.get_pending_ordered(user_id)
            if not items:
                return False

            selected = next((item for item in items if item.id == queue_id), None)
            if not selected:
                return False

            if items[0].id == queue_id:
                return True

            items = [selected] + [item for item in items if item.id != queue_id]
            queue_repo.rebuild_positions(items)
            db.commit()
            logger.info(f"Moved queue item to top: {selected.title}")
            self._broadcast_queue_update_sync(user_id)
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error moving queue item to top: {e}")
            return False
        finally:
            if should_close:
                db.close()

    def cut_to_item(self, user_id: int, queue_id: int, db: Session = None) -> bool:
        """Skip all items before the selected one and make it the current item."""
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False

        try:
            queue_repo = YouTubeQueueRepository(db)
            items = queue_repo.get_pending_ordered(user_id)
            if not items:
                return False

            selected_index = next((idx for idx, item in enumerate(items) if item.id == queue_id), None)
            if selected_index is None:
                return False
            if selected_index == 0:
                return True

            now = utcnow_naive()
            for item in items[:selected_index]:
                item.status = 'skipped'
                item.played_at = now

            remaining = items[selected_index:]
            queue_repo.rebuild_positions(remaining)
            db.commit()
            logger.info(f"Cut queue to item: {remaining[0].title}")
            self._broadcast_queue_update_sync(user_id)
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error cutting queue to item: {e}")
            return False
        finally:
            if should_close:
                db.close()
    async def get_current_video(self, user_id: int, db: Session = None) -> Optional[Dict[str, Any]]:
        """Получение текущего видео (первого в очереди)"""
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False

        try:
            queue_items = self.get_queue(user_id=user_id, db=db)
            if queue_items and len(queue_items) > 0:
                return queue_items[0]
            return None
        finally:
            if should_close:
                db.close()

    async def skip_current(self, user_id: int, db: Session = None) -> Dict[str, Any]:
        """Пропустить текущее видео и перейти к следующему"""
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False

        try:
            queue_items = self.get_queue(user_id=user_id, db=db)

            if not queue_items or len(queue_items) == 0:
                return {
                    "success": False,
                    "error": "Очередь пуста"
                }

            # Первое видео в очереди - это текущее, отмечаем его как проигранное
            current_video_id = queue_items[0]['id']
            success = self.mark_as_played(user_id, current_video_id, db)

            if not success:
                return {
                    "success": False,
                    "error": "Не удалось пропустить видео"
                }

            logger.info(f"Skipped video for user {user_id}: {queue_items[0].get('title', 'Unknown')}")
            await self._broadcast_queue_update(user_id)

            return {
                "success": True,
                "message": "Видео пропущено"
            }

        except Exception as e:
            logger.error(f"Error skipping current video: {e}")
            return {
                "success": False,
                "error": "Ошибка пропуска видео"
            }
        finally:
            if should_close:
                db.close()

