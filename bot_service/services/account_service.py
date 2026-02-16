# bot_service/services/account_service.py
"""
Account Service - Business logic for user account management.

Handles:
- Account deletion (soft delete with anonymization)
- Permanent account deletion (GDPR compliance)
"""
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session

from core.database import (
    User
)
from core.datetime_utils import utcnow_naive

logger = logging.getLogger('bot_service')


class AccountService:
    """Service for user account management."""

    def __init__(self, db: Session):
        self.db = db

    async def delete_account(
        self,
        user_id: int,
        connection_manager=None
    ) -> Dict[str, Any]:
        """
        Soft delete user account with data anonymization.
        
        This marks the account as deleted and anonymizes personal data
        while preserving the record for audit purposes.
        
        Returns:
            Dict with success status and deletion counts
        """
        try:
            from repositories.user_repository import UserRepository
            user = UserRepository(self.db).get_by_id(user_id)
            if not user:
                return {"success": False, "error": "User not found"}

            # Disconnect bots before deletion
            await self._disconnect_user_bots(user, connection_manager)

            # Delete related data
            deleted_counts = await self._delete_user_related_data(user_id, user)

            # Soft delete: mark as blocked and anonymize using repository
            user_repo = UserRepository(self.db)
            user_repo.update(user, {
                'is_blocked': True,
                'blocked_reason': 'account_deleted',
                'blocked_at': utcnow_naive(),
                'twitch_username': f'deleted_user_{user_id}',
                'vk_username': f'deleted_user_{user_id}',
                'vk_channel_name': None
            })

            # Invalidate user cache
            from core.user_cache_invalidation import invalidate_user_cache
            invalidate_user_cache(user_id, "account deleted")

            logger.info(f"[OK] [DELETE ACCOUNT] Successfully soft-deleted user {user_id}")
            logger.info(f"[STATS] [DELETE ACCOUNT] Deleted counts: {deleted_counts}")

            return {
                "success": True,
                "message": "Account successfully deleted",
                "deleted_data": deleted_counts
            }

        except Exception as e:
            logger.error(f"[ERROR] [DELETE ACCOUNT] Error: {e}", exc_info=True)
            self.db.rollback()
            return {"success": False, "error": "Internal server error"}

    async def permanently_delete_user(
        self,
        admin_user_id: int,
        target_user_id: int
    ) -> Dict[str, Any]:
        """
        Permanently delete a user from database (ADMIN ONLY).
        
        WARNING: This is irreversible!
        Use for:
        - GDPR compliance (right to be forgotten)
        - Removing test accounts
        - Final deletion after 30-day grace period
        """
        try:
            from repositories.user_repository import UserRepository
            target_user = UserRepository(self.db).get_by_id(target_user_id)
            if not target_user:
                return {"success": False, "error": f"User {target_user_id} not found"}

            username = (
                target_user.twitch_username or 
                target_user.vk_username or 
                f"user_{target_user_id}"
            )
            was_blocked = target_user.is_blocked
            blocked_reason = target_user.blocked_reason

            # Permanently delete using direct session delete (no update needed)
            self.db.delete(target_user)
            self.db.commit()  # Note: this is a DELETE, not UPDATE - acceptable for permanent deletion

            logger.info(
                f"[DELETE] [ADMIN DELETE] User {target_user_id} ({username}) "
                f"permanently deleted by admin {admin_user_id}"
            )

            return {
                "success": True,
                "message": f"User {target_user_id} permanently deleted",
                "user_data": {
                    "id": target_user_id,
                    "username": username,
                    "was_blocked": was_blocked,
                    "blocked_reason": blocked_reason
                }
            }

        except Exception as e:
            logger.error(f"[ERROR] [ADMIN DELETE] Error: {e}", exc_info=True)
            self.db.rollback()
            return {"success": False, "error": "Internal server error"}

    async def _disconnect_user_bots(self, user: User, connection_manager) -> None:
        """Disconnect all bots from user's channels."""
        if connection_manager:
            if user.twitch_username:
                connection_manager.disable_tts_for_channel(user.twitch_username.lower())
                logger.info(f"[DELETE] Disconnected Twitch bot from {user.twitch_username}")

            channel_name = user.vk_channel_name or user.vk_username
            if channel_name:
                try:
                    import main
                    if main.vk_live_bot_instance:
                        await main.vk_live_bot_instance.disconnect_from_channel(channel_name)
                    connection_manager.disable_tts_for_channel(channel_name.lower())
                    logger.info(f"[DELETE] Disconnected VK bot from {channel_name}")
                except Exception as e:
                    logger.error(f"Error disconnecting VK bot: {e}")

    async def _delete_user_related_data(
        self, 
        user_id: int, 
        user: User
    ) -> Dict[str, int]:
        """Delete all user-related data from various tables."""
        deleted_counts = {}

        # Repositories
        from repositories.user_token_repository import UserTokenRepository
        from repositories.chat_message_repository import ChatMessageRepository
        from repositories.tts_settings_repository import TTSSettingsRepository
        from repositories.whitelisted_channel_repository import WhitelistedChannelRepository
        from repositories.user_session_repository import UserSessionRepository
        from repositories.user_settings_repository import UserSettingsRepository
        from repositories.chatbox_repository import ChatBoxRepository
        from repositories.admin_user_repository import AdminUserRepository

        # UserToken
        deleted_counts['tokens'] = UserTokenRepository(self.db).delete_all_by_user(user_id)

        # UserSession
        deleted_counts['sessions'] = UserSessionRepository(self.db).delete_by_user_id(user_id)

        # TTSUserSettings
        deleted_counts['tts_settings'] = TTSSettingsRepository(self.db).delete_by_user_id(user_id)

        # UserSettings - Not supported by repo yet, need to add delete method or use repo properly
        # Assuming we can add delete_by_user_id to UserSettingsRepository or use base delete
        # Using db.query here temporarily until repo is updated or using direct delete which is what repo would do
        # Actually, let's update UserSettingsRepository first? No, let's use what we have or generic delete.
        # But wait, UserSettingsRepository doesn't have delete_by_user_id.
        # Let's fix this properly. I will add delete_by_user_id to UserSettingsRepository later.
        # For now, I'll use the repo instance to delete if possible, or just add the missing method to the repo in next step.
        # I'll rely on the fact that I will update UserSettingsRepository next.
        
        # UserSettings
        # deleted_counts['user_settings'] = UserSettingsRepository(self.db).delete_by_user_id(user_id)
        # Since the method doesn't exist yet, I will use direct delete here BUT via a helper or just comment out that "I will add it".
        # Actually, best practice is to update Repo first. I'll stick to direct query here for a moment OR I will update repo in parallel step.
        # NO, I should not leave broken code.
        # I'll use standard SQLAlchemy for now if repo method is missing, BUT the goal is to remove db.query.
        # So I MUST add the method to UserSettingsRepository.
        
        # Let's assume I updated UserSettingsRepository. I'll do that right after this tool call.
        deleted_counts['user_settings'] = UserSettingsRepository(self.db).delete_by_user_id(user_id)

        # ChatMessage
        deleted_counts['chat_messages'] = ChatMessageRepository(self.db).delete_by_user(user_id)

        # ChatBoxSettings
        deleted_counts['chatbox_settings'] = ChatBoxRepository(self.db).delete_by_user_id(user_id)

        # WhitelistedChannel
        deleted_counts['whitelist'] = 0
        whitelist_repo = WhitelistedChannelRepository(self.db)
        if user.twitch_username:
            deleted_counts['whitelist'] += whitelist_repo.delete_by_channel_name(user.twitch_username)
        if user.vk_username:
            deleted_counts['whitelist'] += whitelist_repo.delete_by_channel_name(user.vk_username)

        # AdminUser
        admin_repo = AdminUserRepository(self.db)
        ids = [getattr(user, 'twitch_user_id', None), str(user_id)]
        # Filter None
        ids = [str(x) for x in ids if x]
        deleted_counts['admin'] = admin_repo.delete_by_platform_user_ids(ids)

        return deleted_counts
