# bot_service/services/stream_session_service.py
"""
Сервис для отслеживания сессий трансляций
Отслеживает начало и конец трансляций для правильного подсчета стриков
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session

from core.database import StreamSession, UserStreak
from core.datetime_utils import utcnow_naive
from repositories.stream_session_repository import StreamSessionRepository
from repositories.drops_history_repository import DropsHistoryRepository

logger = logging.getLogger(__name__)

class StreamSessionService:
    """Сервис для управления сессиями трансляций"""

    def __init__(self, db: Session):
        self.db = db
        self.session_repo = StreamSessionRepository(db)
        self.streak_repo = DropsHistoryRepository(db)

    def get_or_create_active_session(
        self,
        user_id: int = None,
        session_id: str = None,
        channel_name: str = None,
        platform: str = "twitch",
        title: str = None
    ) -> Optional[StreamSession]:
        """Получить или создать активную сессию трансляции
        
        Args:
            user_id: ID владельца канала
            session_id: ID сессии (для гостей)
            channel_name: Имя канала
            platform: Платформа (twitch/vk)
            title: Название трансляции
            
        Returns:
            StreamSession объект или None
        """
        if not channel_name:
            return None

        # Ищем активную сессию для этого канала и платформы
        active_session = self.session_repo.get_active_session(
            channel_name=channel_name,
            platform=platform,
            user_id=user_id,
            session_id=session_id
        )

        if active_session:
            # Обновляем название если оно изменилось
            if title and active_session.title != title:
                active_session.title = title
                active_session.updated_at = utcnow_naive()
                self.session_repo.update_session(active_session)

            return active_session

        # Создаем новую активную сессию
        # Сначала закрываем все предыдущие активные сессии для этого канала/платформы
        self._close_old_sessions(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform)

        # Создаем новую сессию
        new_session = StreamSession(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform,
            started_at=utcnow_naive(),
            is_active=True,
            title=title
        )
        self.session_repo.add_session(new_session)

        logger.info(f"[SESSION] [STREAM SESSION] Created new session for {channel_name} ({platform})")

        return new_session

    def _close_old_sessions(
        self,
        user_id: int = None,
        session_id: str = None,
        channel_name: str = None,
        platform: str = "twitch"
    ):
        """Закрывает все старые активные сессии для канала/платформы"""
        old_sessions = self.session_repo.get_old_active_sessions(
            channel_name=channel_name,
            platform=platform,
            user_id=user_id,
            session_id=session_id
        )
        
        now = utcnow_naive()
        count = 0
        for session in old_sessions:
            session.is_active = False
            session.ended_at = now
            session.updated_at = now
            self.session_repo.update_session(session)
            count += 1

        if count > 0:
            logger.info(f"[SECURITY] [STREAM SESSION] Closed {count} old sessions for {channel_name} ({platform})")

    def end_session(
        self,
        user_id: int = None,
        session_id: str = None,
        channel_name: str = None,
        platform: str = "twitch"
    ) -> bool:
        """Завершить активную сессию трансляции
        
        Returns:
            True если сессия была найдена и закрыта, False иначе
        """
        session = self.session_repo.get_active_session(
            channel_name=channel_name,
            platform=platform,
            user_id=user_id,
            session_id=session_id
        )

        if session:
            session.is_active = False
            session.ended_at = utcnow_naive()
            session.updated_at = utcnow_naive()
            self.session_repo.update_session(session)
            logger.info(f"[SECURITY] [STREAM SESSION] Ended session for {channel_name} ({platform})")
            return True

        return False

    def get_last_session(
        self,
        user_id: int = None,
        session_id: str = None,
        channel_name: str = None,
        platform: str = "twitch"
    ) -> Optional[StreamSession]:
        """Получить последнюю сессию трансляции (активную или завершенную)"""
        return self.session_repo.get_last_session(
            channel_name=channel_name,
            platform=platform,
            user_id=user_id,
            session_id=session_id
        )

    def get_active_session(
        self,
        user_id: int = None,
        session_id: str = None,
        channel_name: str = None,
        platform: str = "twitch"
    ) -> Optional[StreamSession]:
        """Получить активную сессию трансляции"""
        return self.session_repo.get_active_session(
            channel_name=channel_name,
            platform=platform,
            user_id=user_id,
            session_id=session_id
        )

    def mark_viewer_attended_stream(
        self,
        user_id: int = None,
        session_id: str = None,
        channel_name: str = None,
        platform: str = "twitch",
        viewer_id: str = None
    ) -> bool:
        """Отметить что зритель посетил текущую трансляцию
        
        Обновляет last_stream_session_id и last_stream_attended_at в UserStreak
        """
        if not viewer_id:
            return False

        # Получаем активную сессию
        active_session = self.get_active_session(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform
        )

        if not active_session:
            return False

        # Обновляем UserStreak через репозиторий
        streak = self.streak_repo.get_user_streak(
            viewer_id=viewer_id,
            channel_name=channel_name,
            platform=platform,
            user_id=user_id,
            session_id=session_id
        )

        if streak:
            # Обновляем только если это новая сессия
            if streak.last_stream_session_id != active_session.id:
                streak.last_stream_session_id = active_session.id
                streak.last_stream_attended_at = utcnow_naive()
                streak.updated_at = utcnow_naive()
                try:
                    self.streak_repo.update_streak(streak)
                    logger.debug(f"[OK] [STREAM SESSION] Marked viewer {viewer_id} attended stream session {active_session.id}")
                    return True
                except Exception as e:
                    logger.error(f"[ERROR] Error marking viewer attended stream: {e}")
                    self.db.rollback()
                    return False

        return False

    def check_viewer_attended_last_stream(
        self,
        user_id: int = None,
        session_id: str = None,
        channel_name: str = None,
        platform: str = "twitch",
        viewer_id: str = None
    ) -> bool:
        """Проверить, посетил ли зритель последнюю трансляцию
        
        Returns:
            True если зритель посетил последнюю трансляцию, False иначе
        """
        if not viewer_id:
            return False

        # Получаем последнюю сессию (активную или завершенную)
        last_session = self.get_last_session(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform
        )

        if not last_session:
            # Если нет сессий, считаем что зритель "посетил" (первая трансляция)
            return True

        # Получаем UserStreak
        streak = self.streak_repo.get_user_streak(
            viewer_id=viewer_id,
            channel_name=channel_name,
            platform=platform,
            user_id=user_id,
            session_id=session_id
        )

        if not streak:
            # Если нет стрика, считаем что зритель "посетил" (первая трансляция)
            return True

        # Проверяем, совпадает ли last_stream_session_id с последней сессией
        return streak.last_stream_session_id == last_session.id
