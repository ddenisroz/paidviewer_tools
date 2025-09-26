# bot_service/bot.py
import os
import logging
import asyncio
from typing import List, Set
from twitchio.ext import commands
from core.connection_manager import ConnectionManager
from api.tts_api import TTSAPI
from api.youtube_api import YouTubeAPI
from utils.role_checker import RoleChecker

# Включаем детальное логирование для TwitchIO
logging.getLogger('twitchio').setLevel(logging.DEBUG)
logging.getLogger('twitchio.websocket').setLevel(logging.DEBUG)
logging.getLogger('twitchio.client').setLevel(logging.DEBUG)

logger = logging.getLogger('bot_service')

class Bot(commands.Bot):
    def __init__(self, token: str, initial_channels: List[str], connection_manager: ConnectionManager):
        logger.info(f"🤖 CREATING TWITCH BOT")
        logger.info(f"📋 Token: {token[:10]}...")
        logger.info(f"🔗 Initial channels: {initial_channels}")
        
        self.connection_manager = connection_manager
        self.tts_api = TTSAPI()
        self.youtube_api = YouTubeAPI()
        
        logger.info(f"🔧 Initializing TwitchIO Bot...")
        super().__init__(
            token=token,
            prefix='!',
            initial_channels=initial_channels
        )
        logger.info(f"✅ TwitchIO Bot initialized")

    async def event_ready(self):
        """Вызывается когда бот готов к работе"""
        logger.info(f'🤖 TWITCH BOT READY!')
        logger.info(f'📋 Bot logged in as: {self.nick}')
        logger.info(f'🆔 Bot user id: {self.user_id}')
        logger.info(f'🔗 Connected to channels: {self.connected_channels}')
        logger.info(f'🎯 BOT IS NOW LISTENING FOR MESSAGES IN ALL CHANNELS!')
        logger.info(f'🎯 BOT IS NOW LISTENING FOR MESSAGES IN THESE CHANNELS')
        
        for channel in self.connected_channels:
            logger.info(f'✅ MONITORING CHAT: {channel.name}')

    async def event_raw_data(self, data: str):
        """Логирует все сырые данные, приходящие от Twitch IRC"""
        logger.debug(f"RAW < {data.strip()}")

    async def event_message(self, message):
        """Обрабатывает входящие сообщения"""
        # АГРЕССИВНОЕ ЛОГИРОВАНИЕ - логируем ВСЕ входящие сообщения
        logger.info(f"🔔 MESSAGE RECEIVED! Type: {type(message)}")
        
        # Логируем сам факт получения сообщения до всех проверок
        if message and hasattr(message, 'raw_data'):
            logger.info(f"📨 RAW MESSAGE DATA: {message.raw_data.strip()}")
        else:
            logger.info("⚠️ Message object lacks raw_data")
            
        # Логируем основные атрибуты сообщения
        logger.info(f"📋 Message attributes: channel={getattr(message, 'channel', None)}, author={getattr(message, 'author', None)}, content={getattr(message, 'content', None)}")

        try:
            # Проверяем, что все необходимые атрибуты существуют
            if not message:
                logger.debug("Received empty message, skipping")
                return
                
            # Проверяем наличие канала
            if not hasattr(message, 'channel') or not message.channel:
                logger.debug("Received message without channel, skipping")
                return
                
            # Проверяем наличие автора
            if not hasattr(message, 'author') or not message.author:
                logger.debug("Received message without author, skipping")
                return
            
            channel_name = getattr(message.channel, 'name', None)
            author_name = getattr(message.author, 'name', None)
            content = getattr(message, 'content', '')
            
            if not channel_name or not author_name:
                logger.debug(f"Message missing channel name or author name: channel={channel_name}, author={author_name}")
                return
            
            # Логируем все входящие сообщения для отладки
            logger.info(f"📨 TWITCH CHAT [{channel_name}] {author_name}: {content}")
            logger.info(f"🎯 BOT IS LISTENING TO TWITCH CHAT - CHANNEL: {channel_name}")
            
            
            # Игнорируем сообщения от самого бота
            if message.echo:
                return

            # Проверяем, не заблокирован ли бот
            if self.connection_manager.is_bot_blocked(author_name):
                logger.info(f"Message from blocked bot {author_name} ignored")
                return
        except Exception as e:
            logger.error(f"Error in event_message processing message attributes: {e}")
            return

        # Проверяем верификацию для гостевых подключений
        channel_name = channel_name.lower()
        verification_found = False
        
        # Верификация нужна только если есть активные pending_verifications
        # И только если это не владелец канала
        if channel_name in self.connection_manager.pending_verifications and author_name.lower() != channel_name:
            # Если канал в процессе верификации, проверяем код
            # Проверяем как основной ключ, так и новый ключ для дополнительной верификации
            verification_keys = [channel_name, f"{channel_name}_new"]
            
            for key in verification_keys:
                if key in self.connection_manager.pending_verifications:
                    verification = self.connection_manager.pending_verifications[key]
                    if not verification.get("verified", False):
                        # Проверяем, содержит ли сообщение код верификации
                        if self.connection_manager.check_verification(key, content, author_name):
                            logger.info(f"Channel {channel_name} verified by {author_name} using key {key}")
                            
                            # Если это новая верификация, отключаем предыдущую сессию
                            if key == f"{channel_name}_new":
                                # Очищаем старую верификацию
                                if channel_name in self.connection_manager.pending_verifications:
                                    del self.connection_manager.pending_verifications[channel_name]
                                # Переименовываем новую верификацию в основную
                                self.connection_manager.pending_verifications[channel_name] = verification
                                del self.connection_manager.pending_verifications[key]
                        
                        # Отправляем подтверждение в чат
                        await message.channel.send(f"✅ Верификация успешна! Добро пожаловать, {author_name}!")
                        verification_found = True
                        break
                    else:
                        # Если код не найден, очищаем данные верификации для этого ключа
                        logger.warning(f"Verification failed for channel {channel_name} by {author_name} using key {key}, clearing verification data...")
                        del self.connection_manager.pending_verifications[key]
                        
                        # Если это была последняя попытка верификации, отключаем бота от канала
                        remaining_verifications = [k for k in self.connection_manager.pending_verifications.keys() if k.startswith(channel_name)]
                        if not remaining_verifications:
                            logger.info(f"No more verification attempts for channel {channel_name}, disconnecting bot...")
                            
                            # Уведомляем пользователя о неудачной верификации
                            await message.channel.send(f"❌ Верификация не удалась. Бот отключается от канала {channel_name}.")
                            
                            await self.leave_channel(channel_name)
                            
                            # Очищаем данные верификации из базы данных
                            try:
                                from core.database import get_db, GuestVerification
                                db_gen = get_db()
                                db = next(db_gen)
                                try:
                                    db.query(GuestVerification).filter(
                                        GuestVerification.channel_name == channel_name
                                    ).delete()
                                    db.commit()
                                    logger.info(f"Cleared verification data from database for channel: {channel_name}")
                                finally:
                                    db.close()
                            except Exception as e:
                                logger.error(f"Failed to clear verification data from database: {e}")
                        
                        verification_found = True
                        break
                else:
                    # Канал уже верифицирован, не проверяем повторно
                    logger.debug(f"Channel {channel_name} already verified with key {key}, skipping verification check")
                    verification_found = True
                    break
        
        if not verification_found:
            # Канал не в процессе верификации, значит он авторизованный или уже верифицирован
            logger.debug(f"Channel {channel_name} not in verification process, skipping verification check")

        # Обрабатываем команды
        await self.handle_commands(message)
        
        # Обрабатываем обычные сообщения для TTS
        await self.handle_tts_message(message)

    async def handle_tts_message(self, message):
        """Обработать сообщение для TTS"""
        try:
            # Проверяем, что все необходимые атрибуты существуют
            if not message or not message.channel or not message.author:
                logger.warning("TTS: Received message with missing attributes, skipping")
                return
                
            channel_name = getattr(message.channel, 'name', None)
            author_name = getattr(message.author, 'name', None)
            content = getattr(message, 'content', '')
            
            if not channel_name or not author_name:
                logger.warning(f"TTS: Message missing channel name or author name: channel={channel_name}, author={author_name}")
                return
                
            channel_name = channel_name.lower()
            
            # Проверяем, включен ли TTS для канала на платформе Twitch
            if not self.connection_manager.is_tts_enabled(channel_name, 'twitch'):
                logger.debug(f"TTS not enabled for Twitch channel {channel_name}, skipping TTS processing")
                return
            
            # Проверяем whitelist для канала
            if not self.connection_manager.is_channel_whitelisted(channel_name):
                logger.debug(f"Channel {channel_name} not whitelisted, skipping TTS processing")
                return

            # Отправляем запрос на озвучку
            text = content
            author = author_name
            
            # Убираем префикс автора из текста, если он есть
            if text.startswith(f"{author} говорит:"):
                text = text.replace(f"{author} говорит:", "").strip()
            
            if text:  # Только если есть текст для озвучки
                logger.info(f"🎤 Sending TTS request for Twitch channel {channel_name}: {text[:50]}...")
                await self.tts_api.send_tts_request(channel_name, text, author)
        except Exception as e:
            logger.error(f"Error in handle_tts_message: {e}")

    async def handle_commands(self, message):
        """Обработка команд из базы данных"""
        try:
            if not message or not message.channel or not message.author:
                return
                
            channel_name = getattr(message.channel, 'name', None)
            author_name = getattr(message.author, 'name', None)
            content = getattr(message, 'content', '')
            
            if not channel_name or not author_name or not content:
                return
            
            # Проверяем, является ли сообщение командой
            if not content.startswith('!'):
                return
            
            # Извлекаем название команды
            command_name = content.split()[0][1:].lower()  # Убираем ! и приводим к нижнему регистру
            
            # Получаем команды из базы данных
            from core.database import get_db, BotCommand
            db_gen = get_db()
            db = next(db_gen)
            
            try:
                # Ищем команду в базе данных
                command = db.query(BotCommand).filter(
                    BotCommand.channel_name == channel_name,
                    BotCommand.command_name == command_name,
                    BotCommand.is_enabled == True
                ).first()
                
                if not command:
                    return  # Команда не найдена или отключена
                
                # Проверяем платформу
                if 'twitch' not in command.platforms.split(','):
                    return  # Команда не для Twitch
                
                # Получаем роли пользователя
                user_badges = getattr(message.author, 'badges', [])
                user_roles = RoleChecker.check_twitch_role(
                    user_badges, 
                    str(message.author.id), 
                    str(message.channel.id)
                )
                
                # Проверяем права доступа
                if not RoleChecker.can_execute_command(user_roles, command.allowed_roles, 'twitch'):
                    await message.channel.send(f"❌ У вас нет прав для выполнения команды !{command_name}")
                    return
                
                # Проверяем кулдаун
                from datetime import datetime, timedelta
                if command.last_used and command.cooldown_seconds > 0:
                    time_since_last_use = datetime.utcnow() - command.last_used
                    if time_since_last_use.total_seconds() < command.cooldown_seconds:
                        remaining_time = command.cooldown_seconds - int(time_since_last_use.total_seconds())
                        await message.channel.send(f"⏰ Команда !{command_name} на кулдауне. Осталось: {remaining_time}с")
                        return
                
                # Выполняем команду
                if command.command_type == 'custom':
                    # Кастомная команда - отправляем ответ
                    response = command.response_text
                    if response:
                        await message.channel.send(response)
                else:
                    # Базовая команда - вызываем соответствующий обработчик
                    await self.handle_basic_command(command_name, message, command)
                
                # Обновляем статистику использования
                command.last_used = datetime.utcnow()
                command.usage_count += 1
                db.commit()
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in handle_commands: {e}")

    async def handle_basic_command(self, command_name: str, message, command):
        """Обработка базовых команд"""
        try:
            if command_name == 'tts':
                await self.toggle_tts_from_message(message)
            elif command_name == 'queue':
                await self.show_queue_from_message(message)
            elif command_name == 'next':
                await self.next_video_from_message(message)
            elif command_name == 'clear':
                await self.clear_queue_from_message(message)
            elif command_name == 'sr':
                # Извлекаем URL из сообщения
                parts = message.content.split()
                url = parts[1] if len(parts) > 1 else None
                await self.song_request_from_message(message, url)
            elif command_name == 'help':
                await self.help_command_from_message(message)
            # Добавьте другие базовые команды по необходимости
        except Exception as e:
            logger.error(f"Error in handle_basic_command: {e}")

    @commands.command(name='tts')
    async def toggle_tts(self, ctx):
        """Команда для переключения TTS для Twitch"""
        channel_name = ctx.channel.name.lower()
        
        if self.connection_manager.is_tts_enabled(channel_name, 'twitch'):
            self.connection_manager.disable_tts(channel_name, 'twitch')
            await ctx.send("🔇 TTS отключен для Twitch")
        else:
            self.connection_manager.enable_tts(channel_name, 'twitch')
            await ctx.send("🔊 TTS включен для Twitch")

    @commands.command(name='queue')
    async def show_queue(self, ctx):
        """Показать очередь YouTube видео"""
        channel_name = ctx.channel.name.lower()
        queue = self.connection_manager.get_youtube_queue(channel_name)
        
        if not queue:
            await ctx.send("📺 Очередь пуста")
            return
        
        current_video = self.connection_manager.get_current_video(channel_name)
        if current_video:
            await ctx.send(f"🎵 Сейчас играет: {current_video.get('title', 'Unknown')}")
        
        if queue:
            queue_text = "📋 Очередь:\n"
            for i, video in enumerate(queue[:5], 1):  # Показываем только первые 5
                queue_text += f"{i}. {video.get('title', 'Unknown')}\n"
            
            if len(queue) > 5:
                queue_text += f"... и еще {len(queue) - 5} видео"
            
            await ctx.send(queue_text)

    @commands.command(name='next')
    async def next_video(self, ctx):
        """Переключить на следующее видео"""
        channel_name = ctx.channel.name.lower()
        next_video = self.connection_manager.next_youtube_video(channel_name)
        
        if next_video:
            await ctx.send(f"⏭️ Переключено на: {next_video.get('title', 'Unknown')}")
        else:
            await ctx.send("📺 В очереди нет видео")

    @commands.command(name='clear')
    async def clear_queue(self, ctx):
        """Очистить очередь видео"""
        channel_name = ctx.channel.name.lower()
        self.connection_manager.clear_youtube_queue(channel_name)
        await ctx.send("🗑️ Очередь очищена")

    @commands.command(name='add')
    async def add_video(self, ctx, url: str = None):
        """Добавить видео в очередь (устаревшая команда, используйте !sr)"""
        await ctx.send("⚠️ Команда !add устарела. Используйте !sr <URL>")

    @commands.command(name='sr')
    async def song_request(self, ctx, url: str = None):
        """Заказать YouTube видео"""
        if not url:
            await ctx.send("❌ Укажите URL видео: !sr <url>")
            return
        
        try:
            from services.queue_service import QueueService
            from core.database import get_db
            
            queue_service = QueueService()
            
            # Получаем user_id владельца канала
            # TODO: получить реальный ID через session_manager
            channel_owner_id = 1  # Заглушка
            
            db = next(get_db())
            try:
                result = await queue_service.add_video_to_queue(
                    user_id=channel_owner_id,
                    video_url=url,
                    channel_name=ctx.channel.name,
                    platform='twitch',
                    requester_name=ctx.author.name,
                    requester_id=str(ctx.author.id),
                    is_paid=False,
                    db=db
                )
                
                if result['success']:
                    queue_item = result['queue_item']
                    await ctx.send(
                        f"✅ Добавлено в очередь: {queue_item['title']} "
                        f"(позиция {queue_item['position']}, {queue_item.get('duration', 'Unknown')})"
                    )
                else:
                    await ctx.send(f"❌ {result['error']}")
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in Twitch song request: {e}")
            await ctx.send("❌ Ошибка добавления видео в очередь")

    @commands.command(name='help')
    async def help_command(self, ctx):
        """Показать список команд"""
        help_text = """
🤖 Доступные команды:
!tts - Включить/выключить TTS
!queue - Показать очередь видео
!next - Следующее видео
!clear - Очистить очередь
!add <url> - Добавить видео в очередь
!help - Показать это сообщение
        """
        await ctx.send(help_text)

    # Функции для работы с сообщениями (не ctx)
    async def toggle_tts_from_message(self, message):
        """Команда для переключения TTS для Twitch (из сообщения)"""
        channel_name = message.channel.name.lower()
        
        if self.connection_manager.is_tts_enabled(channel_name, 'twitch'):
            self.connection_manager.disable_tts(channel_name, 'twitch')
            await message.channel.send("🔇 TTS отключен для Twitch")
        else:
            self.connection_manager.enable_tts(channel_name, 'twitch')
            await message.channel.send("🔊 TTS включен для Twitch")

    async def show_queue_from_message(self, message):
        """Показать очередь YouTube видео (из сообщения)"""
        channel_name = message.channel.name.lower()
        queue = self.connection_manager.get_youtube_queue(channel_name)
        
        if not queue:
            await message.channel.send("📺 Очередь пуста")
            return
        
        current_video = self.connection_manager.get_current_video(channel_name)
        if current_video:
            await message.channel.send(f"🎵 Сейчас играет: {current_video.get('title', 'Unknown')}")
        
        queue_text = "📺 Очередь:\n"
        for i, video in enumerate(queue[:5], 1):  # Показываем только первые 5
            queue_text += f"{i}. {video.get('title', 'Unknown')}\n"
        
        if len(queue) > 5:
            queue_text += f"... и еще {len(queue) - 5} видео"
        
        await message.channel.send(queue_text)

    async def next_video_from_message(self, message):
        """Переключить на следующее видео (из сообщения)"""
        channel_name = message.channel.name.lower()
        next_video = self.connection_manager.next_youtube_video(channel_name)
        
        if next_video:
            await message.channel.send(f"⏭️ Переключено на: {next_video.get('title', 'Unknown')}")
        else:
            await message.channel.send("📺 В очереди нет видео")

    async def clear_queue_from_message(self, message):
        """Очистить очередь видео (из сообщения)"""
        channel_name = message.channel.name.lower()
        self.connection_manager.clear_youtube_queue(channel_name)
        await message.channel.send("🗑️ Очередь очищена")

    async def song_request_from_message(self, message, url: str = None):
        """Заказать YouTube видео (из сообщения)"""
        if not url:
            await message.channel.send("❌ Укажите URL видео: !sr <url>")
            return
        
        try:
            from services.queue_service import QueueService
            from core.database import get_db
            
            # Получаем информацию о пользователе
            user_id = str(message.author.id)
            user_name = message.author.name
            channel_name = message.channel.name.lower()
            
            # Добавляем видео в очередь через сервис
            queue_service = QueueService()
            result = queue_service.add_to_queue(user_id, user_name, url, channel_name)
            
            if result['success']:
                video_info = result['video_info']
                await message.channel.send(f"✅ {user_name} добавил в очередь: {video_info['title']}")
            else:
                await message.channel.send(f"❌ Ошибка добавления видео: {result['error']}")
                
        except Exception as e:
            logger.error(f"Error in song_request_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при добавлении видео")

    async def help_command_from_message(self, message):
        """Показать список команд (из сообщения)"""
        help_text = """
🤖 Доступные команды:
!tts - Включить/выключить TTS
!queue - Показать очередь видео
!next - Следующее видео
!clear - Очистить очередь
!sr <url> - Добавить видео в очередь
!help - Показать это сообщение
        """
        await message.channel.send(help_text)

    async def event_channel_joined(self, channel):
        """Вызывается когда бот присоединяется к каналу"""
        logger.info(f'✅ SUCCESSFULLY JOINED CHANNEL: {channel.name}')
        logger.info(f'🎯 BOT IS NOW LISTENING TO CHAT IN: {channel.name}')
        await channel.send(f"/me подключился к чату!")

    async def event_channel_left(self, channel):
        """Вызывается когда бот покидает канал"""
        logger.info(f'❌ LEFT CHANNEL: {channel.name}')
        logger.info(f'🔇 NO LONGER LISTENING TO: {channel.name}')

    async def event_join_failure(self, channel: str, error: str):
        """Вызывается при ошибке подключения к каналу."""
        logger.error(f"❌ FAILED TO JOIN CHANNEL {channel}. Reason: {error}")
        logger.error(f"🔇 BOT CANNOT LISTEN TO CHAT IN: {channel}")

    async def event_command_error(self, ctx, error):
        """Обработка ошибок команд"""
        logger.error(f'Command error in {ctx.channel.name}: {error}')
        await ctx.send("❌ Произошла ошибка при выполнении команды")

    async def event_error(self, error):
        """Обработка общих ошибок"""
        logger.error(f'Bot error: {error}')

    async def start_bot(self):
        """Запустить бота"""
        logger.info(f"🚀 STARTING TWITCH BOT...")
        logger.info(f"🔗 Bot will connect to IRC and join channels")
        
        try:
            logger.info(f"📡 Calling TwitchIO start()...")
            await self.start()
            logger.info(f"✅ TwitchIO start() completed")
        except Exception as e:
            logger.error(f"❌ ERROR STARTING BOT: {e}")
            logger.error(f"🔍 This might be a token or connection issue")
            raise

    async def stop_bot(self):
        """Остановить бота"""
        try:
            await self.close()
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")

    def is_connected_to_channel(self, channel_name: str) -> bool:
        """Проверить, подключен ли бот к каналу"""
        return channel_name.lower() in [ch.name.lower() for ch in self.connected_channels]

    async def join_channel(self, channel_name: str):
        """Присоединиться к каналу"""
        try:
            await self.join_channels([channel_name])
            logger.info(f"Joined channel: {channel_name}")
            return True
        except Exception as e:
            logger.error(f"Error joining channel {channel_name}: {e}")
            return False

    async def leave_channel(self, channel_name: str):
        """Покинуть канал"""
        try:
            await self.part_channels([channel_name])
            logger.info(f"Left channel: {channel_name}")
            return True
        except Exception as e:
            logger.error(f"Error leaving channel {channel_name}: {e}")
            return False
