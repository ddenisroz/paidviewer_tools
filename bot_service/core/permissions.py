# bot_service/core/permissions.py
"""
Permission and Role System for Bot Service

This module implements role-based access control (RBAC) with strict separation
between admin and user functions. It supports both application-level roles
(admin, user, guest) and platform-specific roles (broadcaster, moderator, VIP, subscriber).
"""

import logging
from enum import Enum
from typing import Optional, List, Callable
from functools import wraps
from fastapi import HTTPException, Depends, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class AppRole(Enum):
    """Application-level roles"""
    ADMIN = "admin"  # Full system access, can manage all users and settings
    USER = "user"    # Regular authenticated user, can manage own settings
    GUEST = "guest"  # Unauthenticated user, read-only access


class Permission(Enum):
    """Granular permissions for different operations"""
    # Admin permissions
    MANAGE_USERS = "manage_users"              # Create, update, delete users
    MANAGE_GLOBAL_VOICES = "manage_global_voices"  # Upload/delete global voice packs
    VIEW_ALL_SETTINGS = "view_all_settings"    # View settings of all users
    MANAGE_SYSTEM = "manage_system"            # System configuration, logs
    BLOCK_USERS = "block_users"                # Block/unblock users
    
    # User permissions
    MANAGE_OWN_SETTINGS = "manage_own_settings"  # Update own settings
    MANAGE_OWN_VOICES = "manage_own_voices"      # Upload/delete personal voices
    MANAGE_STREAM = "manage_stream"              # Update stream title, category
    MANAGE_BOTS = "manage_bots"                  # Start/stop bots
    MANAGE_COMMANDS = "manage_commands"          # Create/edit custom commands
    MANAGE_REWARDS = "manage_rewards"            # Create/edit channel rewards
    MANAGE_DROPS = "manage_drops"                # Configure drops system
    
    # Guest permissions
    VIEW_CHAT = "view_chat"                    # View chat messages
    VIEW_PUBLIC_DATA = "view_public_data"      # View public stream info


class PlatformRole(Enum):
    """Platform-specific roles (Twitch, VK)"""
    # Twitch roles
    BROADCASTER = "broadcaster"  # Channel owner
    MODERATOR = "moderator"      # Channel moderator
    VIP = "vip"                  # VIP user
    SUBSCRIBER = "subscriber"    # Subscriber
    VIEWER = "viewer"            # Regular viewer
    
    # VK roles (mapped to similar hierarchy)
    OWNER = "owner"              # Channel owner (same as broadcaster)
    # MODERATOR already defined above
    # VIEWER already defined above


# Role hierarchy: higher roles inherit permissions from lower roles
ROLE_HIERARCHY = {
    AppRole.ADMIN: [
        Permission.MANAGE_USERS,
        Permission.MANAGE_GLOBAL_VOICES,
        Permission.VIEW_ALL_SETTINGS,
        Permission.MANAGE_SYSTEM,
        Permission.BLOCK_USERS,
        Permission.MANAGE_OWN_SETTINGS,
        Permission.MANAGE_OWN_VOICES,
        Permission.MANAGE_STREAM,
        Permission.MANAGE_BOTS,
        Permission.MANAGE_COMMANDS,
        Permission.MANAGE_REWARDS,
        Permission.MANAGE_DROPS,
        Permission.VIEW_CHAT,
        Permission.VIEW_PUBLIC_DATA,
    ],
    AppRole.USER: [
        Permission.MANAGE_OWN_SETTINGS,
        Permission.MANAGE_OWN_VOICES,
        Permission.MANAGE_STREAM,
        Permission.MANAGE_BOTS,
        Permission.MANAGE_COMMANDS,
        Permission.MANAGE_REWARDS,
        Permission.MANAGE_DROPS,
        Permission.VIEW_CHAT,
        Permission.VIEW_PUBLIC_DATA,
    ],
    AppRole.GUEST: [
        Permission.VIEW_CHAT,
        Permission.VIEW_PUBLIC_DATA,
    ],
}

# Platform role hierarchy (for command permissions)
PLATFORM_ROLE_HIERARCHY = {
    PlatformRole.BROADCASTER: 5,
    PlatformRole.OWNER: 5,  # Same level as broadcaster
    PlatformRole.MODERATOR: 4,
    PlatformRole.VIP: 3,
    PlatformRole.SUBSCRIBER: 2,
    PlatformRole.VIEWER: 1,
}


def has_permission(user_role: AppRole, required_permission: Permission) -> bool:
    """
    Check if a user role has a specific permission.
    
    Args:
        user_role: The user's application role
        required_permission: The permission to check
        
    Returns:
        True if the role has the permission, False otherwise
    """
    if user_role not in ROLE_HIERARCHY:
        logger.warning(f"Unknown role: {user_role}")
        return False
    
    return required_permission in ROLE_HIERARCHY[user_role]


def get_platform_roles(user, platform: str = "twitch") -> List[PlatformRole]:
    """
    Get platform-specific roles for a user.
    
    Args:
        user: User model instance
        platform: Platform name ('twitch' or 'vk')
        
    Returns:
        List of platform roles the user has
    """
    roles = [PlatformRole.VIEWER]  # Everyone is at least a viewer
    
    if platform == "twitch":
        if getattr(user, 'twitch_is_broadcaster', False):
            roles.append(PlatformRole.BROADCASTER)
        if getattr(user, 'twitch_is_moderator', False):
            roles.append(PlatformRole.MODERATOR)
        if getattr(user, 'twitch_is_vip', False):
            roles.append(PlatformRole.VIP)
        if getattr(user, 'twitch_is_subscriber', False):
            roles.append(PlatformRole.SUBSCRIBER)
    
    elif platform == "vk":
        if getattr(user, 'vk_is_owner', False):
            roles.append(PlatformRole.OWNER)
        if getattr(user, 'vk_is_moderator', False):
            roles.append(PlatformRole.MODERATOR)
    
    return roles


def has_platform_role(user, required_role: PlatformRole, platform: str = "twitch") -> bool:
    """
    Check if a user has a specific platform role or higher.
    
    Args:
        user: User model instance
        required_role: The minimum required platform role
        platform: Platform name ('twitch' or 'vk')
        
    Returns:
        True if the user has the required role or higher
    """
    user_roles = get_platform_roles(user, platform)
    required_level = PLATFORM_ROLE_HIERARCHY.get(required_role, 0)
    
    for role in user_roles:
        user_level = PLATFORM_ROLE_HIERARCHY.get(role, 0)
        if user_level >= required_level:
            return True
    
    return False


def require_permission(required_permission: Permission):
    """
    Decorator to require a specific permission for an endpoint.
    
    Usage:
        @router.get("/admin/users")
        @require_permission(Permission.MANAGE_USERS)
        async def get_all_users(current_user = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                # Try to find it in args (for different parameter orders)
                for arg in args:
                    if hasattr(arg, 'role'):
                        current_user = arg
                        break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Get user's role
            user_role_str = getattr(current_user, 'role', 'user')
            try:
                user_role = AppRole(user_role_str)
            except ValueError:
                logger.warning(f"Invalid role for user {current_user.id}: {user_role_str}")
                user_role = AppRole.USER
            
            # Check permission
            if not has_permission(user_role, required_permission):
                logger.warning(
                    f"Permission denied: User {current_user.id} (role: {user_role.value}) "
                    f"attempted to access {required_permission.value}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {required_permission.value} required"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_role(required_role: AppRole):
    """
    Decorator to require a specific application role for an endpoint.
    
    Usage:
        @router.get("/admin/system")
        @require_role(AppRole.ADMIN)
        async def get_system_info(current_user = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                # Try to find it in args
                for arg in args:
                    if hasattr(arg, 'role'):
                        current_user = arg
                        break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Get user's role
            user_role_str = getattr(current_user, 'role', 'user')
            try:
                user_role = AppRole(user_role_str)
            except ValueError:
                logger.warning(f"Invalid role for user {current_user.id}: {user_role_str}")
                user_role = AppRole.USER
            
            # Check role
            if user_role != required_role:
                logger.warning(
                    f"Role check failed: User {current_user.id} (role: {user_role.value}) "
                    f"attempted to access {required_role.value}-only endpoint"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: {required_role.value} role required"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_platform_role(required_role: PlatformRole, platform: str = "twitch"):
    """
    Decorator to require a specific platform role for an operation.
    
    Usage:
        @require_platform_role(PlatformRole.MODERATOR, platform="twitch")
        async def moderate_chat(user, ...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user from kwargs or args
            user = kwargs.get('user') or kwargs.get('current_user')
            if not user:
                for arg in args:
                    if hasattr(arg, 'role'):
                        user = arg
                        break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check platform role
            if not has_platform_role(user, required_role, platform):
                logger.warning(
                    f"Platform role check failed: User {user.id} attempted to access "
                    f"{required_role.value}-only operation on {platform}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: {required_role.value} role required on {platform}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def check_resource_ownership(user, resource_user_id: int) -> bool:
    """
    Check if a user owns a resource or is an admin.
    
    Args:
        user: User model instance
        resource_user_id: The user_id of the resource owner
        
    Returns:
        True if user owns the resource or is admin
    """
    # Admins can access any resource
    user_role_str = getattr(user, 'role', 'user')
    try:
        user_role = AppRole(user_role_str)
        if user_role == AppRole.ADMIN:
            return True
    except ValueError:
        pass
    
    # Check ownership
    return user.id == resource_user_id


def require_ownership_or_admin(resource_user_id_param: str = "user_id"):
    """
    Decorator to require resource ownership or admin role.
    
    Usage:
        @router.get("/users/{user_id}/settings")
        @require_ownership_or_admin(resource_user_id_param="user_id")
        async def get_user_settings(user_id: int, current_user = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Extract resource_user_id
            resource_user_id = kwargs.get(resource_user_id_param)
            if resource_user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing parameter: {resource_user_id_param}"
                )
            
            # Check ownership or admin
            if not check_resource_ownership(current_user, resource_user_id):
                logger.warning(
                    f"Ownership check failed: User {current_user.id} attempted to access "
                    f"resource owned by user {resource_user_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only access your own resources"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator
