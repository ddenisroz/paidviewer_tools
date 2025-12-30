# bot_service/features/commands/command_permission_checker.py
"""
Command Permission Checker

Helper functions for checking command permissions using the platform role system.
"""

import logging
from typing import List, Dict, Any
from core.permissions import PlatformRole, PLATFORM_ROLE_HIERARCHY, has_platform_role
from core.database import BotCommand, User

logger = logging.getLogger(__name__)


def can_use_command(
    command: BotCommand,
    user: User,
    platform: str,
    user_roles: List[str] = None
) -> bool:
    """
    Check if a user can use a specific command based on platform roles.
    
    This function implements role hierarchy checks:
    - broadcaster > moderator > vip > subscriber > viewer
    
    Args:
        command: The command to check
        user: User model instance
        platform: Platform name ('twitch' or 'vk')
        user_roles: Optional list of role strings (for backwards compatibility)
        
    Returns:
        True if user can use the command, False otherwise
    """
    try:
        # Check if command is enabled
        if not command.is_enabled:
            logger.debug(f"Command {command.command_name} is disabled")
            return False
        
        # Check if command is available on this platform
        if command.platforms:
            platforms = [p.strip().lower() for p in command.platforms.split(',')]
            if platform.lower() not in platforms and 'all' not in platforms:
                logger.debug(f"Command {command.command_name} not available on {platform}")
                return False
        
        # Check role permissions
        if not command.allowed_roles or command.allowed_roles.strip() == '':
            return True  # No role restriction
        
        allowed_roles = [r.strip().lower() for r in command.allowed_roles.split(',')]
        
        # If 'all' or 'everyone' is in allowed roles, everyone can use it
        if 'all' in allowed_roles or 'everyone' in allowed_roles:
            return True
        
        # Get user's platform roles from User model
        from core.permissions import get_platform_roles
        user_platform_roles = get_platform_roles(user, platform)
        
        # Get user's highest role level
        user_level = 1  # Default to viewer
        for role in user_platform_roles:
            level = PLATFORM_ROLE_HIERARCHY.get(role, 1)
            user_level = max(user_level, level)
        
        # Get required role level (minimum from allowed roles)
        required_level = 1
        for role_str in allowed_roles:
            role_lower = role_str.lower()
            
            # Map string to PlatformRole
            if role_lower in ['broadcaster', 'owner']:
                role = PlatformRole.BROADCASTER
            elif role_lower in ['moderator', 'mod']:
                role = PlatformRole.MODERATOR
            elif role_lower == 'vip':
                role = PlatformRole.VIP
            elif role_lower in ['subscriber', 'sub']:
                role = PlatformRole.SUBSCRIBER
            else:
                role = PlatformRole.VIEWER
            
            level = PLATFORM_ROLE_HIERARCHY.get(role, 1)
            required_level = max(required_level, level)
        
        # Check if user has sufficient role level
        has_permission = user_level >= required_level
        
        if not has_permission:
            logger.debug(
                f"Permission denied for command {command.command_name}: "
                f"requires level {required_level}, user has level {user_level}"
            )
        
        return has_permission
        
    except Exception as e:
        logger.error(f"Error checking command permission: {e}", exc_info=True)
        return False


def get_user_command_permissions(user: User, platform: str) -> Dict[str, Any]:
    """
    Get a summary of user's command permissions on a platform.
    
    Args:
        user: User model instance
        platform: Platform name ('twitch' or 'vk')
        
    Returns:
        Dictionary with permission information
    """
    try:
        from core.permissions import get_platform_roles
        
        roles = get_platform_roles(user, platform)
        
        # Get highest role level
        max_level = 1
        highest_role = PlatformRole.VIEWER
        
        for role in roles:
            level = PLATFORM_ROLE_HIERARCHY.get(role, 1)
            if level > max_level:
                max_level = level
                highest_role = role
        
        return {
            'platform': platform,
            'roles': [role.value for role in roles],
            'highest_role': highest_role.value,
            'level': max_level,
            'is_broadcaster': PlatformRole.BROADCASTER in roles or PlatformRole.OWNER in roles,
            'is_moderator': PlatformRole.MODERATOR in roles,
            'is_vip': PlatformRole.VIP in roles,
            'is_subscriber': PlatformRole.SUBSCRIBER in roles
        }
        
    except Exception as e:
        logger.error(f"Error getting user command permissions: {e}", exc_info=True)
        return {
            'platform': platform,
            'roles': [],
            'highest_role': 'viewer',
            'level': 1,
            'is_broadcaster': False,
            'is_moderator': False,
            'is_vip': False,
            'is_subscriber': False
        }


def check_command_cooldown(command: BotCommand, user_id: str, cooldowns: Dict) -> bool:
    """
    Check if a command is on cooldown for a user.
    
    Args:
        command: The command to check
        user_id: User identifier
        cooldowns: Dictionary tracking cooldowns {command_id: {user_id: last_used}}
        
    Returns:
        True if command can be used (not on cooldown), False otherwise
    """
    try:
        from datetime import datetime, timedelta
        from core.datetime_utils import utcnow_naive
        
        if command.cooldown_seconds <= 0:
            return True  # No cooldown
        
        command_id = str(command.id)
        
        if command_id not in cooldowns:
            cooldowns[command_id] = {}
        
        if user_id not in cooldowns[command_id]:
            return True  # First use
        
        last_used = cooldowns[command_id][user_id]
        cooldown_expires = last_used + timedelta(seconds=command.cooldown_seconds)
        
        return utcnow_naive() >= cooldown_expires
        
    except Exception as e:
        logger.error(f"Error checking command cooldown: {e}", exc_info=True)
        return True  # Allow on error


def get_cooldown_remaining(command: BotCommand, user_id: str, cooldowns: Dict) -> int:
    """
    Get remaining cooldown time in seconds.
    
    Args:
        command: The command to check
        user_id: User identifier
        cooldowns: Dictionary tracking cooldowns
        
    Returns:
        Remaining seconds, or 0 if not on cooldown
    """
    try:
        from datetime import datetime, timedelta
        from core.datetime_utils import utcnow_naive
        
        if command.cooldown_seconds <= 0:
            return 0
        
        command_id = str(command.id)
        
        if command_id not in cooldowns or user_id not in cooldowns[command_id]:
            return 0
        
        last_used = cooldowns[command_id][user_id]
        cooldown_expires = last_used + timedelta(seconds=command.cooldown_seconds)
        now = utcnow_naive()
        
        if now >= cooldown_expires:
            return 0
        
        remaining = (cooldown_expires - now).total_seconds()
        return int(remaining)
        
    except Exception as e:
        logger.error(f"Error getting cooldown remaining: {e}", exc_info=True)
        return 0


def update_command_cooldown(command: BotCommand, user_id: str, cooldowns: Dict):
    """
    Update the cooldown timestamp for a command.
    
    Args:
        command: The command that was used
        user_id: User identifier
        cooldowns: Dictionary tracking cooldowns
    """
    try:
        from datetime import datetime
        from core.datetime_utils import utcnow_naive
        
        command_id = str(command.id)
        
        if command_id not in cooldowns:
            cooldowns[command_id] = {}
        
        cooldowns[command_id][user_id] = utcnow_naive()
        
    except Exception as e:
        logger.error(f"Error updating command cooldown: {e}", exc_info=True)
