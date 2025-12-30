# bot_service/api/admin/users_management.py
"""Admin-only user management endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from core.database import get_db, User, UserSettings, ChatMessage, UserSession
from auth.auth import get_current_user
from core.permissions import require_permission, Permission, require_role, AppRole
from datetime import timedelta
from core.datetime_utils import utcnow_naive
from typing import Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class UserBlockRequest(BaseModel):
    """Request model for blocking a user"""
    reason: str


class UserUpdateRequest(BaseModel):
    """Request model for updating user"""
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None


@router.get("/list")
@require_permission(Permission.VIEW_ALL_SETTINGS)
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of all users (admin only).
    
    Requires: VIEW_ALL_SETTINGS permission
    """
    try:
        query = db.query(User)

        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    User.twitch_username.ilike(search_term),
                    User.vk_username.ilike(search_term),
                    User.vk_channel_name.ilike(search_term)
                )
            )

        # Get total count
        total = query.count()

        # Get paginated results
        users = query.offset(skip).limit(limit).all()

        users_data = []
        for user in users:
            users_data.append({
                'id': user.id,
                'role': user.role,
                'is_admin': user.is_admin,
                'is_active': user.is_active,
                'is_blocked': user.is_blocked,
                'twitch_username': user.twitch_username,
                'vk_username': user.vk_username,
                'vk_channel_name': user.vk_channel_name,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'blocked_at': user.blocked_at.isoformat() if user.blocked_at else None,
                'blocked_reason': user.blocked_reason,
                # Platform roles
                'twitch_is_broadcaster': user.twitch_is_broadcaster,
                'twitch_is_moderator': user.twitch_is_moderator,
                'vk_is_owner': user.vk_is_owner,
                'vk_is_moderator': user.vk_is_moderator,
            })

        return {
            "success": True,
            "total": total,
            "users": users_data,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error getting users list: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
@require_permission(Permission.VIEW_ALL_SETTINGS)
async def get_user_details(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific user (admin only).
    
    Requires: VIEW_ALL_SETTINGS permission
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get user settings
        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()

        # Get user sessions
        sessions = db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active.is_(True)
        ).all()

        # Get message count
        message_count = db.query(ChatMessage).filter(
            ChatMessage.user_id == user_id
        ).count()

        return {
            "success": True,
            "user": {
                'id': user.id,
                'role': user.role,
                'is_admin': user.is_admin,
                'is_active': user.is_active,
                'is_blocked': user.is_blocked,
                'twitch_username': user.twitch_username,
                'vk_username': user.vk_username,
                'vk_channel_name': user.vk_channel_name,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'blocked_at': user.blocked_at.isoformat() if user.blocked_at else None,
                'blocked_reason': user.blocked_reason,
                'tts_enabled': user.tts_enabled,
                'tts_listening_mode': user.tts_listening_mode,
                # Platform roles
                'twitch_is_broadcaster': user.twitch_is_broadcaster,
                'twitch_is_moderator': user.twitch_is_moderator,
                'twitch_is_vip': user.twitch_is_vip,
                'twitch_is_subscriber': user.twitch_is_subscriber,
                'vk_is_owner': user.vk_is_owner,
                'vk_is_moderator': user.vk_is_moderator,
            },
            "settings": {
                'chat_enabled': settings.chat_enabled if settings else False,
                'channel_name': settings.channel_name if settings else None,
                'vk_channel_name': settings.vk_channel_name if settings else None,
            } if settings else None,
            "stats": {
                'active_sessions': len(sessions),
                'total_messages': message_count
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/block")
@require_permission(Permission.BLOCK_USERS)
async def block_user(
    user_id: int,
    request: UserBlockRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Block a user (admin only).
    
    Requires: BLOCK_USERS permission
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Prevent blocking admins
        if user.role == 'admin':
            raise HTTPException(status_code=403, detail="Cannot block admin users")

        user.is_blocked = True
        user.blocked_reason = request.reason
        user.blocked_at = utcnow_naive()
        user.is_active = False

        db.commit()

        # [OK] Инвалидируем кеш пользователя
        from core.user_cache_invalidation import invalidate_user_cache
        invalidate_user_cache(user_id, f"blocked by admin: {request.reason}")

        logger.info(f"User {user_id} blocked by admin {current_user.get('id')}: {request.reason}")

        return {
            "success": True,
            "message": f"User {user_id} has been blocked"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking user: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/unblock")
@require_permission(Permission.BLOCK_USERS)
async def unblock_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unblock a user (admin only).
    
    Requires: BLOCK_USERS permission
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.is_blocked = False
        user.blocked_reason = None
        user.blocked_at = None
        user.is_active = True

        db.commit()

        # [OK] Инвалидируем кеш пользователя
        from core.user_cache_invalidation import invalidate_user_cache
        invalidate_user_cache(user_id, "unblocked by admin")

        logger.info(f"User {user_id} unblocked by admin {current_user.get('id')}")

        return {
            "success": True,
            "message": f"User {user_id} has been unblocked"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking user: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}")
@require_permission(Permission.MANAGE_USERS)
async def update_user(
    user_id: int,
    request: UserUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user properties (admin only).
    
    Requires: MANAGE_USERS permission
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        changes = []

        # Update fields if provided
        if request.is_active is not None and user.is_active != request.is_active:
            user.is_active = request.is_active
            changes.append(f"is_active={request.is_active}")

        if request.role is not None and user.role != request.role:
            # Validate role
            valid_roles = ['admin', 'user', 'guest']
            if request.role not in valid_roles:
                raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
            old_role = user.role
            user.role = request.role
            changes.append(f"role: {old_role} -> {request.role}")

        # [WARN] DEPRECATED: is_admin field is deprecated, use role instead
        # Kept for backward compatibility only
        if request.is_admin is not None:
            logger.warning("[WARN] is_admin field is deprecated, use role instead")
            if request.is_admin and user.role != 'admin':
                user.role = 'admin'
                changes.append("role: user -> admin (via is_admin)")
            elif not request.is_admin and user.role == 'admin':
                user.role = 'user'
                changes.append("role: admin -> user (via is_admin)")

        db.commit()

        # [OK] Инвалидируем кеш пользователя если были изменения
        if changes:
            from core.user_cache_invalidation import invalidate_user_cache
            invalidate_user_cache(user_id, f"updated by admin: {', '.join(changes)}")

        logger.info(f"User {user_id} updated by admin {current_user.get('id')}: {', '.join(changes)}")

        return {
            "success": True,
            "message": f"User {user_id} has been updated",
            "user": {
                'id': user.id,
                'role': user.role,
                'is_admin': user.role == 'admin',  # Вычисляемое поле
                'is_active': user.is_active
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}")
@require_role(AppRole.ADMIN)
async def delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a user (admin only).
    
    Requires: ADMIN role
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Prevent deleting admins
        if user.is_admin or user.role == 'admin':
            raise HTTPException(status_code=403, detail="Cannot delete admin users")

        # Prevent self-deletion
        if user.id == current_user.get('id'):
            raise HTTPException(status_code=403, detail="Cannot delete yourself")

        db.delete(user)
        db.commit()

        logger.warning(f"User {user_id} deleted by admin {current_user.get('id')}")

        return {
            "success": True,
            "message": f"User {user_id} has been deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/overview")
@require_permission(Permission.VIEW_ALL_SETTINGS)
async def get_stats_overview(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get system statistics overview (admin only).
    
    Requires: VIEW_ALL_SETTINGS permission
    """
    try:
        # User statistics
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active.is_(True)).count()
        blocked_users = db.query(User).filter(User.is_blocked.is_(True)).count()
        admin_users = db.query(User).filter(User.role == 'admin').count()

        # Platform statistics
        twitch_users = db.query(User).filter(User.twitch_username.isnot(None)).count()
        vk_users = db.query(User).filter(User.vk_username.isnot(None)).count()

        # Activity statistics
        total_messages = db.query(ChatMessage).count()
        active_sessions = db.query(UserSession).filter(UserSession.is_active.is_(True)).count()

        # Recent registrations (last 7 days)
        week_ago = utcnow_naive() - timedelta(days=7)
        recent_registrations = db.query(User).filter(User.created_at >= week_ago).count()

        return {
            "success": True,
            "stats": {
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "blocked": blocked_users,
                    "admins": admin_users,
                    "recent_registrations": recent_registrations
                },
                "platforms": {
                    "twitch": twitch_users,
                    "vk": vk_users
                },
                "activity": {
                    "total_messages": total_messages,
                    "active_sessions": active_sessions
                }
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats overview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
