# bot_service/bots/twitch_bot.py
"""Главный файл Twitch бота - объединяет все модули"""
import logging
import json
from datetime import datetime
from typing import List
from twitchio.ext import commands
from core.connection_manager import ConnectionManager
from utils.role_checker import RoleChecker
from .twitch_bot_core import TwitchBotCore
from .twitch_bot_commands import TwitchBotCommands
from .universal_command_handler import UniversalCommandHandler
from api.tts_api import TTSAPI
from api.youtube_api import YouTubeAPI
from services.drops_service import DropsService

logger = logging.getLogger('bot_service')

class Bot(TwitchBotCore):
    """Главный класс Twitch бота"""
    
    def __init__(self, token: str, initial_channels: List[str], connection_manager: ConnectionManager):
        super().__init__(token, initial_channels, connection_manager)
        
        # Инициализируем сервисы
        self.tts_api = TTSAPI()
        self.youtube_api = YouTubeAPI()
        self.role_checker = RoleChecker()
        self.drops_service = None  # Будет инициализирован при подключении к каналу
        
        # Инициализируем команды (старая система для обратной совместимости)
        self.commands_handler = TwitchBotCommands(
            self, 
            self.tts_api, 
            self.youtube_api, 
            self.role_checker
        )
        
        # Новая универсальная система команд
        self.universal_command_handler = UniversalCommandHandler()
        
        logger.info("[BOT] Commands handlers initialized (legacy + universal)")
        logger.info("[BOT] Twitch bot initialized with all modules")

    # Команды бота - обертки, которые TwitchIO может обнаружить
    @commands.command(name='tts')
    async def tts_command(self, ctx, *, text: str = None):
        """Команда TTS синтеза"""
        await self.commands_handler.tts_command(ctx, text=text)

    @commands.command(name='sr')
    async def song_request_command(self, ctx, *, url: str = None):
        """Команда Song Request"""
        logger.info(f"🎵 [SR COMMAND] Called for user {ctx.author.name} with URL: {url}")
        try:
            # ✅ Вызываем обычный метод из commands_handler (без повторного декоратора)
            await self.commands_handler.song_request_command(ctx, url=url)
        except Exception as e:
            logger.error(f"❌ [SR COMMAND] Error: {e}")
            import traceback
            logger.error(f"❌ [SR COMMAND] Traceback: {traceback.format_exc()}")

    @commands.command(name='addcommand')
    async def addcommand(self, ctx, command_name: str = None, *, response: str = None):
        """Добавить кастомную команду"""
        await self.commands_handler.addcommand(ctx, command_name, response=response)

    @commands.command(name='delcommand')
    async def del_command(self, ctx, command_name: str = None):
        """Удалить кастомную команду"""
        await self.commands_handler.del_command(ctx, command_name)

    async def event_ready(self):
        """Вызывается когда бот готов к работе"""
        await super().event_ready()
        logger.info("[BOT] All modules loaded and ready!")

    async def event_message(self, message):
        """Обработка входящих сообщений"""
        # Вызываем родительский класс для базовой обработки
        # (трансляция в WebSocket, логирование, etc.)
        await super().event_message(message)
        
        # Пропускаем эхо-сообщения бота
        if message.echo:
            return
        
        # Проверка гостевого кода (если это 6 цифр)
        if message.content.strip().isdigit() and len(message.content.strip()) == 6:
            logger.info(f"🔍 [GUEST] Detected 6-digit code: {message.content.strip()}")
            from api.guest_api import confirm_guest_code
            confirm_guest_code(
                channel_name=message.channel.name.lower(),
                code=message.content.strip(),
                username=message.author.name.lower(),
                is_owner=(message.author.name.lower() == message.channel.name.lower()) or message.author.is_broadcaster
            )
            return  # Не обрабатываем TTS для кодов верификации
        
        # Проверка команды (универсальная система)
        if message.content.strip().startswith('!'):
            # Создаем ctx-совместимый объект для universal_command_handler
            class SimpleContext:
                def __init__(self, msg, bot):
                    self.message = msg
                    self.author = msg.author
                    self.channel = msg.channel
                    self.bot = bot
                
                async def send(self, content):
                    await self.channel.send(content)
            
            ctx = SimpleContext(message, self)
            await self.universal_command_handler.handle_twitch_command(ctx, self)
            return  # Не обрабатываем TTS для команд
        
        # Обработка TTS для всех сообщений (родитель уже трансляет сообщение)
        await self._handle_tts(message)
        
        # Обработка Drops для стриков
        await self._handle_drops(message)

    async def _handle_tts(self, message):
        """Обработка TTS для сообщений из Twitch"""
        from utils.websocket_helper import handle_tts_for_message
        
        await handle_tts_for_message(
            text=message.content,
            username=message.author.name.lower(),
            channel_identifier=message.channel.name.lower(),
            platform='twitch',
            tts_api=self.tts_api,
            connection_manager=self.connection_manager,
            skip_if_command=True
        )

    async def _handle_drops(self, message):
        """Обработка Drops для сообщений из Twitch"""
        try:
            # Инициализируем DropsService если еще не инициализирован
            if not self.drops_service:
                from core.database import get_db
                db = next(get_db())
                self.drops_service = DropsService(db)
            
            # Получаем информацию о пользователе
            user_id = self._get_user_id_for_channel(message.channel.name)
            if not user_id:
                return
            
            # Обрабатываем стрик Drops
            result = self.drops_service.process_streak_drops(
                user_id=user_id,
                channel_name=message.channel.name,
                platform='twitch',
                viewer_id=message.author.id,
                viewer_name=message.author.name
            )
            
            if result:
                logger.info(f"🎁 [DROPS] {result['viewer_name']} получил {result['reward']} ({result['quality']})")
                
                # Отправляем событие в WebSocket для OBS виджета
                from utils.websocket_helper import broadcast_drops_event
                await broadcast_drops_event(result)
                
        except Exception as e:
            logger.error(f"Error handling drops: {e}")
    
    def _get_user_id_for_channel(self, channel_name: str) -> int:
        """Получает user_id для канала"""
        try:
            from core.database import get_db
            from core.database import User, UserToken
            
            db = next(get_db())
            
            # Ищем пользователя по Twitch username (case-insensitive)
            from sqlalchemy import func
            user = db.query(User).filter(
                func.lower(User.twitch_username) == channel_name.lower()
            ).first()
            
            if user:
                return user.id
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user_id for channel {channel_name}: {e}")
            return None

    async def event_channel_joined(self, channel):
        """Вызывается при подключении к каналу"""
        await super().event_channel_joined(channel)
        
        # Уведомляем connection_manager
        self.connection_manager.add_active_session(
            channel.name, 
            f"twitch_{channel.name}",
            "twitch"
        )

    async def event_channel_left(self, channel):
        """Вызывается при отключении от канала"""
        await super().event_channel_left(channel)
        
        # Уведомляем connection_manager
        self.connection_manager.remove_active_session(
            channel.name, 
            "twitch_disconnect"
        )

    async def event_error(self, error):
        """Обработка ошибок"""
        await super().event_error(error)
        logger.error(f"[ERROR] Twitch bot error: {error}")

    def get_stats(self) -> dict:
        """Получить статистику бота"""
        return {
            "connected_channels": len(self.connected_channels),
            "channels": [ch.name for ch in self.connected_channels],
            "is_ready": hasattr(self, 'user_id') and self.user_id is not None,
            "nick": getattr(self, 'nick', 'Unknown')
        }

    async def shutdown(self):
        """Корректное завершение работы бота"""
        try:
            logger.info("[BOT] Shutting down Twitch bot...")
            
            # Отключаемся от всех каналов
            if self.connected_channels:
                await self.part_channels([ch.name for ch in self.connected_channels])
            
            logger.info("[BOT] Twitch bot shutdown complete")
        except Exception as e:
            logger.error(f"[ERROR] Error during bot shutdown: {e}")