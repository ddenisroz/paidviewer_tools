# bot_service/bots/universal_command_handler.py
"""Универсальный обработчик команд для Twitch и VK Live"""
import logging
from typing import Optional, Any, Dict
from datetime import datetime
from services.command_service import CommandService
from core.database import get_db, BotCommand
from utils.platform_role_checker import PlatformRoleChecker

# Import Mixins
from bots.mixins.queue_handler_mixin import QueueHandlerMixin
from bots.mixins.stream_info_handler_mixin import StreamInfoHandlerMixin
from bots.mixins.tts_handler_mixin import TTSHandlerMixin
from bots.mixins.general_handler_mixin import GeneralHandlerMixin

logger = logging.getLogger('bot_service')

class UniversalCommandHandler(QueueHandlerMixin, StreamInfoHandlerMixin, TTSHandlerMixin, GeneralHandlerMixin):
    """Универсальный обреботчик команд с поддержкой глобальных команд, overrides и кастомных
    
    Inherits functionality from:
    - QueueHandlerMixin: !sr, !skip, !clear, !queue, !wronglink
    - StreamInfoHandlerMixin: !game, !title
    - TTSHandlerMixin: !voice, !randomvoice, !mute, !unmute, !ttsvolume
    - GeneralHandlerMixin: !help, !ytvolume, !analyze
    """

    def __init__(self):
        self.command_service = CommandService()
        self.role_checker = PlatformRoleChecker()
        # self.cooldowns is managed by CommandService now, but keeping local if needed for legacy mixins
        # Ideally mixins should use command_service too.
        # For now, let's proxy calls to command_service.
        self.logger = logging.getLogger('commands')

    def _has_fallback_permission(self, command_name: str, user_roles: list[str]) -> bool:
        """Lightweight permission checks for core commands when DB is missing."""
        cmd = command_name.lower()
        if cmd in {'skip', 'clear'}:
            return any(role in {'broadcaster', 'owner', 'moderator', 'mod'} for role in user_roles)
        return True


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
                command = self.command_service.find_command(
                    command_name=command_name,
                    user_id=channel_owner_id,
                    channel_name=ctx.channel.name,
                    platform='twitch',
                    db=db
                )

                if not command:
                    self.logger.debug(f"Command not found: !{command_name}")
                    fallback_core_commands = {'sr', 'queue', 'wronglink', 'skip', 'clear'}
                    if command_name in fallback_core_commands:
                        if not self._has_fallback_permission(command_name, user_roles):
                            await ctx.send(f"@{ctx.author.name} [ERROR] You do not have permission to use this command")
                            return
                        handler_name = f"_handle_{command_name}"
                        if hasattr(self, handler_name):
                            await getattr(self, handler_name)(ctx, bot, command_args, 'twitch', db)
                        return
                    return

                # Проверяем права
                # Note: pass user=None as we use user_roles list for compat
                if not self.command_service.check_permission(command, None, 'twitch', user_roles):
                    await ctx.send(f"@{ctx.author.name} [ERROR] You do not have permission to use this command")
                    return

                # Проверяем кулдаун
                if not is_broadcaster:  # Broadcaster игнорирует кулдауны
                    if not self.command_service.check_cooldown(command, str(ctx.author.id)):
                        # CommandService doesn't expose remaining time easily currently, or does it?
                        # It returns bool. Let's look at implementation.
                        # It doesn't have get_remaining. We should add it or accept generic message.
                        await ctx.send(f"@{ctx.author.name} [TIMEOUT] Команда на кулдауне.")
                        return
                    else:
                        # Update cooldown upon successful check (or should it be after execution?)
                        # Typically updated after execution starts.
                        self.command_service.update_cooldown(command, str(ctx.author.id))

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
            self.logger.info(f"[DEBUG] [VK CMD HANDLER] Processing: {message}")

            # Проверяем что это команда
            if not message.startswith('!'):
                self.logger.warning(f"[DEBUG] [VK CMD HANDLER] Not a command: {message}")
                return

            # Парсим команду
            parts = message[1:].split(maxsplit=1)
            if not parts:
                self.logger.warning("[DEBUG] [VK CMD HANDLER] Empty command")
                return

            command_name = parts[0].lower()
            command_args = parts[1] if len(parts) > 1 else ""
            self.logger.info(f"[DEBUG] [VK CMD HANDLER] Command: !{command_name}, Args: '{command_args}'")

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
                command = self.command_service.find_command(
                    command_name=command_name,
                    user_id=channel_owner_id,
                    channel_name=channel_name,
                    platform='vk',
                    db=db
                )

                if not command:
                    self.logger.debug(f"Command not found: !{command_name}")
                    fallback_core_commands_vk = {'sr', 'queue', 'wronglink', 'skip', 'clear'}
                    if command_name in fallback_core_commands_vk:
                        if not self._has_fallback_permission(command_name, user_roles):
                            await vk_bot.send_message(channel_name, f"@{author_data['name']} [ERROR] You do not have permission to use this command")
                            return
                        handler_name = f"_handle_{command_name}_vk"
                        if hasattr(self, handler_name):
                            await getattr(self, handler_name)(channel_name, author_data['name'], author_id, command_args, vk_bot, message_data, db)
                        return
                    return

                # Проверяем права
                if not self.command_service.check_permission(command, None, 'vk', user_roles):
                    await vk_bot.send_message(channel_name,
                        f"@{author_data['name']} [ERROR] У вас нет прав на использование этой команды")
                    return

                # Проверяем кулдаун
                author_id = str(message_data.get('author_id', ''))
                if not is_broadcaster:
                    if not self.command_service.check_cooldown(command, author_id):
                        await vk_bot.send_message(channel_name,
                            f"@{author_data['name']} [TIMEOUT] Команда на кулдауне.")
                        return
                    else:
                        self.command_service.update_cooldown(command, author_id)

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
                self.logger.info(f"[OK] Executed text command: !{command.command_name}")
                return

            # Для специальных команд используем handlers (lookups on self which includes mixins)
            handler_name = f"_handle_{command.command_name}"
            if hasattr(self, handler_name):
                handler = getattr(self, handler_name)
                await handler(ctx, bot, args, platform, db)
            else:
                self.logger.warning(f"No handler for command: !{command.command_name}")

        except Exception as e:
            self.logger.error(f"Error executing command: {e}", exc_info=True)
            await ctx.send("[ERROR] Ошибка выполнения команды")

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
                self.logger.info(f"[OK] Executed text command: !{command.command_name}")
                return

            # Для специальных команд используем handlers (lookups on self which includes mixins)
            handler_name = f"_handle_{command.command_name}_vk"
            if hasattr(self, handler_name):
                handler = getattr(self, handler_name)
                await handler(channel_name, author_name, author_id, args, vk_bot, message_data, db)
            else:
                self.logger.warning(f"No handler for command: !{command.command_name}")

        except Exception as e:
            self.logger.error(f"Error executing VK command: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, "[ERROR] Ошибка выполнения команды")

    # === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

    async def _get_channel_owner_id_twitch(self, channel_name: str) -> Optional[int]:
        """Получить user_id владельца Twitch канала"""
        try:
            db = next(get_db())
            try:
                from repositories.user_repository import UserRepository
                user = UserRepository(db).get_by_twitch_username(channel_name)
                return user.id if user else None
            finally:
                db.close()
        except Exception as e:
            self.logger.error(f"Error getting Twitch channel owner ID: {e}")
            return None

    async def _get_channel_owner_id_vk(self, channel_name: str) -> Optional[int]:
        """Получить user_id владельца VK канала"""
        try:
            db = next(get_db())
            try:
                from repositories.user_repository import UserRepository
                repo = UserRepository(db)
                # Сначала ищем по vk_channel_name (правильное поле)
                user = repo.get_by_vk_channel_name(channel_name)
                if user:
                    return user.id

                # Fallback: ищем по vk_username для обратной совместимости
                user = repo.get_by_vk_username(channel_name)
                return user.id if user else None
            finally:
                db.close()
        except Exception as e:
            self.logger.error(f"Error getting VK channel owner ID: {e}")
            return None

    # _check_cooldown and _get_cooldown_remaining are deprecated replaced by CommandService
