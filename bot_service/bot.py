# bot_service/bot.py
import os
import logging
import asyncio
from typing import List, Set
from twitchio.ext import commands
from bot_service.connection_manager import ConnectionManager
from bot_service.tts_api import TTSAPI
from bot_service.youtube_api import YouTubeAPI

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

    async def event_message(self, message):
        """Обрабатывает входящие сообщения"""
        # Игнорируем сообщения от самого бота
        if message.echo:
            return

        # Проверяем, не заблокирован ли бот
        if self.connection_manager.is_bot_blocked(message.author.name):
            logger.info(f"Message from blocked bot {message.author.name} ignored")
            return

        # Обрабатываем команды
        await self.handle_commands(message)
        
        # Обрабатываем обычные сообщения для TTS
        await self.handle_tts_message(message)

    async def handle_tts_message(self, message):
        """Обработать сообщение для TTS"""
        channel_name = message.channel.name.lower()
        
        # Проверяем, включен ли TTS для канала
        if not self.connection_manager.is_tts_enabled(channel_name):
            return

        # Отправляем запрос на озвучку
        text = message.content
        author = message.author.name
        
        # Убираем префикс автора из текста, если он есть
        if text.startswith(f"{author} говорит:"):
            text = text.replace(f"{author} говорит:", "").strip()
        
        if text:  # Только если есть текст для озвучки
            await self.tts_api.send_tts_request(channel_name, text, author)

    @commands.command(name='tts')
    async def toggle_tts(self, ctx):
        """Команда для переключения TTS"""
        channel_name = ctx.channel.name.lower()
        
        if self.connection_manager.is_tts_enabled(channel_name):
            self.connection_manager.disable_tts(channel_name)
            await ctx.send("🔇 TTS отключен")
        else:
            self.connection_manager.enable_tts(channel_name)
            await ctx.send("🔊 TTS включен")

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
        await channel.send("🤖 Бот подключен! Используйте !help для списка команд")

    async def event_channel_left(self, channel):
        """Вызывается когда бот покидает канал"""
        logger.info(f'Left channel: {channel.name}')

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
