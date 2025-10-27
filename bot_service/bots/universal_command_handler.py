# bot_service/bots/universal_command_handler.py
"""Универсальный обработчик команд для Twitch и VK Live"""
import logging
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta
from core.command_executor import CommandExecutor
from core.database import get_db, BotCommand
from utils.platform_role_checker import PlatformRoleChecker

logger = logging.getLogger('bot_service')

class UniversalCommandHandler:
    """Универсальный обработчик команд с поддержкой глобальных команд, overrides и кастомных"""
    
    def __init__(self):
        self.executor = CommandExecutor()
        self.role_checker = PlatformRoleChecker()
        self.cooldowns: Dict[str, Dict[str, datetime]] = {}  # command_id -> {user_id -> last_used}
        self.logger = logging.getLogger('commands')
    
    async def handle_twitch_command(self, ctx: Any, bot: Any):
        """
        Обработка команды из Twitch чата
        
        Args:
            ctx: TwitchIO Context
            bot: TwitchBot экземпляр
        """
        try:
            message_content = ctx.message.content.strip()
            
            # Проверяем что это команда
            if not message_content.startswith('!'):
                return
            
            # Парсим команду
            parts = message_content[1:].split(maxsplit=1)
            if not parts:
                return
            
            command_name = parts[0].lower()
            command_args = parts[1] if len(parts) > 1 else ""
            
            # Получаем роли пользователя
            user_roles = self.role_checker.get_twitch_roles(ctx.author, ctx.channel.name)
            is_broadcaster = self.role_checker.is_broadcaster(user_roles)
            
            # Получаем user_id владельца канала
            channel_owner_id = await self._get_channel_owner_id_twitch(ctx.channel.name)
            if not channel_owner_id:
                self.logger.warning(f"Channel owner not found for {ctx.channel.name}")
                return
            
            # Ищем команду в БД
            db = next(get_db())
            try:
                command = await self.executor.find_command(
                    command_name=command_name,
                    user_id=channel_owner_id,
                    channel_name=ctx.channel.name,
                    platform='twitch',
                    db=db
                )
                
                if not command:
                    self.logger.debug(f"Command not found: !{command_name}")
                    return
                
                # Проверяем права
                if not self.executor.check_user_role(command, user_roles, is_broadcaster):
                    await ctx.send(f"@{ctx.author.name} ❌ У вас нет прав на использование этой команды")
                    return
                
                # Проверяем кулдаун
                if not is_broadcaster:  # Broadcaster игнорирует кулдауны
                    if not self._check_cooldown(command, ctx.author.id):
                        remaining = self._get_cooldown_remaining(command, ctx.author.id)
                        await ctx.send(f"@{ctx.author.name} ⏰ Команда на кулдауне. Осталось: {remaining}с")
                        return
                
                # Выполняем команду
                await self._execute_command(
                    command=command,
                    ctx=ctx,
                    bot=bot,
                    args=command_args,
                    platform='twitch',
                    db=db
                )
                
            finally:
                db.close()
                
        except Exception as e:
            self.logger.error(f"Error handling Twitch command: {e}", exc_info=True)
    
    async def handle_vk_command(self, channel_name: str, message_data: Dict, vk_bot: Any):
        """
        Обработка команды из VK Live чата
        
        Args:
            channel_name: Название канала VK
            message_data: Данные сообщения
            vk_bot: VKLiveBot экземпляр
        """
        try:
            message = message_data.get('message', '').strip()
            
            # Проверяем что это команда
            if not message.startswith('!'):
                return
            
            # Парсим команду
            parts = message[1:].split(maxsplit=1)
            if not parts:
                return
            
            command_name = parts[0].lower()
            command_args = parts[1] if len(parts) > 1 else ""
            
            # Получаем роли пользователя
            author_data = {
                'is_owner': message_data.get('is_owner', False),
                'is_moderator': message_data.get('is_moderator', False),
                'name': message_data.get('author_nick', 'Unknown')
            }
            user_roles = self.role_checker.get_vk_roles(author_data, channel_name)
            is_broadcaster = self.role_checker.is_broadcaster(user_roles)
            
            # Получаем user_id владельца канала
            channel_owner_id = await self._get_channel_owner_id_vk(channel_name)
            if not channel_owner_id:
                self.logger.warning(f"Channel owner not found for VK {channel_name}")
                return
            
            # Ищем команду в БД
            db = next(get_db())
            try:
                command = await self.executor.find_command(
                    command_name=command_name,
                    user_id=channel_owner_id,
                    channel_name=channel_name,
                    platform='vk',
                    db=db
                )
                
                if not command:
                    self.logger.debug(f"Command not found: !{command_name}")
                    return
                
                # Проверяем права
                if not self.executor.check_user_role(command, user_roles, is_broadcaster):
                    await vk_bot.send_message(channel_name, 
                        f"@{author_data['name']} ❌ У вас нет прав на использование этой команды")
                    return
                
                # Проверяем кулдаун
                author_id = str(message_data.get('author_id', ''))
                if not is_broadcaster:
                    if not self._check_cooldown(command, author_id):
                        remaining = self._get_cooldown_remaining(command, author_id)
                        await vk_bot.send_message(channel_name,
                            f"@{author_data['name']} ⏰ Команда на кулдауне. Осталось: {remaining}с")
                        return
                
                # Выполняем команду
                await self._execute_command_vk(
                    command=command,
                    channel_name=channel_name,
                    author_name=author_data['name'],
                    author_id=author_id,
                    args=command_args,
                    vk_bot=vk_bot,
                    message_data=message_data,
                    db=db
                )
                
            finally:
                db.close()
                
        except Exception as e:
            self.logger.error(f"Error handling VK command: {e}", exc_info=True)
    
    async def _execute_command(
        self, 
        command: BotCommand, 
        ctx: Any, 
        bot: Any, 
        args: str,
        platform: str,
        db: Any
    ):
        """Выполнить команду (Twitch)"""
        try:
            # Для команд с response_text просто отправляем ответ
            if command.response_text:
                await ctx.send(command.response_text)
                self.logger.info(f"✓ Executed text command: !{command.command_name}")
                return
            
            # Для специальных команд используем handlers
            handler_name = f"_handle_{command.command_name}"
            if hasattr(self, handler_name):
                handler = getattr(self, handler_name)
                await handler(ctx, bot, args, platform, db)
            else:
                self.logger.warning(f"No handler for command: !{command.command_name}")
                
        except Exception as e:
            self.logger.error(f"Error executing command: {e}", exc_info=True)
            await ctx.send(f"❌ Ошибка выполнения команды")
    
    async def _execute_command_vk(
        self, 
        command: BotCommand, 
        channel_name: str,
        author_name: str,
        author_id: str,
        args: str,
        vk_bot: Any,
        message_data: Dict,
        db: Any
    ):
        """Выполнить команду (VK)"""
        try:
            # Для команд с response_text просто отправляем ответ
            if command.response_text:
                await vk_bot.send_message(channel_name, command.response_text)
                self.logger.info(f"✓ Executed text command: !{command.command_name}")
                return
            
            # Для специальных команд используем handlers
            handler_name = f"_handle_{command.command_name}_vk"
            if hasattr(self, handler_name):
                handler = getattr(self, handler_name)
                await handler(channel_name, author_name, author_id, args, vk_bot, message_data, db)
            else:
                self.logger.warning(f"No handler for command: !{command.command_name}")
                
        except Exception as e:
            self.logger.error(f"Error executing VK command: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, f"❌ Ошибка выполнения команды")
    
    # === HANDLERS ДЛЯ СПЕЦИАЛЬНЫХ КОМАНД ===
    
    async def _handle_sr(self, ctx, bot, args, platform, db):
        """Handler для !sr (Song Request)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !sr <YouTube URL или ID>")
                return
            
            # Вызываем существующий метод из commands_handler
            if hasattr(bot, 'commands_handler'):
                await bot.commands_handler.song_request_command(ctx, url=args)
            
        except Exception as e:
            self.logger.error(f"Error in !sr handler: {e}")
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка добавления видео")
    
    async def _handle_sr_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !sr в VK"""
        # Используем существующую логику из VKLiveCommandHandler
        if hasattr(vk_bot, 'command_handler'):
            await vk_bot.command_handler._cmd_song_request(
                channel_name, author_name, author_id, [args], message_data
            )
    
    # === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
    
    async def _get_channel_owner_id_twitch(self, channel_name: str) -> Optional[int]:
        """Получить user_id владельца Twitch канала"""
        try:
            from core.database import User
            db = next(get_db())
            try:
                # Ищем пользователя по twitch_username
                user = db.query(User).filter(
                    User.twitch_username == channel_name.lower()
                ).first()
                
                return user.id if user else None
            finally:
                db.close()
        except Exception as e:
            self.logger.error(f"Error getting Twitch channel owner ID: {e}")
            return None
    
    async def _get_channel_owner_id_vk(self, channel_name: str) -> Optional[int]:
        """Получить user_id владельца VK канала"""
        try:
            from core.database import User
            db = next(get_db())
            try:
                # Ищем пользователя по vk_username
                user = db.query(User).filter(
                    User.vk_username == channel_name.lower()
                ).first()
                
                return user.id if user else None
            finally:
                db.close()
        except Exception as e:
            self.logger.error(f"Error getting VK channel owner ID: {e}")
            return None
    
    def _check_cooldown(self, command: BotCommand, user_id: str) -> bool:
        """Проверка кулдауна команды"""
        if not command.cooldown_seconds or command.cooldown_seconds <= 0:
            return True
        
        command_key = f"{command.id}"
        if command_key not in self.cooldowns:
            self.cooldowns[command_key] = {}
        
        now = datetime.now()
        last_used = self.cooldowns[command_key].get(user_id)
        
        if not last_used:
            self.cooldowns[command_key][user_id] = now
            return True
        
        time_passed = (now - last_used).total_seconds()
        if time_passed >= command.cooldown_seconds:
            self.cooldowns[command_key][user_id] = now
            return True
        
        return False
    
    def _get_cooldown_remaining(self, command: BotCommand, user_id: str) -> int:
        """Получение оставшегося времени кулдауна"""
        command_key = f"{command.id}"
        if command_key not in self.cooldowns or user_id not in self.cooldowns[command_key]:
            return 0
        
        now = datetime.now()
        last_used = self.cooldowns[command_key][user_id]
        time_passed = (now - last_used).total_seconds()
        
        return max(0, int(command.cooldown_seconds - time_passed))

