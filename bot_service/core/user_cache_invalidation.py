"""
User Cache Invalidation Helpers

Хелперы для инвалидации кеша пользователей при изменениях.
"""
import logging
from sqlalchemy.orm import Session
from core.user_cache import user_cache

logger = logging.getLogger(__name__)


def invalidate_user_cache(user_id: int, reason: str = "unknown"):
    """
    Инвалидировать кеш пользователя.
    
    Args:
        user_id: ID пользователя
        reason: Причина инвалидации (для логирования)
    """
    user_cache.invalidate(user_id)
    logger.info(f"[DELETE] User cache invalidated for user {user_id}: {reason}")


def update_user_role(user_id: int, new_role: str, db: Session):
    """
    Обновить роль пользователя и инвалидировать кеш.
    
    Args:
        user_id: ID пользователя
        new_role: Новая роль ('admin', 'user', 'guest')
        db: Database session
    """
    from core.database import User
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    old_role = user.role
    user.role = new_role
    db.commit()
    
    # Инвалидируем кеш
    invalidate_user_cache(user_id, f"role changed: {old_role} -> {new_role}")
    
    logger.info(f"[OK] User {user_id} role updated: {old_role} -> {new_role}")


def block_user(user_id: int, reason: str, db: Session):
    """
    Заблокировать пользователя и инвалидировать кеш.
    
    Args:
        user_id: ID пользователя
        reason: Причина блокировки
        db: Database session
    """
    from core.database import User
    from core.datetime_utils import utcnow_naive
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    user.is_blocked = True
    user.blocked_reason = reason
    user.blocked_at = utcnow_naive()
    user.is_active = False
    db.commit()
    
    # Инвалидируем кеш
    invalidate_user_cache(user_id, f"user blocked: {reason}")
    
    logger.warning(f"[WARN] User {user_id} blocked: {reason}")


def unblock_user(user_id: int, db: Session):
    """
    Разблокировать пользователя и инвалидировать кеш.
    
    Args:
        user_id: ID пользователя
        db: Database session
    """
    from core.database import User
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    user.is_blocked = False
    user.blocked_reason = None
    user.blocked_at = None
    user.is_active = True
    db.commit()
    
    # Инвалидируем кеш
    invalidate_user_cache(user_id, "user unblocked")
    
    logger.info(f"[OK] User {user_id} unblocked")


def update_user_username(user_id: int, platform: str, username: str, db: Session):
    """
    Обновить username пользователя и инвалидировать кеш.
    
    Args:
        user_id: ID пользователя
        platform: Платформа ('twitch', 'vk')
        username: Новый username
        db: Database session
    """
    from core.database import User
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    if platform == 'twitch':
        user.twitch_username = username
    elif platform == 'vk':
        user.vk_username = username
        user.vk_channel_name = username
    
    db.commit()
    
    # Инвалидируем кеш
    invalidate_user_cache(user_id, f"{platform} username updated: {username}")
    
    logger.info(f"[OK] User {user_id} {platform} username updated: {username}")
