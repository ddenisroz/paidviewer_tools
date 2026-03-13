# features/drops/drops_streak_service.py
"""Drops Streak management and Donation/Streak event processing"""
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from core.database import UserStreak, DropsConfig
from core.datetime_utils import utcnow_naive
from services.stream_session_service import StreamSessionService
from repositories.drops_history_repository import DropsHistoryRepository

logger = logging.getLogger(__name__)


class DropsStreakMixin:
    """Mixin for User Streak management and Streak/Donation event processing
    
    Requires DropsConfigMixin for config and reward methods.
    Assumes self.db and self.history_repo are available (provided by DropsService).
    """

    # self.db must be available in the usage class
    db: Session
    # We expect history_repo to be available or we create it
    history_repo: Optional[DropsHistoryRepository] = None

    # Expected methods from DropsConfigMixin
    def get_config(self, **kwargs): pass
    def get_quality_by_name(self, name): pass
    def _get_random_reward(self, **kwargs): pass
    def _record_drops_history(self, **kwargs): pass
    
    # Expected method from DropsMythicalMixin or self
    def _check_stream_online(self, **kwargs): pass
    
    def _ensure_repo(self):
        if not getattr(self, 'history_repo', None):
             self.history_repo = DropsHistoryRepository(self.db)
        return self.history_repo

    def get_user_streak_for_user(
        self,
        user_id: int,
        channel_name: str = None,
        platform: str = "twitch",
        viewer_id: str = None,
    ) -> Optional[UserStreak]:
        """Active user-only wrapper for streak lookup."""
        return self.get_user_streak(
            user_id=user_id,
            session_id=None,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
        )

    def update_user_streak_for_user(
        self,
        user_id: int,
        channel_name: str = None,
        platform: str = "twitch",
        viewer_id: str = None,
        viewer_name: str = None,
        is_streaming: bool = True,
    ) -> UserStreak:
        """Active user-only wrapper for streak updates."""
        return self.update_user_streak(
            user_id=user_id,
            session_id=None,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
            is_streaming=is_streaming,
        )

    def increment_viewer_message_count_for_user(
        self,
        user_id: int,
        channel_name: str = None,
        platform: str = "twitch",
        viewer_id: str = None,
        viewer_name: str = None,
    ) -> UserStreak:
        """Active user-only wrapper for per-viewer message counters."""
        return self.increment_viewer_message_count(
            user_id=user_id,
            session_id=None,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
        )

    def process_streak_drops_for_user(
        self,
        user_id: int,
        channel_name: str = None,
        platform: str = "twitch",
        viewer_id: str = None,
        viewer_name: str = None,
    ) -> Optional[Dict[str, Any]]:
        """Active user-only wrapper for streak drops processing."""
        return self.process_streak_drops(
            user_id=user_id,
            session_id=None,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
        )

    def process_donation_drops_for_user(
        self,
        user_id: int,
        channel_name: str = None,
        platform: str = "twitch",
        viewer_id: str = None,
        viewer_name: str = None,
        donation_amount: float = None,
    ) -> Optional[Dict[str, Any]]:
        """Active user-only wrapper for donation drops processing."""
        return self.process_donation_drops(
            user_id=user_id,
            session_id=None,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
            donation_amount=donation_amount,
        )

    def get_user_streak(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None) -> Optional[UserStreak]:
        """Получает стрик пользователя"""
        repo = self._ensure_repo()
        return repo.get_user_streak(viewer_id, channel_name, platform, user_id, session_id)

    def update_user_streak(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None, is_streaming: bool = True) -> UserStreak:
        """Обновляет стрик пользователя"""
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=None)
        if not config:
            logger.warning(f"No config found for streak update: channel={channel_name}, viewer={viewer_name}")
            return None

        repo = self._ensure_repo()
        # Pessimistic locking to prevent race conditions
        streak = repo.get_user_streak_for_update(viewer_id, channel_name, platform, user_id, session_id)
        
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
            # Add early to session if needed for lock? No, add later is fine.
            repo.add_streak(streak) # This adds and commits.
            # But wait, we want to hold the transaction if we were locking?
            # If we just created it, we don't hold a lock on a row that didn't exist.
            # But add_streak commits.
            pass

        now = utcnow_naive()
        stream_session_service = StreamSessionService(self.db)

        # Check online status using the helper method (assumed to be available in class)
        is_stream_online = self._check_stream_online(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform)

        if not is_stream_online:
            streak.last_activity = now
            streak.updated_at = now
            repo.update_streak(streak) # commits
            return streak

        active_session = stream_session_service.get_or_create_active_session(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform
        )

        if not active_session:
            streak.last_activity = now
            streak.updated_at = now
            repo.update_streak(streak)
            return streak

        stream_session_service.mark_viewer_attended_stream(
            user_id=user_id,
            session_id=session_id,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id
        )

        is_new_stream = streak.last_stream_session_id != active_session.id

        if is_new_stream:
            if streak.last_stream_session_id is None:
                attended_previous = True
            else:
                attended_previous = stream_session_service.check_viewer_attended_last_stream(
                    user_id=user_id,
                    session_id=session_id,
                    channel_name=channel_name,
                    platform=platform,
                    viewer_id=viewer_id
                )

            if attended_previous and streak.messages_this_stream >= config.streak_messages_required:
                streak.current_streak += 1
                streak.max_streak = max(streak.max_streak, streak.current_streak)
                logger.info(f"[OK] Streak +1 for {viewer_name}: {streak.current_streak} (messages: {streak.messages_this_stream}/{config.streak_messages_required})")
            elif not attended_previous:
                if config.streak_reset_on_skip and streak.current_streak > 0:
                    logger.info(f"[ERROR] Streak reset for {viewer_name}: skipped stream")
                    streak.current_streak = 0
                else:
                    logger.info(f"[STREAK] Streak paused for {viewer_name}: skipped stream (reset disabled)")
            else:
                if config.streak_reset_on_skip and streak.current_streak > 0:
                    logger.info(f"[ERROR] Streak reset for {viewer_name}: insufficient messages")
                    streak.current_streak = 0
                else:
                    logger.info(f"[STREAK] Streak paused for {viewer_name}: insufficient messages (reset disabled)")

            streak.messages_this_stream = 0

        streak.last_activity = now
        streak.updated_at = now

        try:
            repo.update_streak(streak)
        except Exception:
            logger.exception("[ERROR] Error updating streak for {viewer_name}")
            self.db.rollback()
            raise

        return streak

    def increment_viewer_message_count(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None) -> UserStreak:
        """Увеличивает счетчик сообщений зрителя за текущий стрим"""
        repo = self._ensure_repo()
        # We should use locking if concurrent updates likely, but simple increment usually ok.
        # But get_user_streak might suffice.
        streak = self.get_user_streak(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id)

        if not streak:
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
            repo.add_streak(streak)
        else:
            streak.messages_this_stream += 1
            streak.last_activity = utcnow_naive()
            streak.updated_at = utcnow_naive()
            repo.update_streak(streak)

        return streak

    def process_streak_drops(self, user_id: int = None, session_id: str = None, channel_name: str = None, platform: str = "twitch", viewer_id: str = None, viewer_name: str = None) -> Optional[Dict[str, Any]]:
        """Обрабатывает стрик Drops"""
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=None)
        if not config:
            return None

        streak_enabled = False
        if platform == "twitch":
            streak_enabled = getattr(config, 'streak_enabled_twitch', False)
        elif platform == "vk":
            streak_enabled = getattr(config, 'streak_enabled_vk', False)

        if not streak_enabled:
            return None

        streak = self.update_user_streak(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, viewer_id=viewer_id, viewer_name=viewer_name)

        quality_name = self._get_streak_quality(streak.current_streak, config)
        if not quality_name:
            return None

        quality = self.get_quality_by_name(quality_name)
        if not quality:
            return None

        reward = self._get_random_reward(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, quality_id=quality.id)
        if not reward:
            return None

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
        """Обрабатывает донатные Drops (общие, не зависят от платформы)"""
        config = self.get_config(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=None)
        if not config or not config.donation_enabled:
            return None

        quality_name = self._get_donation_quality(donation_amount, config)
        if not quality_name:
            return None

        quality = self.get_quality_by_name(quality_name)
        if not quality:
            return None

        reward = self._get_random_reward(user_id=user_id, session_id=session_id, channel_name=channel_name, platform=platform, quality_id=quality.id)
        if not reward:
            return None

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

