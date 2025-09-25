# bot_service/bot.py
import os
import logging
import asyncio
from typing import List, Set
from twitchio.ext import commands
from core.connection_manager import ConnectionManager
from api.tts_api import TTSAPI
from api.youtube_api import YouTubeAPI

logger = logging.getLogger(__name__)

class Bot(commands.Bot):
    def __init__(self, token: str, initial_channels: List[str], connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.tts_api = TTSAPI()
        self.youtube_api = YouTubeAPI()
        
        super().__init__(
            token=token,
            prefix='!',
            initial_channels=initial_channels
        )

    async def event_ready(self):
        """Вызывается когда бот готов к работе"""
        logger.info(f'Bot logged in as {self.nick}')
        logger.info(f'Bot user id: {self.user_id}')
        logger.info(f'Connected to channels: {self.connected_channels}')

    async def event_raw_data(self, data: str):
        """Логирует все сырые данные, приходящие от Twitch IRC"""
        logger.debug(f"RAW < {data.strip()}")

    async def event_message(self, message):
        """Обрабатывает входящие сообщения"""
        # Логируем сам факт получения сообщения до всех проверок
        if message and hasattr(message, 'raw_data'):
            logger.info(f"Received message object, raw data: {message.raw_data.strip()}")
        else:
            logger.info("Received a message object, but it lacks raw_data.")

        try:
            # Проверяем, что все необходимые атрибуты существуют
            if not message or not message.channel or not message.author:
                logger.warning("Received message with missing attributes, skipping")
                return
            
            channel_name = getattr(message.channel, 'name', None)
            author_name = getattr(message.author, 'name', None)
            content = getattr(message, 'content', '')
            
            if not channel_name or not author_name:
                logger.warning(f"Message missing channel name or author name: channel={channel_name}, author={author_name}")
                return
            
            # Логируем все входящие сообщения для отладки
            logger.info(f"📨 Twitch chat [{channel_name}] {author_name}: {content}")
            
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
        
        # Если канал в процессе верификации, проверяем код
        # Проверяем как основной ключ, так и новый ключ для дополнительной верификации
        verification_keys = [channel_name, f"{channel_name}_new"]
        verification_found = False
        
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
        """Добавить видео в очередь"""
        if not url:
            await ctx.send("❌ Укажите URL видео: !add <url>")
            return
        
        # Валидируем URL
        if not self.youtube_api.validate_url(url):
            await ctx.send("❌ Неверный YouTube URL")
            return
        
        # Получаем информацию о видео
        video_info = self.youtube_api.get_video_info(url)
        if not video_info:
            await ctx.send("❌ Не удалось получить информацию о видео")
            return
        
        # Добавляем в очередь
        self.connection_manager.add_to_youtube_queue(ctx.channel.name.lower(), video_info)
        await ctx.send(f"✅ Добавлено в очередь: {video_info['title']}")

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

    async def event_channel_joined(self, channel):
        """Вызывается когда бот присоединяется к каналу"""
        logger.info(f'Joined channel: {channel.name}')
        await channel.send(f"/me подключился к чату!")

    async def event_channel_left(self, channel):
        """Вызывается когда бот покидает канал"""
        logger.info(f'Left channel: {channel.name}')

    async def event_join_failure(self, channel: str, error: str):
        """Вызывается при ошибке подключения к каналу."""
        logger.error(f"Failed to join channel {channel}. Reason: {error}")

    async def event_command_error(self, ctx, error):
        """Обработка ошибок команд"""
        logger.error(f'Command error in {ctx.channel.name}: {error}')
        await ctx.send("❌ Произошла ошибка при выполнении команды")

    async def event_error(self, error):
        """Обработка общих ошибок"""
        logger.error(f'Bot error: {error}')

    async def start_bot(self):
        """Запустить бота"""
        try:
            await self.start()
        except Exception as e:
            logger.error(f"Error starting bot: {e}")
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
