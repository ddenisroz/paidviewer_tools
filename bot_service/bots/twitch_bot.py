# bot_service/bots/twitch_bot.py
"""Главный файл Twitch бота - объединяет все модули"""
import logging
from typing import List
from core.connection_manager import ConnectionManager
from utils.role_checker import RoleChecker
from .twitch_bot_core import TwitchBotCore
from .universal_command_handler import UniversalCommandHandler
from services.tts.tts_core import TTSAPI
from services.youtube.youtube_service import YouTubeService
from services.drops.drops_service import DropsService

logger = logging.getLogger('bot_service')

class Bot(TwitchBotCore):
    """Главный класс Twitch бота"""
    
    def __init__(self, token: str, initial_channels: List[str], connection_manager: ConnectionManager):
        super().__init__(token, initial_channels, connection_manager)
        
        # Инициализируем сервисы
        self.tts_api = TTSAPI()
        self.youtube_service = YouTubeService()
        self.role_checker = RoleChecker()
        self.drops_service = None  # Будет инициализирован при подключении к каналу
        
        # Универсальная система команд (для всех платформ)
        self.universal_command_handler = UniversalCommandHandler()
        
        logger.info("[BOT] Universal command handler initialized")
        logger.info("[BOT] Twitch bot initialized with all modules")

    async def event_ready(self):
        """Вызывается когда бот готов к работе"""
        await super().event_ready()
        logger.info("[BOT] All modules loaded and ready!")
    
    async def send_welcome_message(self, channel_name: str):
        """
        Отправить приветственное сообщение в канал
        Вызывается только после OAuth авторизации/переподключения
        """
        try:
            # Находим объект канала
            channel = None
            for ch in self.connected_channels:
                if ch.name.lower() == channel_name.lower():
                    channel = ch
                    break
            
            if not channel:
                logger.warning(f"[WARN] [BOT] Channel {channel_name} not found in connected_channels")
                return
            
            # Проверяем в БД, не отправляли ли приветствие недавно
            from core.database import SessionLocal
            from repositories.user_settings_repository import UserSettingsRepository
            from datetime import timedelta
            from core.datetime_utils import utcnow_naive
            
            db = SessionLocal()
            try:
                settings_repo = UserSettingsRepository(db)
                settings = settings_repo.get_by_channel_name(channel_name)
                
                if settings and settings.bot_last_welcome_at:
                    time_diff = utcnow_naive() - settings.bot_last_welcome_at
                    if time_diff < timedelta(minutes=5):
                        logger.debug(f"🔇 [BOT] Welcome message sent {int(time_diff.total_seconds())}s ago, skipping")
                        return
                
                # Отправляем приветствие
                import random
                fake_ip = f"{random.randint(100, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}"
                await channel.send(f"Подключено к {channel.name}. streamer IP: {fake_ip} | Используйте !help для списка команд")
                
                # Обновляем время в БД
                if settings:
                    settings.bot_last_welcome_at = utcnow_naive()
                    db.commit()
                
                logger.info(f"[OK] [BOT] Welcome message sent to {channel.name} with fake IP: {fake_ip}")
                
            except Exception as e:
                logger.error(f"[ERROR] [BOT] Failed to send welcome message: {e}")
                await self._handle_ban_error(channel_name, e)
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"[ERROR] [BOT] Error in send_welcome_message: {e}")
    
    async def event_join(self, channel, user):
        """Вызывается когда кто-то присоединяется к каналу (включая самого бота)"""
        # Вызываем родительский метод
        await super().event_join(channel, user)
        
        # Welcome message теперь отправляется только при OAuth подключении
        # См. send_welcome_message() - вызывается из oauth_handler после авторизации
        if user.name.lower() == self.nick.lower():
            logger.info(f"[OK] [BOT] Joined channel {channel.name} (welcome message via OAuth only)")
    
    async def _handle_ban_error(self, channel_name: str, error: Exception):
        """Обработка ошибок, связанных с баном бота"""
        error_str = str(error).lower()
        
        # Проверяем признаки бана
        ban_indicators = ['banned', 'timed out', 'msg_banned', 'msg_timeout', 'forbidden', '403']
        is_banned = any(indicator in error_str for indicator in ban_indicators)
        
        if is_banned:
            logger.warning(f"🚫 [BOT BAN] Bot appears to be banned/timed out in channel: {channel_name}")
            await self._disconnect_and_cleanup(channel_name, "ban_detected")
    
    async def _disconnect_and_cleanup(self, channel_name: str, reason: str = "ban"):
        """Отключиться от канала и удалить токены"""
        try:
            logger.warning(f"[CONNECT] [DISCONNECT] Disconnecting from {channel_name} due to: {reason}")
            
            # Получаем user_id из БД по имени канала
            from core.database import SessionLocal
            from repositories.user_repository import UserRepository
            
            db = SessionLocal()
            try:
                user_repo = UserRepository(db)
                user = user_repo.get_by_twitch_username(channel_name)
                
                if user:
                    logger.info(f"[DELETE] [CLEANUP] Found user {user.id} for channel {channel_name}")
                    
                    # Удаляем токены
                    from core.session_manager import session_manager
                    session_manager.remove_platform_token(user.id, 'twitch')
                    logger.info(f"[OK] [CLEANUP] Twitch tokens removed for user {user.id}")
                    
                    # Отключаем TTS
                    self.connection_manager.disable_tts_for_channel(channel_name.lower())
                    logger.info(f"[OK] [CLEANUP] TTS disabled for {channel_name}")
                    
                    # Завершаем сессии с причиной бана
                    session_manager.terminate_user_sessions(user.id, f"bot_{reason}", db)
                    logger.info(f"[OK] [CLEANUP] Sessions terminated for user {user.id}")
                else:
                    logger.warning(f"[WARN] [CLEANUP] User not found for channel {channel_name}")
            finally:
                db.close()
            
            # Покидаем канал
            try:
                await self.part_channels([channel_name])
                logger.info(f"[OK] [DISCONNECT] Bot left channel: {channel_name}")
            except Exception as e:
                logger.error(f"[ERROR] [DISCONNECT] Error leaving channel {channel_name}: {e}")
                
        except Exception as e:
            logger.error(f"[ERROR] [CLEANUP] Error during disconnect and cleanup for {channel_name}: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def event_raw_data(self, data: str):
        """Обработка raw IRC данных для отлова банов"""
        try:
            # Проверяем что data - строка
            if not isinstance(data, str):
                return
            
            # Отлавливаем CLEARCHAT для бана бота
            if 'CLEARCHAT' in data:
                parts = data.split(' ')
                if len(parts) >= 4:
                    channel = parts[3].replace('#', '').strip()
                    # Проверяем если забанен именно наш бот
                    if f':{self.nick}' in data.lower():
                        logger.warning(f"🚫 [BOT BAN] Bot banned/timed out in channel: {channel}")
                        await self._disconnect_and_cleanup(channel, "ban_detected")
        except Exception as e:
            logger.error(f"Error processing raw data for ban detection: {e}")
            import traceback
            logger.debug(traceback.format_exc())
    
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
            logger.info(f"[DEBUG] [GUEST] Detected 6-digit code: {message.content.strip()}")
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
    
    async def handle_commands(self, message):
        """Переопределяем handle_commands чтобы отключить автоматическую обработку TwitchIO"""
        # Команды обрабатываются в event_message через UniversalCommandHandler
        # Не вызываем super().handle_commands()
        pass

    async def _handle_tts(self, message):
        """Обработка TTS для сообщений из Twitch"""
        from utils.websocket_helper import handle_tts_for_message
        
        # Извлекаем reward_id из IRC tags если сообщение отправлено с наградой
        reward_id = None
        if hasattr(message, 'tags') and message.tags:
            reward_id = message.tags.get('custom-reward-id')
            if reward_id:
                logger.info(f"[REWARD] [TWITCH MSG] Message from Channel Points reward: {reward_id}")
        
        await handle_tts_for_message(
            text=message.content,
            username=message.author.name.lower(),
            channel_identifier=message.channel.name.lower(),
            platform='twitch',
            tts_api=self.tts_api,
            connection_manager=self.connection_manager,
            skip_if_command=True,
            reward_id=reward_id
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
                logger.info(f"[REWARD] [DROPS] {result['viewer_name']} получил {result['reward']} ({result['quality']})")
                
                # Отправляем событие в WebSocket для OBS виджета
                from utils.websocket_helper import broadcast_drops_event
                await broadcast_drops_event(result)
                
        except Exception as e:
            logger.error(f"Error handling drops: {e}")
    
    def _get_user_id_for_channel(self, channel_name: str) -> int:
        """Получает user_id для канала"""
        try:
            from core.database import get_db
            from repositories.user_repository import UserRepository
            
            db = next(get_db())
            
            # Ищем пользователя по Twitch username (case-insensitive)
            user_repo = UserRepository(db)
            user = user_repo.get_by_twitch_username(channel_name)
            
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