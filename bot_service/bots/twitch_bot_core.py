# bot_service/bots/twitch_bot_core.py
"""Основной класс Twitch бота"""
import logging
from typing import List, Optional
from twitchio.ext import commands
from core.connection_manager import ConnectionManager
from services.tts.tts_core import TTSAPI
from services.youtube.youtube_service import YouTubeService

# Настройка логирования для TwitchIO
logging.getLogger('twitchio').setLevel(logging.INFO)
logging.getLogger('twitchio.websocket').setLevel(logging.INFO)
logging.getLogger('twitchio.client').setLevel(logging.INFO)

logger = logging.getLogger('bot_service')

class TwitchBotCore(commands.Bot):
    """Основной класс Twitch бота"""

    def __init__(self, token: str, initial_channels: List[str], connection_manager: ConnectionManager):
        logger.info("[BOT] CREATING TWITCH BOT")
        logger.info("[INFO] Token: [CENSORED]")
        logger.info(f"[CHANNELS] Initial channels: {initial_channels}")
        logger.info(f"[DEBUG] Token length: {len(token)}")
        logger.info(f"[DEBUG] Number of channels: {len(initial_channels)}")

        self.connection_manager = connection_manager
        self.tts_api = TTSAPI()
        # self.youtube_api is deprecated, use services.youtube.youtube_service if needed
        # Initializing service here if needed, or in specific handlers
        from services.youtube.youtube_service import YouTubeService
        self.youtube_service = YouTubeService()

        logger.info("[WRENCH] Initializing TwitchIO Bot...")
        logger.info(f"[DEBUG] Calling super().__init__ with token and {len(initial_channels)} channels")
        super().__init__(
            token=token,
            prefix='!',
            initial_channels=initial_channels
        )
        logger.info("[OK] TwitchIO Bot initialized")
        logger.info(f"[DEBUG] Bot nick: {getattr(self, 'nick', 'NOT SET')}")
        logger.info(f"[DEBUG] Bot user_id: {getattr(self, 'user_id', 'NOT SET')}")

    async def event_ready(self):
        """Вызывается когда бот готов к работе"""
        logger.info('=' * 80)
        logger.info('[BOT] TWITCH BOT READY!')
        logger.info('=' * 80)
        logger.info(f'[INFO] Bot logged in as: {self.nick}')
        logger.info(f'[ID] Bot user id: {self.user_id}')
        logger.info(f'[CHANNELS] Connected to channels: {self.connected_channels}')
        logger.info('[BOT] BOT IS NOW LISTENING FOR MESSAGES IN ALL CHANNELS!')
        logger.info('[BOT] BOT IS NOW LISTENING FOR MESSAGES IN THESE CHANNELS')

        for channel in self.connected_channels:
            logger.info(f'[OK] MONITORING CHAT: {channel.name}')
        
        logger.info('=' * 80)

    async def event_message(self, message):
        """Обработка входящих сообщений"""
        # Пропускаем сообщения бота
        if message.echo:
            logger.debug(f"[SKIP] Bot message: {message.content}")
            return


        # Логируем сообщение
        logger.info(f'[CHAT] [TWITCH CHAT] {message.channel.name}: {message.author.name}: {message.content}')

        # Отправляем сообщение в chatbox через WebSocket
        try:
            from utils.websocket_helper import broadcast_chat_message

            # Парсим роли и значки из Twitch tags
            role = None
            badges_list = []

            # Проверяем роль (broadcaster > moderator > vip > subscriber)
            if message.author.is_broadcaster:
                role = 'broadcaster'
            elif message.author.is_mod:
                role = 'moderator'
            elif hasattr(message.author, 'is_vip') and message.author.is_vip:
                role = 'vip'
            elif message.author.is_subscriber:
                role = 'subscriber'

            # Парсим badges из tags (если доступны)
            if hasattr(message, 'tags') and message.tags:
                logger.info(f"[LIST] [DEBUG] Message has tags: {list(message.tags.keys())}")
                if 'badges' in message.tags:
                    # Формат: "broadcaster/1,subscriber/12"
                    badges_str = message.tags.get('badges', '')
                    logger.info(f"[BADGES RAW] {message.author.name}: '{badges_str}'")
                    if badges_str:
                        badges_list = badges_str.split(',')
                        logger.info(f"[BADGES PARSED] {message.author.name}: {badges_list}")
                else:
                    logger.warning(f"[WARN] [BADGES] 'badges' not in tags for {message.author.name}")
            else:
                logger.warning(f"[WARN] [BADGES] No tags attribute or empty tags for {message.author.name}")

            logger.debug(f"[ROLE] {message.author.name}: role={role}, badges={badges_list}")

            # Отправляем в chatbox
            await broadcast_chat_message(
                username=message.author.name,
                content=message.content,
                platform='twitch',
                channel=message.channel.name,
                role=role,
                badges=badges_list if badges_list else None
            )

            # [OK] НОВОЕ: Увеличиваем счетчик сообщений для стриков (только если стрик включен)
            try:
                from services.drops.drops_service import DropsService
                from core.database import get_db
                from repositories.user_repository import UserRepository

                # Ищем user_id владельца канала по имени канала
                db = next(get_db())
                try:
                    user_repo = UserRepository(db)
                    channel_owner = user_repo.get_by_twitch_username(message.channel.name)

                    if channel_owner:
                        drops_service = DropsService(db)
                        # [OK] Проверяем включен ли стрик для Twitch
                        config = drops_service.get_config(
                            user_id=channel_owner.id,
                            session_id=None,
                            channel_name=message.channel.name.lower(),
                            platform=None  # Общий конфиг
                        )

                        # Проверяем включен ли стрик для Twitch
                        streak_enabled = False
                        if config:
                            streak_enabled = getattr(config, 'streak_enabled_twitch', False)

                        # Увеличиваем счетчик только если стрик включен
                        if streak_enabled:
                            drops_service.increment_viewer_message_count(
                                user_id=channel_owner.id,
                                channel_name=message.channel.name.lower(),
                                platform="twitch",
                                viewer_id=str(message.author.id) if hasattr(message.author, 'id') else message.author.name.lower(),
                                viewer_name=message.author.name
                            )
                finally:
                    db.close()
            except Exception as streak_err:
                logger.debug(f"Could not increment streak message count: {streak_err}")

            # NOTE: TTS обрабатывается в twitch_bot.py::_handle_tts()
            # Не дублируем вызов здесь!

        except Exception as e:
            logger.error(f'[ERROR] [ERROR] Failed to process chat message: {e}')
            import traceback
            logger.error(traceback.format_exc())

        # Обрабатываем команды
        await self.handle_commands(message)

    async def event_channel_joined(self, channel):
        """Вызывается при подключении к каналу"""
        logger.info(f'[JOIN] Joined channel: {channel.name}')

    async def event_channel_left(self, channel):
        """Вызывается при отключении от канала"""
        logger.info(f'[LEFT] Left channel: {channel.name}')

    async def event_error(self, error):
        """Обработка ошибок"""
        logger.error(f'[ERROR] Twitch bot error: {error}')

    def get_channel_info(self, channel_name: str) -> Optional[dict]:
        """Получить информацию о канале"""
        for channel in self.connected_channels:
            if channel.name.lower() == channel_name.lower():
                return {
                    'name': channel.name,
                    'id': getattr(channel, 'id', None),
                    'connected': True
                }
        return None

    def is_connected_to_channel(self, channel_name: str) -> bool:
        """Проверить подключение к каналу"""
        return any(channel.name.lower() == channel_name.lower()
                  for channel in self.connected_channels)

    async def join_channel(self, channel_name: str):
        """Подключиться к каналу"""
        try:
            await self.join_channels([channel_name])
            logger.info(f'[JOIN] Joined channel: {channel_name}')
            return True
        except Exception as e:
            logger.error(f'[ERROR] Failed to join channel {channel_name}: {e}')
            return False

    async def leave_channel(self, channel_name: str):
        """Отключиться от канала"""
        try:
            await self.part_channels([channel_name])
            logger.info(f'[LEFT] Left channel: {channel_name}')
            return True
        except Exception as e:
            logger.error(f'[ERROR] Failed to leave channel {channel_name}: {e}')
            return False

    def get_connected_channels_list(self) -> List[str]:
        """Получить список подключенных каналов"""
        return [channel.name for channel in self.connected_channels]
