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
    
    async def _handle_game(self, ctx, bot, args, platform, db):
        """Handler для !game (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !game <название игры>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Проверяем настройку объединения категорий
            combine_categories = user.combine_categories if hasattr(user, 'combine_categories') else False
            
            # Ищем игру через Twitch API
            from api.twitch_api import TwitchAPI
            from core.connection_manager import get_connection_manager
            from utils.category_search import expand_query_with_aliases
            
            connection_manager = get_connection_manager()
            twitch_api = TwitchAPI(connection_manager)
            
            # Расширяем запрос с учётом алиасов (dbd -> Dead by Daylight)
            search_queries = expand_query_with_aliases(args)
            
            # Пробуем поиск по всем вариантам запроса
            games = None
            for search_query in search_queries:
                games = await twitch_api.search_categories(search_query)
                if games:
                    break
            
            if not games:
                await ctx.send(f"@{ctx.author.name} ❌ Игра '{args}' не найдена")
                return
            
            # Берём первую найденную игру
            game = games[0]
            game_id = game.get('id')
            game_name = game.get('name', args)
            
            # Обновляем категорию на Twitch
            success_twitch = await twitch_api.update_stream_category(user.id, game_id)
            
            results = []
            if success_twitch:
                results.append("Twitch")
            
            # Если включено объединение категорий И есть VK канал - обновляем и VK
            if combine_categories and user.vk_username:
                try:
                    from api.vk_api import VKLiveAPI
                    vk_api = VKLiveAPI()
                    
                    # Ищем категорию на VK используя те же алиасы
                    vk_categories = None
                    for search_query in search_queries:
                        vk_categories = await vk_api.get_categories(search=search_query, user_id=str(user.id))
                        if vk_categories:
                            break
                    
                    if vk_categories:
                        success_vk = await vk_api.update_stream_category(str(user.id), vk_categories[0])
                        if success_vk:
                            results.append("VK Live")
                except Exception as e:
                    self.logger.error(f"Error updating VK category: {e}")
            
            if results:
                platforms_text = " и ".join(results)
                await ctx.send(f"@{ctx.author.name} ✅ Игра изменена на: {game_name} ({platforms_text})")
                self.logger.info(f"✓ Game changed to {game_name} for {platforms_text}")
            else:
                await ctx.send(f"@{ctx.author.name} ❌ Не удалось изменить игру")
            
        except Exception as e:
            self.logger.error(f"Error in !game handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка изменения игры")
    
    async def _handle_game_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !game (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Использование: !game <название игры>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Проверяем настройку объединения категорий
            combine_categories = user.combine_categories if hasattr(user, 'combine_categories') else False
            
            # Ищем игру через VK API
            from api.vk_api import VKLiveAPI
            from utils.category_search import expand_query_with_aliases
            
            vk_api = VKLiveAPI()
            
            # Расширяем запрос с учётом алиасов (dbd -> Dead by Daylight)
            search_queries = expand_query_with_aliases(args)
            
            # Пробуем поиск по всем вариантам запроса
            categories = None
            for search_query in search_queries:
                categories = await vk_api.get_categories(search=search_query, user_id=str(user.id))
                if categories:
                    break
            
            if not categories:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Игра '{args}' не найдена")
                return
            
            # Берём первую найденную игру
            category = categories[0]
            game_name = category.get('title', args)
            
            # Обновляем категорию на VK
            success_vk = await vk_api.update_stream_category(str(user.id), category)
            
            results = []
            if success_vk:
                results.append("VK Live")
            
            # Если включено объединение категорий И есть Twitch канал - обновляем и Twitch
            if combine_categories and user.twitch_username:
                try:
                    from api.twitch_api import TwitchAPI
                    from core.connection_manager import get_connection_manager
                    
                    connection_manager = get_connection_manager()
                    twitch_api = TwitchAPI(connection_manager)
                    
                    # Ищем игру на Twitch используя те же алиасы
                    games = None
                    for search_query in search_queries:
                        games = await twitch_api.search_categories(search_query)
                        if games:
                            break
                    
                    if games:
                        success_twitch = await twitch_api.update_stream_category(user.id, games[0].get('id'))
                        if success_twitch:
                            results.append("Twitch")
                except Exception as e:
                    self.logger.error(f"Error updating Twitch category: {e}")
            
            if results:
                platforms_text = " и ".join(results)
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ✅ Игра изменена на: {game_name} ({platforms_text})")
                self.logger.info(f"✓ Game changed to {game_name} for {platforms_text}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Не удалось изменить игру")
            
        except Exception as e:
            self.logger.error(f"Error in !game VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка изменения игры")
    
    # === YouTube COMMANDS ===
    
    async def _handle_skip(self, ctx, bot, args, platform, db):
        """Handler для !skip (Twitch)"""
        try:
            from services.queue_service import QueueService
            from core.database import User
            
            # Получаем user_id владельца канала
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)
            
            if not queue:
                await ctx.send(f"@{ctx.author.name} ℹ️ Очередь пуста")
                return
            
            # Пропускаем первое видео
            first_video = queue[0]
            success = queue_service.remove_from_queue(user.id, first_video['id'], db)
            
            if success:
                await ctx.send(f"@{ctx.author.name} ⏭️ Видео пропущено: {first_video['title']}")
                self.logger.info(f"✓ Video skipped for {ctx.channel.name}")
            else:
                await ctx.send(f"@{ctx.author.name} ❌ Не удалось пропустить видео")
            
        except Exception as e:
            self.logger.error(f"Error in !skip handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка пропуска видео")
    
    async def _handle_skip_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !skip (VK)"""
        try:
            from services.queue_service import QueueService
            from core.database import User
            
            # Получаем user_id владельца канала
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)
            
            if not queue:
                await vk_bot.send_message(channel_name, f"@{author_name} ℹ️ Очередь пуста")
                return
            
            # Пропускаем первое видео
            first_video = queue[0]
            success = queue_service.remove_from_queue(user.id, first_video['id'], db)
            
            if success:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} ⏭️ Видео пропущено: {first_video['title']}")
                self.logger.info(f"✓ Video skipped for VK {channel_name}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Не удалось пропустить видео")
            
        except Exception as e:
            self.logger.error(f"Error in !skip VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка пропуска видео")
    
    async def _handle_clear(self, ctx, bot, args, platform, db):
        """Handler для !clear (Twitch)"""
        try:
            from services.queue_service import QueueService
            from core.database import User, YouTubeQueue
            
            # Получаем user_id владельца канала
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Очищаем очередь
            deleted_count = db.query(YouTubeQueue).filter(
                YouTubeQueue.user_id == user.id,
                YouTubeQueue.status == 'pending'
            ).update({YouTubeQueue.status: 'skipped'})
            
            db.commit()
            
            if deleted_count > 0:
                await ctx.send(f"@{ctx.author.name} 🗑️ Очередь очищена ({deleted_count} видео)")
                self.logger.info(f"✓ Queue cleared for {ctx.channel.name}: {deleted_count} videos")
            else:
                await ctx.send(f"@{ctx.author.name} ℹ️ Очередь уже пуста")
            
        except Exception as e:
            self.logger.error(f"Error in !clear handler: {e}", exc_info=True)
            db.rollback()
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка очистки очереди")
    
    async def _handle_clear_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !clear (VK)"""
        try:
            from core.database import User, YouTubeQueue
            
            # Получаем user_id владельца канала
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Очищаем очередь
            deleted_count = db.query(YouTubeQueue).filter(
                YouTubeQueue.user_id == user.id,
                YouTubeQueue.status == 'pending'
            ).update({YouTubeQueue.status: 'skipped'})
            
            db.commit()
            
            if deleted_count > 0:
                await vk_bot.send_message(channel_name,
                    f"@{author_name} 🗑️ Очередь очищена ({deleted_count} видео)")
                self.logger.info(f"✓ Queue cleared for VK {channel_name}: {deleted_count} videos")
            else:
                await vk_bot.send_message(channel_name, f"@{author_name} ℹ️ Очередь уже пуста")
            
        except Exception as e:
            self.logger.error(f"Error in !clear VK handler: {e}", exc_info=True)
            db.rollback()
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка очистки очереди")
    
    async def _handle_queue(self, ctx, bot, args, platform, db):
        """Handler для !queue (Twitch)"""
        try:
            from services.queue_service import QueueService
            from core.database import User
            
            # Получаем user_id владельца канала
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)
            
            if not queue:
                await ctx.send(f"@{ctx.author.name} ℹ️ Очередь пуста")
                return
            
            # Показываем первые 5 видео
            queue_list = []
            for i, video in enumerate(queue[:5], 1):
                title = video['title'][:50] + '...' if len(video['title']) > 50 else video['title']
                queue_list.append(f"{i}. {title}")
            
            queue_text = " | ".join(queue_list)
            total = len(queue)
            
            if total > 5:
                await ctx.send(f"📋 Очередь ({total} видео): {queue_text} и ещё {total - 5}...")
            else:
                await ctx.send(f"📋 Очередь ({total} видео): {queue_text}")
            
        except Exception as e:
            self.logger.error(f"Error in !queue handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка получения очереди")
    
    async def _handle_queue_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !queue (VK)"""
        try:
            from services.queue_service import QueueService
            from core.database import User
            
            # Получаем user_id владельца канала
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            queue_service = QueueService()
            queue = queue_service.get_queue(user.id, db)
            
            if not queue:
                await vk_bot.send_message(channel_name, f"@{author_name} ℹ️ Очередь пуста")
                return
            
            # Показываем первые 5 видео
            queue_list = []
            for i, video in enumerate(queue[:5], 1):
                title = video['title'][:50] + '...' if len(video['title']) > 50 else video['title']
                queue_list.append(f"{i}. {title}")
            
            queue_text = " | ".join(queue_list)
            total = len(queue)
            
            if total > 5:
                await vk_bot.send_message(channel_name,
                    f"📋 Очередь ({total} видео): {queue_text} и ещё {total - 5}...")
            else:
                await vk_bot.send_message(channel_name,
                    f"📋 Очередь ({total} видео): {queue_text}")
            
        except Exception as e:
            self.logger.error(f"Error in !queue VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка получения очереди")
    
    # === STREAM MANAGEMENT COMMANDS ===
    
    async def _handle_title(self, ctx, bot, args, platform, db):
        """Handler для !title (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !title <новое название>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Проверяем настройку объединения названий
            combine_titles = user.combine_titles if hasattr(user, 'combine_titles') else False
            
            # Обновляем название через Twitch API
            from api.twitch_api import TwitchAPI
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            twitch_api = TwitchAPI(connection_manager)
            
            success_twitch = await twitch_api.update_stream_title(user.id, args)
            
            results = []
            if success_twitch:
                results.append("Twitch")
            
            # Если включено объединение названий И есть VK канал - обновляем и VK
            if combine_titles and user.vk_username:
                try:
                    from api.vk_api import VKLiveAPI
                    vk_api = VKLiveAPI()
                    
                    success_vk = await vk_api.update_stream_title(str(user.id), args)
                    if success_vk:
                        results.append("VK Live")
                except Exception as e:
                    self.logger.error(f"Error updating VK title: {e}")
            
            if results:
                # Обрезаем название для отображения
                display_title = args[:50] + '...' if len(args) > 50 else args
                platforms_text = " и ".join(results)
                await ctx.send(f"@{ctx.author.name} ✅ Название изменено на: {display_title} ({platforms_text})")
                self.logger.info(f"✓ Title changed for {platforms_text}")
            else:
                await ctx.send(f"@{ctx.author.name} ❌ Не удалось изменить название")
            
        except Exception as e:
            self.logger.error(f"Error in !title handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка изменения названия")
    
    async def _handle_title_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !title (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Использование: !title <новое название>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Проверяем настройку объединения названий
            combine_titles = user.combine_titles if hasattr(user, 'combine_titles') else False
            
            # Обновляем название через VK API
            from api.vk_api import VKLiveAPI
            vk_api = VKLiveAPI()
            
            success_vk = await vk_api.update_stream_title(str(user.id), args)
            
            results = []
            if success_vk:
                results.append("VK Live")
            
            # Если включено объединение названий И есть Twitch канал - обновляем и Twitch
            if combine_titles and user.twitch_username:
                try:
                    from api.twitch_api import TwitchAPI
                    from core.connection_manager import get_connection_manager
                    
                    connection_manager = get_connection_manager()
                    twitch_api = TwitchAPI(connection_manager)
                    
                    success_twitch = await twitch_api.update_stream_title(user.id, args)
                    if success_twitch:
                        results.append("Twitch")
                except Exception as e:
                    self.logger.error(f"Error updating Twitch title: {e}")
            
            if results:
                # Обрезаем название для отображения
                display_title = args[:50] + '...' if len(args) > 50 else args
                platforms_text = " и ".join(results)
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ✅ Название изменено на: {display_title} ({platforms_text})")
                self.logger.info(f"✓ Title changed for {platforms_text}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Не удалось изменить название")
            
        except Exception as e:
            self.logger.error(f"Error in !title VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка изменения названия")
    
    # === TTS COMMANDS ===
    
    async def _handle_voice(self, ctx, bot, args, platform, db):
        """Handler для !voice (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !voice <имя голоса>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Получаем настройки TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            # Устанавливаем голос
            success = await tts_service.set_voice(user.id, args.lower(), db)
            
            if success:
                await ctx.send(f"@{ctx.author.name} 🎙️ Голос изменён на: {args}")
                self.logger.info(f"✓ Voice changed to {args} for {ctx.channel.name}")
            else:
                await ctx.send(f"@{ctx.author.name} ❌ Голос '{args}' не найден")
            
        except Exception as e:
            self.logger.error(f"Error in !voice handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка смены голоса")
    
    async def _handle_voice_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !voice (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Использование: !voice <имя голоса>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Получаем настройки TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            # Устанавливаем голос
            success = await tts_service.set_voice(user.id, args.lower(), db)
            
            if success:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} 🎙️ Голос изменён на: {args}")
                self.logger.info(f"✓ Voice changed to {args} for VK {channel_name}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Голос '{args}' не найден")
            
        except Exception as e:
            self.logger.error(f"Error in !voice VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка смены голоса")
    
    async def _handle_randomvoice(self, ctx, bot, args, platform, db):
        """Handler для !randomvoice (Twitch)"""
        try:
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Получаем настройки TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            # Устанавливаем случайный голос
            voice_name = await tts_service.set_random_voice(user.id, db)
            
            if voice_name:
                await ctx.send(f"@{ctx.author.name} 🎲 Случайный голос: {voice_name}")
                self.logger.info(f"✓ Random voice {voice_name} for {ctx.channel.name}")
            else:
                await ctx.send(f"@{ctx.author.name} ❌ Не удалось выбрать случайный голос")
            
        except Exception as e:
            self.logger.error(f"Error in !randomvoice handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка выбора случайного голоса")
    
    async def _handle_randomvoice_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !randomvoice (VK)"""
        try:
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Получаем настройки TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            # Устанавливаем случайный голос
            voice_name = await tts_service.set_random_voice(user.id, db)
            
            if voice_name:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} 🎲 Случайный голос: {voice_name}")
                self.logger.info(f"✓ Random voice {voice_name} for VK {channel_name}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Не удалось выбрать случайный голос")
            
        except Exception as e:
            self.logger.error(f"Error in !randomvoice VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка выбора случайного голоса")
    
    async def _handle_mute(self, ctx, bot, args, platform, db):
        """Handler для !mute (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !mute <username>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Блокируем пользователя для TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            target_username = args.strip().lower()
            success = tts_service.block_user(user.id, target_username, 'twitch', db)
            
            if success:
                await ctx.send(f"@{ctx.author.name} 🔇 TTS отключен для: {target_username}")
                self.logger.info(f"✓ User {target_username} muted for {ctx.channel.name}")
            else:
                await ctx.send(f"@{ctx.author.name} ⚠️ Пользователь уже в списке")
            
        except Exception as e:
            self.logger.error(f"Error in !mute handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка блокировки пользователя")
    
    async def _handle_mute_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !mute (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Использование: !mute <username>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Блокируем пользователя для TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            target_username = args.strip().lower()
            success = tts_service.block_user(user.id, target_username, 'vk', db)
            
            if success:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} 🔇 TTS отключен для: {target_username}")
                self.logger.info(f"✓ User {target_username} muted for VK {channel_name}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ⚠️ Пользователь уже в списке")
            
        except Exception as e:
            self.logger.error(f"Error in !mute VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка блокировки пользователя")
    
    async def _handle_unmute(self, ctx, bot, args, platform, db):
        """Handler для !unmute (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !unmute <username>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Разблокируем пользователя для TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            target_username = args.strip().lower()
            success = tts_service.unblock_user(user.id, target_username, 'twitch', db)
            
            if success:
                await ctx.send(f"@{ctx.author.name} 🔊 TTS включен для: {target_username}")
                self.logger.info(f"✓ User {target_username} unmuted for {ctx.channel.name}")
            else:
                await ctx.send(f"@{ctx.author.name} ⚠️ Пользователь не найден в списке")
            
        except Exception as e:
            self.logger.error(f"Error in !unmute handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка разблокировки пользователя")
    
    async def _handle_unmute_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !unmute (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Использование: !unmute <username>")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Разблокируем пользователя для TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            target_username = args.strip().lower()
            success = tts_service.unblock_user(user.id, target_username, 'vk', db)
            
            if success:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} 🔊 TTS включен для: {target_username}")
                self.logger.info(f"✓ User {target_username} unmuted for VK {channel_name}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ⚠️ Пользователь не найден в списке")
            
        except Exception as e:
            self.logger.error(f"Error in !unmute VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка разблокировки пользователя")
    
    async def _handle_ttsvolume(self, ctx, bot, args, platform, db):
        """Handler для !ttsvolume (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !ttsvolume <0-100>")
                return
            
            try:
                volume = int(args)
                if not 0 <= volume <= 100:
                    raise ValueError
            except ValueError:
                await ctx.send(f"@{ctx.author.name} ❌ Громкость должна быть от 0 до 100")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Устанавливаем громкость TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            success = await tts_service.set_volume(user.id, volume, db)
            
            if success:
                await ctx.send(f"@{ctx.author.name} 🔊 Громкость TTS: {volume}%")
                self.logger.info(f"✓ TTS volume set to {volume}% for {ctx.channel.name}")
            else:
                await ctx.send(f"@{ctx.author.name} ❌ Не удалось изменить громкость")
            
        except Exception as e:
            self.logger.error(f"Error in !ttsvolume handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка изменения громкости")
    
    async def _handle_ttsvolume_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !ttsvolume (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Использование: !ttsvolume <0-100>")
                return
            
            try:
                volume = int(args)
                if not 0 <= volume <= 100:
                    raise ValueError
            except ValueError:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Громкость должна быть от 0 до 100")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Устанавливаем громкость TTS
            from services.tts_service import TTSService
            tts_service = TTSService()
            
            success = await tts_service.set_volume(user.id, volume, db)
            
            if success:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} 🔊 Громкость TTS: {volume}%")
                self.logger.info(f"✓ TTS volume set to {volume}% for VK {channel_name}")
            else:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Не удалось изменить громкость")
            
        except Exception as e:
            self.logger.error(f"Error in !ttsvolume VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка изменения громкости")
    
    # === OTHER COMMANDS ===
    
    async def _handle_help(self, ctx, bot, args, platform, db):
        """Handler для !help (Twitch)"""
        try:
            # Получаем user_id владельца канала
            from core.database import User, BotCommand
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Получаем доступные команды
            from core.command_executor import CommandExecutor
            executor = CommandExecutor()
            
            # Получаем все команды (global + override + custom)
            all_commands = executor.find_command(None, user.id, 'twitch', db, get_all=True)
            
            # Формируем список команд
            cmd_list = []
            for cmd in all_commands[:10]:  # Первые 10 команд
                cmd_list.append(f"!{cmd.command_name}")
            
            if cmd_list:
                commands_text = ", ".join(cmd_list)
                total = len(all_commands)
                if total > 10:
                    await ctx.send(f"📋 Доступные команды: {commands_text}... (всего: {total})")
                else:
                    await ctx.send(f"📋 Доступные команды: {commands_text}")
            else:
                await ctx.send(f"@{ctx.author.name} ℹ️ Команды не найдены")
            
        except Exception as e:
            self.logger.error(f"Error in !help handler: {e}", exc_info=True)
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка получения списка команд")
    
    async def _handle_help_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !help (VK)"""
        try:
            # Получаем user_id владельца канала
            from core.database import User, BotCommand
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Получаем доступные команды
            from core.command_executor import CommandExecutor
            executor = CommandExecutor()
            
            # Получаем все команды (global + override + custom)
            all_commands = executor.find_command(None, user.id, 'vk', db, get_all=True)
            
            # Формируем список команд
            cmd_list = []
            for cmd in all_commands[:10]:  # Первые 10 команд
                cmd_list.append(f"!{cmd.command_name}")
            
            if cmd_list:
                commands_text = ", ".join(cmd_list)
                total = len(all_commands)
                if total > 10:
                    await vk_bot.send_message(channel_name,
                        f"📋 Доступные команды: {commands_text}... (всего: {total})")
                else:
                    await vk_bot.send_message(channel_name,
                        f"📋 Доступные команды: {commands_text}")
            else:
                await vk_bot.send_message(channel_name, f"@{author_name} ℹ️ Команды не найдены")
            
        except Exception as e:
            self.logger.error(f"Error in !help VK handler: {e}", exc_info=True)
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка получения списка команд")
    
    async def _handle_ytvolume(self, ctx, bot, args, platform, db):
        """Handler для !ytvolume (Twitch)"""
        try:
            if not args:
                await ctx.send(f"@{ctx.author.name} ❌ Использование: !ytvolume <0-100>")
                return
            
            try:
                volume = int(args)
                if not 0 <= volume <= 100:
                    raise ValueError
            except ValueError:
                await ctx.send(f"@{ctx.author.name} ❌ Громкость должна быть от 0 до 100")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.twitch_username == ctx.channel.name.lower()
            ).first()
            
            if not user:
                await ctx.send(f"@{ctx.author.name} ❌ Канал не найден")
                return
            
            # Устанавливаем громкость YouTube через UserSettings
            from core.database import UserSettings
            settings = db.query(UserSettings).filter(
                UserSettings.user_id == user.id
            ).first()
            
            if not settings:
                settings = UserSettings(user_id=user.id)
                db.add(settings)
            
            settings.youtube_volume = volume
            db.commit()
            
            await ctx.send(f"@{ctx.author.name} 🎵 Громкость YouTube: {volume}%")
            self.logger.info(f"✓ YouTube volume set to {volume}% for {ctx.channel.name}")
            
        except Exception as e:
            self.logger.error(f"Error in !ytvolume handler: {e}", exc_info=True)
            db.rollback()
            await ctx.send(f"@{ctx.author.name} ❌ Ошибка изменения громкости")
    
    async def _handle_ytvolume_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !ytvolume (VK)"""
        try:
            if not args:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Использование: !ytvolume <0-100>")
                return
            
            try:
                volume = int(args)
                if not 0 <= volume <= 100:
                    raise ValueError
            except ValueError:
                await vk_bot.send_message(channel_name, 
                    f"@{author_name} ❌ Громкость должна быть от 0 до 100")
                return
            
            # Получаем user_id владельца канала
            from core.database import User
            user = db.query(User).filter(
                User.vk_username == channel_name.lower()
            ).first()
            
            if not user:
                await vk_bot.send_message(channel_name, f"@{author_name} ❌ Канал не найден")
                return
            
            # Устанавливаем громкость YouTube через UserSettings
            from core.database import UserSettings
            settings = db.query(UserSettings).filter(
                UserSettings.user_id == user.id
            ).first()
            
            if not settings:
                settings = UserSettings(user_id=user.id)
                db.add(settings)
            
            settings.youtube_volume = volume
            db.commit()
            
            await vk_bot.send_message(channel_name, 
                f"@{author_name} 🎵 Громкость YouTube: {volume}%")
            self.logger.info(f"✓ YouTube volume set to {volume}% for VK {channel_name}")
            
        except Exception as e:
            self.logger.error(f"Error in !ytvolume VK handler: {e}", exc_info=True)
            db.rollback()
            await vk_bot.send_message(channel_name, 
                f"@{author_name} ❌ Ошибка изменения громкости")
    
    async def _handle_analyze(self, ctx, bot, args, platform, db):
        """Handler для !analyze (Twitch) - заглушка"""
        try:
            await ctx.send(f"@{ctx.author.name} 🤖 Функция анализа чата в разработке")
            self.logger.info(f"!analyze called by {ctx.author.name} on {ctx.channel.name}")
        except Exception as e:
            self.logger.error(f"Error in !analyze handler: {e}", exc_info=True)
    
    async def _handle_analyze_vk(self, channel_name, author_name, author_id, args, vk_bot, message_data, db):
        """Handler для !analyze (VK) - заглушка"""
        try:
            await vk_bot.send_message(channel_name, 
                f"@{author_name} 🤖 Функция анализа чата в разработке")
            self.logger.info(f"!analyze called by {author_name} on VK {channel_name}")
        except Exception as e:
            self.logger.error(f"Error in !analyze VK handler: {e}", exc_info=True)
    
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

