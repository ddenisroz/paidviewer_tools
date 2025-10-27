# bot_service/utils/platform_role_checker.py
"""Проверка ролей пользователей для Twitch и VK Live"""
import logging
from typing import List, Dict, Any

logger = logging.getLogger('bot_service')

class PlatformRoleChecker:
    """Универсальная проверка ролей для всех платформ"""
    
    @staticmethod
    def get_twitch_roles(author_data: Any, channel_name: str) -> List[str]:
        """
        Получить роли пользователя Twitch
        
        Args:
            author_data: TwitchIO Author объект
            channel_name: Название канала
            
        Returns:
            Список ролей: ['broadcaster', 'moderator', 'vip', 'subscriber', 'viewer']
        """
        roles = []
        
        try:
            # 1. Broadcaster (владелец канала)
            if hasattr(author_data, 'is_broadcaster') and author_data.is_broadcaster:
                roles.append('broadcaster')
                roles.append('owner')  # Алиас
            
            # Также проверяем по имени
            if hasattr(author_data, 'name') and author_data.name.lower() == channel_name.lower():
                if 'broadcaster' not in roles:
                    roles.append('broadcaster')
                if 'owner' not in roles:
                    roles.append('owner')
            
            # 2. Moderator
            if hasattr(author_data, 'is_mod') and author_data.is_mod:
                roles.append('moderator')
            
            # 3. VIP
            if hasattr(author_data, 'is_vip') and author_data.is_vip:
                roles.append('vip')
            
            # 4. Subscriber
            if hasattr(author_data, 'is_subscriber') and author_data.is_subscriber:
                roles.append('subscriber')
            
            # 5. Founder (из badges)
            if hasattr(author_data, 'badges'):
                badges = author_data.badges or []
                for badge in badges:
                    if 'founder' in badge.lower():
                        roles.append('founder')
                        break
            
            # 6. Viewer (базовая роль для всех)
            if not roles:
                roles.append('viewer')
            
            logger.debug(f"[TWITCH ROLES] {author_data.name}: {roles}")
            
        except Exception as e:
            logger.error(f"Error getting Twitch roles: {e}")
            roles = ['viewer']  # Fallback
        
        return roles
    
    @staticmethod
    def get_vk_roles(author_data: Dict[str, Any], channel_id: str) -> List[str]:
        """
        Получить роли пользователя VK Live
        
        Args:
            author_data: Словарь с данными автора из VK API
            channel_id: ID канала
            
        Returns:
            Список ролей: ['owner', 'moderator', 'viewer']
        """
        roles = []
        
        try:
            # 1. Owner (владелец стрима)
            if author_data.get('is_owner', False):
                roles.append('owner')
                roles.append('broadcaster')  # Алиас для совместимости
            
            # 2. Moderator
            if author_data.get('is_moderator', False):
                roles.append('moderator')
            
            # 3. Viewer (базовая роль)
            if not roles:
                roles.append('viewer')
            
            logger.debug(f"[VK ROLES] {author_data.get('name', 'Unknown')}: {roles}")
            
        except Exception as e:
            logger.error(f"Error getting VK roles: {e}")
            roles = ['viewer']  # Fallback
        
        return roles
    
    @staticmethod
    def is_broadcaster(roles: List[str]) -> bool:
        """Проверить является ли пользователь владельцем канала"""
        return 'broadcaster' in roles or 'owner' in roles
    
    @staticmethod
    def has_mod_access(roles: List[str]) -> bool:
        """Проверить имеет ли пользователь права модератора или выше"""
        return any(role in roles for role in ['broadcaster', 'owner', 'moderator'])
    
    @staticmethod
    def has_vip_access(roles: List[str]) -> bool:
        """Проверить имеет ли пользователь VIP статус или выше (только Twitch)"""
        return any(role in roles for role in ['broadcaster', 'owner', 'moderator', 'vip', 'founder'])

