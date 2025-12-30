# bot_service/features/commands/command_executor.py
"""Универсальный обработчик команд для всех платформ"""
import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from core.database import BotCommand

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
        
        Иерархия (от высшей к низшей):
        - broadcaster/owner (level 5): владелец канала
        - moderator (level 4): модератор канала
        - vip (level 3): VIP пользователь
        - subscriber (level 2): подписчик
        - viewer (level 1): обычный зритель
        
        Высшие роли наследуют права низших ролей.
        
        Args:
            command: Команда для проверки
            user_roles: Список ролей пользователя ['moderator', 'vip', ...]
            is_broadcaster: Является ли пользователь владельцем канала
            
        Returns:
            True если есть права, False иначе
        """
        try:
            # Import permission system
            from core.permissions import PlatformRole, PLATFORM_ROLE_HIERARCHY

            # Broadcaster/Owner всегда имеет доступ
            if is_broadcaster:
                return True

            if not command.allowed_roles or command.allowed_roles.strip() == '':
                return True  # Если не указано, доступна всем

            allowed = [r.strip().lower() for r in command.allowed_roles.split(',')]

            # Если разрешено всем
            if 'all' in allowed or 'everyone' in allowed:
                return True

            # Определяем уровень пользователя (максимальный из его ролей)
            user_level = 1  # По умолчанию viewer
            user_roles_lower = [r.lower() for r in user_roles]

            for role_str in user_roles_lower:
                try:
                    # Нормализуем роль
                    if role_str in ['broadcaster', 'owner']:
                        role = PlatformRole.BROADCASTER
                    elif role_str in ['moderator', 'mod']:
                        role = PlatformRole.MODERATOR
                    elif role_str == 'vip':
                        role = PlatformRole.VIP
                    elif role_str in ['subscriber', 'sub']:
                        role = PlatformRole.SUBSCRIBER
                    else:
                        role = PlatformRole.VIEWER

                    level = PLATFORM_ROLE_HIERARCHY.get(role, 1)
                    user_level = max(user_level, level)
                except (KeyError, AttributeError):
                    continue

            # Определяем требуемый уровень (минимальный из разрешенных ролей)
            required_level = 1  # По умолчанию viewer

            for role_str in allowed:
                role_lower = role_str.lower()

                # Если команда для всех зрителей - доступна всем
                if role_lower in ['all', 'everyone', 'viewer']:
                    required_level = 1
                    break

                # Определяем уровень требуемой роли
                try:
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
                except (KeyError, AttributeError):
                    continue

            # Проверяем, достаточен ли уровень пользователя
            has_permission = user_level >= required_level

            if not has_permission:
                self.logger.debug(
                    f"✗ Permission denied: command requires level {required_level} ({allowed}), "
                    f"user has level {user_level} ({user_roles_lower})"
                )

            return has_permission

        except Exception as e:
            self.logger.error(f"Error checking user role: {e}", exc_info=True)
            return False

    def get_command_response(self, command: BotCommand) -> str:
        """Получить ответ команды"""
        return command.response_text or ""
