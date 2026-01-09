# bot_service/repositories/drops_history_repository.py
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func

from repositories.base_repository import BaseRepository
from core.database import DropsHistory, UserStreak


class DropsHistoryRepository(BaseRepository[DropsHistory]):
    """
    Repository for DropsHistory and UserStreak entities.
    Handles user streaks and drops history.
    """
    def __init__(self, db: Session):
        super().__init__(DropsHistory, db)

    # === UserStreak ===

    def get_user_streak_for_update(
        self,
        viewer_id: str,
        channel_name: str,
        platform: str,
        user_id: int = None,
        session_id: str = None
    ) -> Optional[UserStreak]:
        """Get user streak record with pessimistic lock."""
        filters = [
            UserStreak.viewer_id == viewer_id,
            UserStreak.channel_name == channel_name,
            UserStreak.platform == platform
        ]

        if user_id:
            filters.append(UserStreak.user_id == user_id)
        elif session_id:
            filters.append(UserStreak.session_id == session_id)
        else:
            return None

        return self.db.query(UserStreak).filter(and_(*filters)).with_for_update().first()

    def get_user_streak(
        self,
        viewer_id: str,
        channel_name: str,
        platform: str,
        user_id: int = None,
        session_id: str = None
    ) -> Optional[UserStreak]:
        """Get user streak record."""
        filters = [
            UserStreak.viewer_id == viewer_id,
            UserStreak.channel_name == channel_name,
            UserStreak.platform == platform
        ]

        if user_id:
            filters.append(UserStreak.user_id == user_id)
        elif session_id:
            filters.append(UserStreak.session_id == session_id)
        else:
            return None

        return self.db.query(UserStreak).filter(and_(*filters)).first()

    def update_streak(self, streak: UserStreak) -> UserStreak:
        """Update streak record."""
        self.db.commit()
        self.db.refresh(streak)
        return streak

    def add_streak(self, streak: UserStreak) -> UserStreak:
        """Add new streak record."""
        self.db.add(streak)
        self.db.commit()
        self.db.refresh(streak)
        return streak

    def create_history_entry(
        self,
        user_id: int,
        channel_name: str,
        platform: str,
        viewer_id: str,
        viewer_name: str,
        lootbox_type: str,
        quality_id: int = None,
        reward_id: int = None,
        reward_name: str = None,
        reward_type: str = None,
        reward_value: str = None,
        donation_amount: float = None,
        streak_days: int = None,
        messages_count: int = None
    ) -> DropsHistory:
        """Create a new drops history entry."""
        entry = DropsHistory(
            user_id=user_id,
            channel_name=channel_name,
            platform=platform,
            viewer_id=viewer_id,
            viewer_name=viewer_name,
            lootbox_type=lootbox_type,
            quality_id=quality_id,
            reward_id=reward_id,
            reward_name=reward_name,
            reward_type=reward_type,
            reward_value=reward_value,
            donation_amount=donation_amount,
            streak_days=streak_days,
            messages_count=messages_count
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    # === DropsHistory ===
    
    # === DropsHistory ===
    
    def get_history(self, 
                    channel_name: str, 
                    platform: str, 
                    user_id: int = None, 
                    session_id: str = None, 
                    limit: int = 50, 
                    offset: int = 0) -> List[DropsHistory]:
        query = self.db.query(DropsHistory).filter(
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        )

        if user_id:
            query = query.filter(DropsHistory.user_id == user_id)
        elif session_id:
            query = query.filter(DropsHistory.session_id == session_id)
        else:
             return [] # Requirement from service logic

        return query.order_by(desc(DropsHistory.created_at)).offset(offset).limit(limit).all()

    def count_drops(self, 
                   channel_name: str, 
                   platform: str, 
                   user_id: int = None, 
                   session_id: str = None,
                   lootbox_type: str = None,
                   after_date = None) -> int:
        query = self.db.query(func.count(DropsHistory.id)).filter(
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform
        )

        if user_id:
            query = query.filter(DropsHistory.user_id == user_id)
        elif session_id:
            query = query.filter(DropsHistory.session_id == session_id)
            
        if lootbox_type:
            query = query.filter(DropsHistory.lootbox_type == lootbox_type)
            
        if after_date:
            query = query.filter(DropsHistory.created_at >= after_date)
            
        return query.scalar() or 0

    def get_channel_stats(self, user_id: int, channel_name: str, platform: str):
        """Aggregate stats using SQL"""
        base_filter = and_(
             DropsHistory.user_id == user_id,
             DropsHistory.channel_name == channel_name,
             DropsHistory.platform == platform
        )
        
        # This mirrors get_full_channel_stats aggregation
        # We can expose flexible methods or specific ones.
        return self.db.query(DropsHistory).filter(base_filter)

    def count_legendary_drops(self, 
                             channel_name: str, 
                             platform: str, 
                             user_id: int = None, 
                             session_id: str = None):
        """Count drops with Legendary quality."""
        from models.drops import DropsQuality
        query = self.db.query(func.count(DropsHistory.id)).join(DropsQuality).filter(
            DropsHistory.channel_name == channel_name,
            DropsHistory.platform == platform,
            DropsQuality.name == "Legendary"
        )
        if user_id:
            query = query.filter(DropsHistory.user_id == user_id)
        elif session_id:
            query = query.filter(DropsHistory.session_id == session_id)
        return query.scalar() or 0

    def get_top_viewers(self, user_id: int, channel_name: str, platform: str, limit: int = 10):
        return self.db.query(
            DropsHistory.viewer_name,
            func.count(DropsHistory.id).label('drops_count')
        ).filter(
             DropsHistory.user_id == user_id,
             DropsHistory.channel_name == channel_name,
             DropsHistory.platform == platform
        ).group_by(DropsHistory.viewer_name).order_by(
            func.count(DropsHistory.id).desc()
        ).limit(limit).all()
        
    def get_streaks_paginated(self, 
                              user_id: int, 
                              channel_name: str, 
                              platform: str = None, 
                              limit: int = 50, 
                              offset: int = 0) -> List[UserStreak]:
        query = self.db.query(UserStreak).filter(
            UserStreak.user_id == user_id,
            UserStreak.channel_name == channel_name
        )
        if platform:
            query = query.filter(UserStreak.platform == platform)
        
        return query.order_by(desc(UserStreak.current_streak)).offset(offset).limit(limit).all()

    def reset_channel_streaks(self, user_id: int, channel_name: str) -> int:
        deleted = self.db.query(UserStreak).filter(
            UserStreak.user_id == user_id,
            UserStreak.channel_name == channel_name
        ).delete(synchronize_session=False)
        self.db.commit()
        return deleted

    # === Mythical ===
    from models.drops import MythicalDropsSession # Deferred import or use string if model in same base? 
    # Better to import at top if possible, or use 'MythicalDropsSession' if available in scope.
    # It's not imported at top of file currently.
    
    def get_active_mythical_session(self, 
                                    channel_name: str, 
                                    now_time,
                                    user_id: int = None, 
                                    session_id: str = None):
        # We need to import MythicalDropsSession.
        # Check imports at top.
        from models.drops import MythicalDropsSession
        
        query = self.db.query(MythicalDropsSession).filter(
            MythicalDropsSession.channel_name == channel_name,
            MythicalDropsSession.is_active == True,
            MythicalDropsSession.expires_at > now_time
        )
        
        if user_id:
            query = query.filter(MythicalDropsSession.user_id == user_id)
        elif session_id:
            query = query.filter(MythicalDropsSession.session_id == session_id)
        else:
            return None
            
    def add_mythical_session(self, session: MythicalDropsSession) -> MythicalDropsSession:
        """Add new mythical drops session."""
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def update_mythical_session(self, session: MythicalDropsSession) -> MythicalDropsSession:
        """Update mythical drops session."""
        self.db.commit()
        self.db.refresh(session)
        return session

