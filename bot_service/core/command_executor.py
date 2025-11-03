# bot_service/core/command_executor.py
"""Универсальный обработчик команд для всех платформ"""
import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from core.database import BotCommand, get_db

logger = logging.getLogger('bot_service')

class CommandExecutor:
    """Универсальный executor для команд с поддержкой global/override/custom"""
    
    def __init__(self):
        self.logger = logging.getLogger('commands')
    
    async def find_command(
        self, 
        command_name: str,
        user_id: int,
        channel_name: str,
        platform: str,
        db: Session
    ) -> Optional[BotCommand]:
        """
        Найти команду с приоритетом: custom → override → global
        
        Args:
            command_name: Название команды (без !)
            user_id: ID пользователя (владельца канала)
            channel_name: Название канала
            platform: Платформа (twitch/vk)
            db: SQLAlchemy сессия
            
        Returns:
            BotCommand или None
        """
        try:
            # 1. ПРИОРИТЕТ: Пользовательская кастомная команда
            custom_cmd = db.query(BotCommand).filter(
                BotCommand.command_type == 'custom',
                BotCommand.user_id == user_id,
                BotCommand.command_name == command_name,
                BotCommand.is_enabled == True
            ).first()
            
            if custom_cmd:
                # Проверяем платформу
                if self._check_platform(custom_cmd, platform):
                    self.logger.info(f"✓ [CUSTOM] Found: {command_name} for user {user_id}")
                    return custom_cmd
            
            # 2. ПРИОРИТЕТ: User override для глобальной команды
            override_cmd = db.query(BotCommand).filter(
                BotCommand.command_type == 'override',
                BotCommand.user_id == user_id,
                BotCommand.command_name == command_name,
                BotCommand.is_enabled == True
            ).first()
            
            if override_cmd:
                if self._check_platform(override_cmd, platform):
                    self.logger.info(f"✓ [OVERRIDE] Found: {command_name} for user {user_id}")
                    return override_cmd
            
            # 3. ПРИОРИТЕТ: Глобальная команда
            global_cmd = db.query(BotCommand).filter(
                BotCommand.command_type == 'global',
                BotCommand.user_id == None,
                BotCommand.command_name == command_name,
                BotCommand.is_enabled == True
            ).first()
            
            if global_cmd:
                if self._check_platform(global_cmd, platform):
                    self.logger.info(f"✓ [GLOBAL] Found: {command_name}")
                    return global_cmd
            
            # 4. Проверяем алиасы в override
            alias_cmd = db.query(BotCommand).filter(
                BotCommand.command_type == 'override',
                BotCommand.user_id == user_id,
                BotCommand.alias == command_name,
                BotCommand.is_enabled == True
            ).first()
            
            if alias_cmd:
                if self._check_platform(alias_cmd, platform):
                    self.logger.info(f"✓ [ALIAS] Found: {command_name} → {alias_cmd.command_name}")
                    return alias_cmd
            
            self.logger.debug(f"✗ Command not found: {command_name}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error finding command: {e}", exc_info=True)
            return None
    
    def _check_platform(self, command: BotCommand, platform: str) -> bool:
        """Проверить что команда доступна на платформе"""
        if not command.platforms:
            return True  # Если не указано, доступна везде
        
        platforms = [p.strip().lower() for p in command.platforms.split(',')]
        return platform.lower() in platforms or 'all' in platforms
    
    def check_user_role(
        self, 
        command: BotCommand, 
        user_roles: List[str],
        is_broadcaster: bool = False
    ) -> bool:
        """
        Проверить права пользователя на выполнение команды с учетом иерархии ролей
        
        Иерархия:
        - all/everyone: доступно всем (включая всех выше)
        - vip: доступно VIP, модераторам, владельцу
        - moderator: доступно модераторам, владельцу
        - broadcaster/owner: только владелец
        
        Args:
            command: Команда для проверки
            user_roles: Список ролей пользователя ['moderator', 'vip', ...]
            is_broadcaster: Является ли пользователь владельцем канала
            
        Returns:
            True если есть права, False иначе
        """
        try:
            # Broadcaster всегда имеет доступ
            if is_broadcaster:
                return True
            
            if not command.allowed_roles or command.allowed_roles.strip() == '':
                return True  # Если не указано, доступна всем
            
            allowed = [r.strip().lower() for r in command.allowed_roles.split(',')]
            
            # Если разрешено всем
            if 'all' in allowed or 'everyone' in allowed:
                return True
            
            # Иерархия ролей
            user_roles_lower = [r.lower() for r in user_roles]
            is_moderator = 'moderator' in user_roles_lower or 'mod' in user_roles_lower
            is_vip = 'vip' in user_roles_lower
            is_subscriber = 'subscriber' in user_roles_lower or 'sub' in user_roles_lower
            
            # Проверка иерархии
            for role in allowed:
                role_lower = role.lower()
                
                # Если команда для всех зрителей - доступна всем
                if role_lower in ['all', 'everyone', 'viewer']:
                    return True
                
                # Если команда для VIP - доступна VIP, модераторам, владельцу
                if role_lower == 'vip':
                    if is_vip or is_moderator:
                        return True
                
                # Если команда для модератора - доступна модераторам, владельцу
                if role_lower == 'moderator' or role_lower == 'mod':
                    if is_moderator:
                        return True
                
                # Если команда для подписчика - доступна подписчикам, VIP, модераторам, владельцу
                if role_lower in ['subscriber', 'sub']:
                    if is_subscriber or is_vip or is_moderator:
                        return True
                
                # Прямое совпадение роли (для обратной совместимости)
                if role_lower in user_roles_lower:
                    return True
            
            self.logger.debug(f"✗ Permission denied: command requires {allowed}, user has {user_roles_lower}")
            return False
            
        except Exception as e:
            self.logger.error(f"Error checking user role: {e}")
            return False
    
    def get_command_response(self, command: BotCommand) -> str:
        """Получить ответ команды"""
        return command.response_text or ""

