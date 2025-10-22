# bot_service/bots/twitch_bot_commands.py
"""Команды Twitch бота"""
import logging
import asyncio
from typing import Optional
from twitchio.ext import commands
from core.database import BotCommand
from api.tts_api import TTSAPI
from api.youtube_api import YouTubeAPI
from utils.role_checker import RoleChecker

logger = logging.getLogger('bot_service')

class TwitchBotCommands:
    """Класс с командами Twitch бота"""
    
    def __init__(self, bot, tts_api: TTSAPI, youtube_api: YouTubeAPI, role_checker: RoleChecker):
        self.bot = bot
        self.tts_api = tts_api
        self.youtube_api = youtube_api
        self.role_checker = role_checker

    @commands.command(name='tts')
    async def tts_command(self, ctx, *, text: str = None):
        """Команда TTS синтеза"""
        try:
            if not text:
                await ctx.send('Использование: !tts <текст>')
                return
            
            # Проверяем права пользователя
            if not await self.role_checker.has_permission(ctx.author.name, 'tts'):
                await ctx.send('У вас нет прав на использование TTS')
                return
            
            # Ограничиваем длину текста
            if len(text) > 200:
                await ctx.send('Текст слишком длинный (максимум 200 символов)')
                return
            
            # Отправляем запрос на TTS
            result = await self.tts_api.synthesize_speech(
                text=text,
                voice='default',
                user_id=ctx.author.id,
                channel=ctx.channel.name
            )
            
            if result.get('success'):
                await ctx.send('✅ TTS запрос отправлен!')
            else:
                await ctx.send('❌ Ошибка TTS синтеза')
                
        except Exception as e:
            logger.error(f'Error in tts command: {e}')
            await ctx.send('❌ Произошла ошибка')

    @commands.command(name='youtube')
    async def youtube_command(self, ctx, *, query: str = None):
        """Команда поиска YouTube"""
        try:
            if not query:
                await ctx.send('Использование: !youtube <запрос>')
                return
            
            # Проверяем права пользователя
            if not await self.role_checker.has_permission(ctx.author.name, 'youtube'):
                await ctx.send('У вас нет прав на поиск YouTube')
                return
            
            # Ищем видео
            results = await self.youtube_api.search_videos(query, max_results=3)
            
            if results:
                response = '🎥 Найденные видео:\n'
                for i, video in enumerate(results, 1):
                    response += f'{i}. {video["title"]} - {video["url"]}\n'
                await ctx.send(response)
            else:
                await ctx.send('❌ Видео не найдены')
                
        except Exception as e:
            logger.error(f'Error in youtube command: {e}')
            await ctx.send('❌ Произошла ошибка')

    @commands.command(name='help')
    async def help_command(self, ctx):
        """Команда помощи"""
        try:
            help_text = """
🤖 Доступные команды:
!tts <текст> - Синтез речи
!youtube <запрос> - Поиск YouTube
!help - Эта справка
!ping - Проверка бота
!uptime - Время работы
            """
            await ctx.send(help_text)
        except Exception as e:
            logger.error(f'Error in help command: {e}')

    @commands.command(name='ping')
    async def ping_command(self, ctx):
        """Команда ping"""
        try:
            await ctx.send('🏓 Pong!')
        except Exception as e:
            logger.error(f'Error in ping command: {e}')

    @commands.command(name='uptime')
    async def uptime_command(self, ctx):
        """Команда времени работы"""
        try:
            # Простая заглушка для uptime
            await ctx.send('⏰ Бот работает!')
        except Exception as e:
            logger.error(f'Error in uptime command: {e}')

    @commands.command(name='addcommand')
    async def add_command(self, ctx, command_name: str = None, *, command_text: str = None):
        """Добавить пользовательскую команду"""
        try:
            # Проверяем права (только модераторы)
            if not await self.role_checker.has_permission(ctx.author.name, 'moderator'):
                await ctx.send('❌ У вас нет прав на добавление команд')
                return
            
            if not command_name or not command_text:
                await ctx.send('Использование: !addcommand <имя> <текст>')
                return
            
            # Добавляем команду в БД
            # Здесь должен быть код добавления в БД
            await ctx.send(f'✅ Команда !{command_name} добавлена')
            
        except Exception as e:
            logger.error(f'Error in addcommand: {e}')
            await ctx.send('❌ Произошла ошибка')

    @commands.command(name='delcommand')
    async def del_command(self, ctx, command_name: str = None):
        """Удалить пользовательскую команду"""
        try:
            # Проверяем права (только модераторы)
            if not await self.role_checker.has_permission(ctx.author.name, 'moderator'):
                await ctx.send('❌ У вас нет прав на удаление команд')
                return
            
            if not command_name:
                await ctx.send('Использование: !delcommand <имя>')
                return
            
            # Удаляем команду из БД
            # Здесь должен быть код удаления из БД
            await ctx.send(f'✅ Команда !{command_name} удалена')
            
        except Exception as e:
            logger.error(f'Error in delcommand: {e}')
            await ctx.send('❌ Произошла ошибка')

    async def song_request_command(self, ctx, url: str = None):
        """Команда Song Request (добавить видео YouTube в очередь)"""
        try:
            if not url:
                await ctx.send('❌ Использование: !sr <YouTube URL или ID>')
                return
            
            # Получаем информацию о видео и добавляем в очередь
            result = await self.youtube_api.add_to_queue(url, ctx.author.name)
            
            if result.get('success'):
                video_title = result.get('title', 'Video')
                await ctx.send(f'✅ Видео "{video_title}" добавлено в очередь (позиция: {result.get("position", "?")})')
                logger.info(f'[SR] User {ctx.author.name} added video to queue: {url}')
            else:
                error_msg = result.get('error', 'Неизвестная ошибка')
                await ctx.send(f'❌ Ошибка добавления видео: {error_msg}')
                logger.error(f'[SR] Failed to add video: {error_msg}')
                
        except Exception as e:
            logger.error(f'Error in sr command: {e}')
            await ctx.send('❌ Произошла ошибка при добавлении видео')