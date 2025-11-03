# bot_service/utils/role_checker.py
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger('bot_service')

class RoleChecker:
    """
    Утилита для проверки ролей пользователей на разных платформах
    """
    
    @staticmethod
    def check_twitch_role(user_badges: List[str], user_id: str, channel_owner_id: str) -> List[str]:
        """
        Проверяет роли пользователя в Twitch чате
        
        Args:
            user_badges: Список бейджей пользователя из IRC
            user_id: ID пользователя
            channel_owner_id: ID владельца канала
            
        Returns:
            List[str]: Список ролей пользователя
        """
        roles = []
        
        # Проверяем бейджи из IRC
        for badge in user_badges:
            if badge == 'broadcaster':
                roles.append('broadcaster')
            elif badge == 'moderator':
                roles.append('moderator')
            elif badge == 'subscriber':
                roles.append('subscriber')
            elif badge == 'vip':
                roles.append('vip')
            elif badge == 'founder':
                roles.append('founder')
        
        # Если пользователь - владелец канала
        if user_id == channel_owner_id:
            roles.append('broadcaster')
        
        return list(set(roles))  # Убираем дубликаты
    
    @staticmethod
    def check_vk_live_role(user_data: Dict[str, Any]) -> List[str]:
        """
        Проверяет роли пользователя в VK Live чате
        
        Args:
            user_data: Данные пользователя из VK Live API
            
        Returns:
            List[str]: Список ролей пользователя
        """
        roles = []
        
        # Проверяем флаги из VK Live API
        if user_data.get('is_owner', False):
            roles.append('owner')
        
        if user_data.get('is_moderator', False):
            roles.append('moderator_vk')
        
        # Проверяем кастомные роли
        custom_roles = user_data.get('roles', [])
        for role in custom_roles:
            role_name = role.get('name', '').lower()
            if role_name:
                roles.append(f"custom_{role_name}")
        
        return roles
    
    @staticmethod
    def can_execute_command(
        user_roles: List[str], 
        allowed_roles: str, 
        platform: str
    ) -> bool:
        """
        Проверяет, может ли пользователь выполнить команду
        
        Args:
            user_roles: Роли пользователя
            allowed_roles: Разрешенные роли (из базы данных)
            platform: Платформа (twitch/vk)
            
        Returns:
            bool: Может ли выполнить команду
        """
        if allowed_roles == 'all':
            return True
        
        allowed_list = [role.strip() for role in allowed_roles.split(',')]
        
        # Проверяем пересечение ролей
        for user_role in user_roles:
            if user_role in allowed_list:
                return True
        
        # Специальная логика для платформ
        if platform == 'twitch':
            # Если разрешены модераторы, то владелец канала тоже может
            if 'moderator' in allowed_list and 'broadcaster' in user_roles:
                return True
                
        elif platform == 'vk':
            # Если разрешены модераторы, то владелец канала тоже может
            if 'moderator_vk' in allowed_list and 'owner' in user_roles:
                return True
        
        return False
    
    @staticmethod
    def get_user_role_display(user_roles: List[str], platform: str) -> str:
        """
        Возвращает отображаемое название роли пользователя
        
        Args:
            user_roles: Роли пользователя
            platform: Платформа
            
        Returns:
            str: Отображаемое название роли
        """
        if not user_roles:
            return "Зритель"
        
        # Приоритет ролей (от высшей к низшей)
        if platform == 'twitch':
            if 'broadcaster' in user_roles:
                return "Broadcaster"
            elif 'moderator' in user_roles:
                return "Moderator"
            elif 'founder' in user_roles:
                return "Founder"
            elif 'vip' in user_roles:
                return "VIP"
            elif 'subscriber' in user_roles:
                return "Subscriber"
        elif platform == 'vk':
            if 'owner' in user_roles:
                return "Owner"
            elif 'moderator_vk' in user_roles:
                return "Moderator"
        
        # Если есть кастомные роли
        custom_roles = [role for role in user_roles if role.startswith('custom_')]
        if custom_roles:
            return custom_roles[0].replace('custom_', '').title()
        
        return "Зритель"
