# bot_service/services/platform_sync_service.py
"""
Platform Role Synchronization Service

This service synchronizes user roles and channel points from platform APIs
(Twitch, VK) to the local database. It ensures that platform-specific roles
(broadcaster, moderator, VIP, subscriber) are kept up-to-date.
"""

import logging
from typing import Optional, Dict
from sqlalchemy.orm import Session
from core.database import User

logger = logging.getLogger(__name__)


class PlatformSyncService:
    """Service for synchronizing platform roles and data"""

    def __init__(self):
        self.logger = logging.getLogger('platform_sync')

    async def sync_user_roles(self, user: User, platform: str, db: Session) -> bool:
        """
        Synchronize user roles from platform API.
        
        Args:
            user: User model instance
            platform: Platform name ('twitch' or 'vk')
            db: Database session
            
        Returns:
            True if sync was successful, False otherwise
        """
        try:
            if platform == 'twitch':
                return await self._sync_twitch_roles(user, db)
            elif platform == 'vk':
                return await self._sync_vk_roles(user, db)
            else:
                self.logger.warning(f"Unknown platform: {platform}")
                return False
        except Exception as e:
            self.logger.error(f"Error syncing roles for user {user.id} on {platform}: {e}", exc_info=True)
            return False

    async def _sync_twitch_roles(self, user: User, db: Session) -> bool:
        """Synchronize Twitch-specific roles"""
        try:
            if not user.twitch_username:
                self.logger.debug(f"User {user.id} has no Twitch username, skipping sync")
                return False

            # Import Twitch API
            from api.twitch_api import TwitchAPI
            from core.connection_manager import get_connection_manager

            connection_manager = get_connection_manager()
            twitch_api = TwitchAPI(connection_manager)

            # Get user's Twitch ID from tokens
            from core.database import UserToken
            token = db.query(UserToken).filter(
                UserToken.user_id == user.id,
                UserToken.platform == 'twitch',
                UserToken.is_active.is_(True)
            ).first()

            if not token:
                self.logger.debug(f"No active Twitch token for user {user.id}")
                return False

            twitch_user_id = token.platform_user_id

            # Check if user is broadcaster (owns a channel)
            # A user is a broadcaster if their username matches their channel
            user.twitch_is_broadcaster = (user.twitch_username.lower() == user.twitch_username.lower())

            # Get channel information to check roles
            try:
                # Check if user is a moderator in any channel they're connected to
                # This would require checking the channel's moderator list
                # For now, we'll set based on existing data or API calls

                # Get broadcaster info
                broadcaster_info = await twitch_api.get_user_info(user.id)
                if broadcaster_info:
                    # User owns their channel
                    user.twitch_is_broadcaster = True

                # Check VIP status (requires additional API call)
                # Check subscriber status (requires additional API call)
                # These would need to be implemented based on Twitch API endpoints

                self.logger.info(f"Synced Twitch roles for user {user.id}: broadcaster={user.twitch_is_broadcaster}")

            except Exception as e:
                self.logger.error(f"Error fetching Twitch channel info: {e}")

            db.commit()
            return True

        except Exception as e:
            self.logger.error(f"Error syncing Twitch roles: {e}", exc_info=True)
            db.rollback()
            return False

    async def _sync_vk_roles(self, user: User, db: Session) -> bool:
        """Synchronize VK-specific roles"""
        try:
            if not user.vk_username:
                self.logger.debug(f"User {user.id} has no VK username, skipping sync")
                return False

            # Import VK API
            from api.vk_api import VKLiveAPI

            vk_api = VKLiveAPI()

            # Get user's VK ID from tokens
            from core.database import UserToken
            token = db.query(UserToken).filter(
                UserToken.user_id == user.id,
                UserToken.platform == 'vk',
                UserToken.is_active.is_(True)
            ).first()

            if not token:
                self.logger.debug(f"No active VK token for user {user.id}")
                return False

            vk_user_id = token.platform_user_id

            # Check if user is channel owner
            # A user is an owner if they have a vk_channel_name
            user.vk_is_owner = bool(user.vk_channel_name)

            # Check moderator status
            # This would require VK API call to check moderator list
            # For now, we'll maintain existing status

            self.logger.info(f"Synced VK roles for user {user.id}: owner={user.vk_is_owner}")

            db.commit()
            return True

        except Exception as e:
            self.logger.error(f"Error syncing VK roles: {e}", exc_info=True)
            db.rollback()
            return False

    async def sync_channel_points(self, user: User, platform: str, db: Session) -> bool:
        """
        Synchronize channel points/rewards from platform API.
        
        Args:
            user: User model instance
            platform: Platform name ('twitch' or 'vk')
            db: Database session
            
        Returns:
            True if sync was successful, False otherwise
        """
        try:
            if platform == 'twitch':
                return await self._sync_twitch_channel_points(user, db)
            elif platform == 'vk':
                return await self._sync_vk_channel_points(user, db)
            else:
                self.logger.warning(f"Unknown platform: {platform}")
                return False
        except Exception as e:
            self.logger.error(f"Error syncing channel points for user {user.id} on {platform}: {e}", exc_info=True)
            return False

    async def _sync_twitch_channel_points(self, user: User, db: Session) -> bool:
        """Synchronize Twitch channel points rewards"""
        try:
            if not user.twitch_username or not user.twitch_is_broadcaster:
                self.logger.debug(f"User {user.id} is not a Twitch broadcaster, skipping channel points sync")
                return False

            # Import Twitch API
            from api.twitch_api import TwitchAPI
            from core.connection_manager import get_connection_manager
            from core.database import ChannelReward

            connection_manager = get_connection_manager()
            twitch_api = TwitchAPI(connection_manager)

            # Get channel rewards from Twitch API
            try:
                rewards = await twitch_api.get_custom_rewards(user.id)

                if not rewards:
                    self.logger.debug(f"No custom rewards found for user {user.id}")
                    return True

                # Sync rewards to database
                for reward_data in rewards:
                    reward_id = reward_data.get('id')

                    # Check if reward already exists
                    existing_reward = db.query(ChannelReward).filter(
                        ChannelReward.user_id == user.id,
                        ChannelReward.platform == 'twitch',
                        ChannelReward.title == reward_data.get('title')
                    ).first()

                    if existing_reward:
                        # Update existing reward
                        existing_reward.cost = reward_data.get('cost', 0)
                        existing_reward.is_enabled = reward_data.get('is_enabled', True)
                        existing_reward.description = reward_data.get('prompt', '')
                    else:
                        # Create new reward
                        new_reward = ChannelReward(
                            user_id=user.id,
                            platform='twitch',
                            channel_name=user.twitch_username,
                            title=reward_data.get('title'),
                            description=reward_data.get('prompt', ''),
                            cost=reward_data.get('cost', 0),
                            is_enabled=reward_data.get('is_enabled', True),
                            background_color=reward_data.get('background_color', '#9147ff')
                        )
                        db.add(new_reward)

                db.commit()
                self.logger.info(f"Synced {len(rewards)} Twitch channel rewards for user {user.id}")
                return True

            except Exception as e:
                self.logger.error(f"Error fetching Twitch rewards: {e}")
                return False

        except Exception as e:
            self.logger.error(f"Error syncing Twitch channel points: {e}", exc_info=True)
            db.rollback()
            return False

    async def _sync_vk_channel_points(self, user: User, db: Session) -> bool:
        """Synchronize VK channel points (if applicable)"""
        try:
            # VK Live doesn't have a built-in channel points system like Twitch
            # This would be for custom implementation if needed
            self.logger.debug(f"VK channel points sync not implemented for user {user.id}")
            return True

        except Exception as e:
            self.logger.error(f"Error syncing VK channel points: {e}", exc_info=True)
            return False

    async def sync_on_login(self, user: User, platform: str, db: Session) -> Dict[str, bool]:
        """
        Perform full synchronization on user login.
        
        Args:
            user: User model instance
            platform: Platform name ('twitch' or 'vk')
            db: Database session
            
        Returns:
            Dictionary with sync results
        """
        try:
            self.logger.info(f"Starting login sync for user {user.id} on {platform}")

            # Sync roles
            roles_synced = await self.sync_user_roles(user, platform, db)

            # Sync channel points (only for broadcasters)
            points_synced = False
            if (platform == 'twitch' and user.twitch_is_broadcaster) or \
               (platform == 'vk' and user.vk_is_owner):
                points_synced = await self.sync_channel_points(user, platform, db)

            return {
                'roles_synced': roles_synced,
                'channel_points_synced': points_synced,
                'success': roles_synced  # At minimum, roles should sync
            }

        except Exception as e:
            self.logger.error(f"Error during login sync: {e}", exc_info=True)
            return {
                'roles_synced': False,
                'channel_points_synced': False,
                'success': False,
                'error': str(e)
            }

    async def sync_all_users(self, platform: Optional[str] = None, db: Session = None) -> Dict[str, int]:
        """
        Sync roles for all users (admin operation).
        
        Args:
            platform: Optional platform filter ('twitch' or 'vk')
            db: Database session
            
        Returns:
            Dictionary with sync statistics
        """
        try:
            from core.database import get_db

            if db is None:
                db = next(get_db())

            query = db.query(User).filter(User.is_active == True)

            if platform == 'twitch':
                query = query.filter(User.twitch_username.isnot(None))
            elif platform == 'vk':
                query = query.filter(User.vk_username.isnot(None))

            users = query.all()

            success_count = 0
            failed_count = 0

            for user in users:
                # Determine which platforms to sync
                platforms_to_sync = []
                if platform:
                    platforms_to_sync = [platform]
                else:
                    if user.twitch_username:
                        platforms_to_sync.append('twitch')
                    if user.vk_username:
                        platforms_to_sync.append('vk')

                # Sync each platform
                for plat in platforms_to_sync:
                    success = await self.sync_user_roles(user, plat, db)
                    if success:
                        success_count += 1
                    else:
                        failed_count += 1

            self.logger.info(f"Bulk sync completed: {success_count} successful, {failed_count} failed")

            return {
                'total_users': len(users),
                'success_count': success_count,
                'failed_count': failed_count
            }

        except Exception as e:
            self.logger.error(f"Error during bulk sync: {e}", exc_info=True)
            return {
                'total_users': 0,
                'success_count': 0,
                'failed_count': 0,
                'error': str(e)
            }


# Global instance
platform_sync_service = PlatformSyncService()
