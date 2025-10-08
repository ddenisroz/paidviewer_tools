# bot_service/bots/base_bot.py
"""
Базовый класс для всех ботов (Twitch, VK Live, и т.д.)
Содержит общую логику команд и обработки сообщений
"""

import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger('bot_service')

class BaseBot(ABC):
    """Абстрактный базовый класс для всех ботов"""
    
    def __init__(self, connection_manager):
        self.connection_manager = connection_manager
        self.connected_channels: List[str] = []
        self.is_running = False
        
    @abstractmethod
    async def start_bot(self):
        """Запуск бота - должен быть реализован в подклассах"""
        pass
    
    @abstractmethod
    async def stop_bot(self):
        """Остановка бота - должен быть реализован в подклассах"""
        pass
    
    @abstractmethod
    async def join_channel(self, channel_name: str) -> bool:
        """Подключение к каналу - должно быть реализовано в подклассах"""
        pass
    
    @abstractmethod
    async def leave_channel(self, channel_name: str) -> bool:
        """Отключение от канала - должно быть реализовано в подклассах"""
        pass
    
    @abstractmethod
    async def send_message(self, channel_name: str, message: str) -> bool:
        """Отправка сообщения в чат - должна быть реализована в подклассах"""
        pass
    
    def is_connected_to_channel(self, channel_name: str) -> bool:
        """Проверка подключения к каналу"""
        return channel_name in self.connected_channels
    
    # === ОБЩИЕ МЕТОДЫ ДЛЯ ВСЕХ БОТОВ ===
    
    def generate_fake_ip(self) -> str:
        """Генерация фейкового IP адреса для шутки"""
        import random
        octet1 = random.randint(10, 99)
        octet2 = random.randint(100, 999)
        octet3 = random.randint(10, 99)
        octet4 = random.randint(10, 99)
        return f"{octet1}.{octet2}.{octet3}.{octet4}"
    
    async def get_channel_owner_id(self, channel_name: str, platform: str) -> Optional[int]:
        """Получение ID владельца канала из базы данных"""
        try:
            from core.database import UserToken, get_db
            
            db = next(get_db())
            try:
                user_token = db.query(UserToken).filter(
                    UserToken.platform == platform,
                    UserToken.platform_username == channel_name.lower()
                ).first()
                
                return user_token.user_id if user_token else None
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting channel owner ID for {channel_name}: {e}")
            return None
    
    async def check_user_permissions(self, user_roles: List[str], required_roles: str, platform: str) -> bool:
        """Проверка прав пользователя для выполнения команды"""
        from utils.role_checker import RoleChecker
        return RoleChecker.can_execute_command(user_roles, required_roles, platform)
    
    async def check_command_cooldown(self, command, channel_name: str) -> Optional[int]:
        """
        Проверка кулдауна команды
        
        Returns:
            None если кулдаун прошел, оставшееся время в секундах если еще на кулдауне
        """
        if command.last_used and command.cooldown_seconds > 0:
            time_since_last_use = datetime.utcnow() - command.last_used
            if time_since_last_use.total_seconds() < command.cooldown_seconds:
                return command.cooldown_seconds - int(time_since_last_use.total_seconds())
        return None
    
    async def create_basic_command_if_not_exists(
        self, 
        db, 
        channel_name: str, 
        command_name: str, 
        internal_user_id: int
    ):
        """Создание базовой команды если её нет в базе данных"""
        from core.database import BotCommand
        
        # Конфигурация базовых команд
        basic_commands_config = {
            'sr': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 0
            },
            'tts': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 0
            },
            'queue': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 0
            },
            'next': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 0
            },
            'clear': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'broadcaster,moderator,owner,moderator_vk',
                'cooldown_seconds': 0
            },
            'help': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 0
            },
            'voice': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 5
            },
            'ttsvolume': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'broadcaster,moderator,owner,moderator_vk',
                'cooldown_seconds': 5
            },
            'youtubevolume': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'broadcaster,moderator,owner,moderator_vk',
                'cooldown_seconds': 5
            },
            'category': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'broadcaster,owner',
                'cooldown_seconds': 10
            },
            'title': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'broadcaster,owner',
                'cooldown_seconds': 10
            },
            'about': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 30
            },
            'lootbox': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 5
            },
            'open': {
                'command_type': 'basic',
                'response_text': None,
                'is_enabled': True,
                'platforms': 'twitch,vk',
                'allowed_roles': 'all',
                'cooldown_seconds': 60
            }
        }
        
        # Проверяем, является ли это базовой командой
        if command_name not in basic_commands_config:
            logger.debug(f"Unknown command: {command_name}")
            return None
        
        try:
            config = basic_commands_config[command_name]
            
            # Создаем команду
            command = BotCommand(
                user_id=internal_user_id,
                channel_name=channel_name,
                command_name=command_name,
                command_type=config['command_type'],
                response_text=config['response_text'],
                is_enabled=config['is_enabled'],
                platforms=config['platforms'],
                allowed_roles=config['allowed_roles'],
                cooldown_seconds=config['cooldown_seconds'],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(command)
            db.commit()
            
            logger.info(f"Created basic command '{command_name}' for channel '{channel_name}'")
            return command
            
        except Exception as e:
            logger.error(f"Error creating basic command '{command_name}': {e}")
            db.rollback()
            return None
    
    async def handle_help_command(self, channel_name: str):
        """Общая обработка команды !help"""
        help_text = """
🤖 Доступные команды:
!tts - Включить/выключить TTS
!voice <номер> - Выбрать голос для TTS
!voice random - Выбрать случайный голос
!queue - Показать очередь видео
!next - Следующее видео
!clear - Очистить очередь (только модераторы)
!sr <url> - Добавить видео в очередь
!help - Показать это сообщение
        """
        await self.send_message(channel_name, help_text.strip())
    
    async def validate_and_sanitize_input(self, text: str, max_length: int = 500) -> Optional[str]:
        """
        Валидация и санитизация пользовательского ввода
        
        Returns:
            Очищенный текст или None если валидация не прошла
        """
        if not text or not text.strip():
            return None
        
        text = text.strip()
        
        if len(text) > max_length:
            logger.warning(f"Input too long: {len(text)} > {max_length}")
            return None
        
        # Базовая санитизация
        dangerous_chars = ['<', '>', '&', '"', "'"]
        for char in dangerous_chars:
            text = text.replace(char, '')
        
        return text


