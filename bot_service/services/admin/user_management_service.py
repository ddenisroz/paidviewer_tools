# bot_service/services/admin/user_management_service.py
"""
Сервис управления пользователями.
"""

import logging
from typing import List

from sqlalchemy.orm import Session

from core.datetime_utils import utcnow_naive
from core.user_cache_invalidation import invalidate_user_cache
from models.pydantic_models import UserPublic


from repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)


class UserManagementService:
    """Сервис для управления пользователями."""

    async def get_users(self, db: Session) -> List[UserPublic]:
        """Получить список всех пользователей."""
        repo = UserRepository(db)
        users = repo.get_all()
        return [UserPublic.model_validate(user) for user in users]

    async def update_user(
        self, user_id: int, request: dict, db: Session
    ) -> dict:
        """Обновить пользователя."""
        repo = UserRepository(db)
        user = repo.get(user_id)
        if not user:
            return {"error": "User not found"}

        changes = []

        # Обновляем роль (is_admin deprecated, используем role)
        if 'is_admin' in request:
            logger.warning("[WARN] is_admin field is deprecated, use role instead")
            if request['is_admin'] and user.role != 'admin':
                user.role = 'admin'
                changes.append("role: user -> admin")
            elif not request['is_admin'] and user.role == 'admin':
                user.role = 'user'
                changes.append("role: admin -> user")

        if 'role' in request and request['role'] in ('admin', 'user', 'guest'):
            if user.role != request['role']:
                old_role = user.role
                user.role = request['role']
                changes.append(f"role: {old_role} -> {request['role']}")

        repo.update(user)

        if changes:
            invalidate_user_cache(user_id, f"updated: {', '.join(changes)}")

        logger.info(f"User {user_id} updated: {', '.join(changes) if changes else 'no changes'}")
        return {"message": f"User {user_id} updated successfully"}

    async def delete_user(self, user_id: int, db: Session) -> dict:
        """Удалить пользователя."""
        repo = UserRepository(db)
        user = repo.get(user_id)
        if not user:
            return {"error": "User not found"}

        repo.delete(user)

        logger.info(f"[DELETE] User {user_id} deleted")
        return {"message": f"User {user_id} deleted successfully"}

    async def block_user(
        self, user_id: int, request: dict, db: Session
    ) -> dict:
        """Заблокировать пользователя."""
        repo = UserRepository(db)
        user = repo.get(user_id)
        if not user:
            return {"error": "User not found"}

        reason = request.get('reason', 'Blocked by administrator')

        user.is_blocked = True
        user.blocked_reason = reason
        user.blocked_at = utcnow_naive()

        repo.update(user)

        invalidate_user_cache(user_id, f"blocked: {reason}")

        logger.info(f"[BLOCK] User {user_id} blocked: {reason}")
        return {"message": f"User {user_id} blocked successfully"}

    async def unblock_user(self, user_id: int, db: Session) -> dict:
        """Разблокировать пользователя."""
        repo = UserRepository(db)
        user = repo.get(user_id)
        if not user:
            return {"error": "User not found"}

        user.is_blocked = False
        user.blocked_reason = None
        user.blocked_at = None

        repo.update(user)

        invalidate_user_cache(user_id, "unblocked")

        logger.info(f"[UNBLOCK] User {user_id} unblocked")
        return {"message": f"User {user_id} unblocked successfully"}


# Singleton instance
user_management_service = UserManagementService()
