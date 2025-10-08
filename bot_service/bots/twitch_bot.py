# bot_service/bot.py
import os
import logging
import asyncio
import time
from typing import List, Set, Optional
from twitchio.ext import commands
from core.connection_manager import ConnectionManager
from core.database import BotCommand
from api.tts_api import TTSAPI
from api.youtube_api import YouTubeAPI
from utils.role_checker import RoleChecker

# Настройка логирования для TwitchIO
logging.getLogger('twitchio').setLevel(logging.INFO)
logging.getLogger('twitchio.websocket').setLevel(logging.INFO)
logging.getLogger('twitchio.client').setLevel(logging.INFO)

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

            # === ИНТЕГРАЦИЯ С СИСТЕМОЙ ЛУТБОКСОВ ===
            try:
                # from services.lootbox_service import LootboxService  # Временно отключено
                from core.database import get_db
                
                # Получаем сессию БД
                db = next(get_db())
                # lootbox_service = LootboxService(db)  # Временно отключено
                
                # Записываем сообщение для отслеживания активности
                channel_name = message.channel.name.lower()
                author_name = message.author.name.lower()
                
                # Получаем или создаем пользователя
                from core.database import User
                # Для гостевого режима создаем временного пользователя
                user = User()
                db.add(user)
                db.commit()
                db.refresh(user)
                
                # Записываем сообщение в систему лутбоксов
                # lootbox_service.record_chat_message(  # Временно отключено
                #     user_id=user.id,
                #     channel_name=channel_name,
                #     platform="twitch",
                #     message=message.content
                # )
                
                # logger.debug(f"📝 Chat message recorded for lootbox system: {author_name} in {channel_name}")
                
            except Exception as e:
                logger.error(f"Error recording chat message for lootbox system: {e}")
            # === КОНЕЦ ИНТЕГРАЦИИ С ЛУТБОКСАМИ ===
            
            channel_name = getattr(message.channel, 'name', None)
            author_name = getattr(message.author, 'name', None)
            content = getattr(message, 'content', '')
            
            if not channel_name or not author_name:
                logger.debug(f"Message missing channel name or author name: channel={channel_name}, author={author_name}")
                return
            
            # Логируем все входящие сообщения для отладки
            logger.info(f"📨 TWITCH CHAT [{channel_name}] {author_name}: {content}")
            logger.info(f"🎯 BOT IS LISTENING TO TWITCH CHAT - CHANNEL: {channel_name}")
            logger.info(f"🤖 Bot nick: {getattr(self, 'nick', 'NOT_SET')}, Author: {author_name}, Echo: {getattr(message, 'echo', False)}")
            
            
            # Обрабатываем сообщения от бота (ECHO) как сообщения стримера
            if message.echo:
                # Получаем реальное имя стримера из базы данных
                streamer_name = await self._get_streamer_name_by_channel(channel_name)
                
                # Это сообщение от бота - показываем как сообщение от бота (от имени стримера)
                await self.connection_manager.broadcast_chat_message({
                    'type': 'chat_message',
                    'platform': 'twitch',
                    'channel': channel_name,
                    'author_name': streamer_name,  # Отображаем как сообщение от стримера
                    'author': streamer_name,       # Без пометки "(бот)"
                    'username': streamer_name,
                    'message': content,
                    'content': content,
                    'timestamp': time.time(),
                    'role': 'broadcaster',
                    'author_color': '#DAA520',  # Золотой цвет для стримера
                    'is_bot_message': True  # Флаг что это сообщение от бота
                })
                return
            
            # Проверяем, является ли отправитель ботом (по имени бота)
            if hasattr(self, 'nick') and self.nick and author_name.lower() == self.nick.lower():
                # Получаем реальное имя стримера из базы данных
                streamer_name = await self._get_streamer_name_by_channel(channel_name)
                
                # Это сообщение от бота - показываем как сообщение от бота (от имени стримера)
                await self.connection_manager.broadcast_chat_message({
                    'type': 'chat_message',
                    'platform': 'twitch',
                    'channel': channel_name,
                    'author_name': streamer_name,  # Отображаем как сообщение от стримера
                    'author': streamer_name,       # Без пометки "(бот)"
                    'username': streamer_name,
                    'message': content,
                    'content': content,
                    'timestamp': time.time(),
                    'role': 'broadcaster',
                    'author_color': '#DAA520',  # Золотой цвет для стримера
                    'is_bot_message': True  # Флаг что это сообщение от бота
                })
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

        # Передаем сообщение в чат через WebSocket
        await self.connection_manager.broadcast_chat_message({
            'type': 'chat_message',
            'platform': 'twitch',
            'channel': channel_name,
            'author_name': author_name,
            'author': author_name,
            'content': content,
            'message': content,
            'timestamp': time.time(),
            'role': 'normal',
            'author_color': message.author.color or '#ffffff'
        })
        
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
            tts_enabled = self.connection_manager.is_tts_enabled(channel_name, 'twitch')
            logger.info(f"🎛️ TTS ENABLED CHECK: Канал '{channel_name}' - {tts_enabled}")
            if not tts_enabled:
                logger.warning(f"❌ TTS НЕ ВКЛЮЧЕН для Twitch канала {channel_name}, пропускаем обработку TTS")
                return
            
            # Проверяем, активен ли владелец канала
            channel_owner_id = await self._get_channel_owner_id(channel_name)
            if channel_owner_id and not self.connection_manager.is_client_active(str(channel_owner_id)):
                logger.info(f"🔇 TTS skipped for {channel_name} - owner {channel_owner_id} is inactive")
                return
            
            # Проверяем whitelist для канала
            whitelisted = self.connection_manager.is_channel_whitelisted(channel_name)
            logger.info(f"📝 WHITELIST CHECK: Канал '{channel_name}' - {whitelisted}")
            if not whitelisted:
                logger.warning(f"❌ WHITELIST: Канал {channel_name} НЕ в whitelist, пропускаем обработку TTS")
                return

            # Проверяем фильтр слов перед озвучкой
            from services.tts_service import TTSService
            from core.database import get_db
            
            db = next(get_db())
            tts_service = TTSService(db)
            
            # Получаем ID владельца канала для проверки фильтра
            channel_owner_id = await self._get_channel_owner_id(channel_name)
            if channel_owner_id:
                is_filtered = await tts_service.check_text_filter(content, int(channel_owner_id), 'twitch')
                if is_filtered:
                    logger.info(f"TTS: Message filtered for channel {channel_name}: '{content}'")
                    return
            
            # Отправляем запрос на озвучку
            text = content
            author = author_name
            
            # Убираем префикс автора из текста, если он есть
            if text.startswith(f"{author} говорит:"):
                text = text.replace(f"{author} говорит:", "").strip()
            
            if text:  # Только если есть текст для озвучки
                # Получаем настройки громкости для канала (общая громкость)
                volume_level = self.connection_manager.get_tts_volume(channel_name)
                
                # Получаем настройки типов TTS для канала
                use_basic_tts = self.connection_manager.is_basic_tts_enabled(channel_name)
                use_ai_tts = self.connection_manager.is_ai_tts_enabled(channel_name)
                
                logger.info(f"🎤 Sending TTS request for Twitch channel {channel_name}: {text[:50]}... (volume: {volume_level}%, basic: {use_basic_tts}, ai: {use_ai_tts})")
                
                # Загружаем настройки для передачи в F5-TTS
                tts_settings = await self._get_tts_settings(channel_name)
                word_filter = await self._get_word_filter()
                blocked_users = await self._get_blocked_users()
                
                # Передаем connection_manager для проверки приоритетных голосов
                result = await self.tts_api.send_tts_request(
                    channel_name, text, author, volume_level, self.connection_manager,
                    use_ai_tts=use_ai_tts,
                    use_basic_tts=use_basic_tts,
                    tts_settings=tts_settings,
                    word_filter=word_filter,
                    blocked_users=blocked_users
                )
                
                if result.get("success"):
                    logger.debug(f"TTS synthesis successful: voice={result.get('voice')}, volume={result.get('volume')}%")
                else:
                    logger.error(f"TTS synthesis failed: {result.get('error')}")
        except Exception as e:
            logger.error(f"Error in handle_tts_message: {e}")
    
    async def _get_tts_settings(self, channel_name: str) -> dict:
        """Загрузить настройки TTS для канала"""
        try:
            # Здесь можно добавить загрузку из БД или кэша
            # Пока возвращаем настройки по умолчанию
            return {
                "enable7TV": True,
                "enableTwitch": True,
                "enableProfanity": False,
                "profanityLevel": "medium"
            }
        except Exception as e:
            logger.error(f"Error loading TTS settings: {e}")
            return {}
    
    async def _get_word_filter(self) -> list:
        """Загрузить фильтр слов"""
        try:
            # Здесь можно добавить загрузку из БД
            # Пока возвращаем пустой список
            return []
        except Exception as e:
            logger.error(f"Error loading word filter: {e}")
            return []
    
    async def _get_blocked_users(self) -> list:
        """Загрузить список заблокированных пользователей"""
        try:
            # Здесь можно добавить загрузку из БД
            # Пока возвращаем пустой список
            return []
        except Exception as e:
            logger.error(f"Error loading blocked users: {e}")
            return []

    async def handle_commands(self, message):
        """Обработка команд из базы данных"""
        try:
            if not message or not message.channel or not message.author:
                logger.debug("handle_commands: Skipping message without author")
                return
                
            channel_name = getattr(message.channel, 'name', None)
            author_name = getattr(message.author, 'name', None)
            user_id = getattr(message.author, 'id', None)
            content = getattr(message, 'content', '')
            
            if not channel_name or not author_name or not user_id or not content:
                return
            
            # Проверяем, является ли сообщение командой
            if not content.startswith('!'):
                logger.debug(f"handle_commands: Message doesn't start with !: {content}")
                return
            
            logger.info(f"🎯 COMMAND DETECTED: {content} from {author_name} in {channel_name}")
            
            # Извлекаем название команды
            command_name = content.split()[0][1:].lower()  # Убираем ! и приводим к нижнему регистру
            
            # Получаем команды из базы данных
            from core.database import get_db, UserToken
            db_gen = get_db()
            db = next(db_gen)
            
            try:
                # Находим user_id по platform_user_id (Twitch ID)
                user_token = db.query(UserToken).filter(
                    UserToken.platform == 'twitch',
                    UserToken.platform_user_id == str(user_id)
                ).first()
                
                if not user_token:
                    logger.warning(f"User token not found for Twitch ID: {user_id}")
                    return
                
                internal_user_id = user_token.user_id
                
                # Ищем команду в базе данных по user_id
                command = db.query(BotCommand).filter(
                    BotCommand.user_id == internal_user_id,
                    BotCommand.command_name == command_name,
                    BotCommand.is_enabled == True
                ).first()
                
                if not command:
                    # Если команда не найдена, создаем базовую команду
                    command = await self._create_basic_command(db, channel_name, command_name, internal_user_id)
                    if not command:
                        return  # Не удалось создать команду
                
                # Проверяем платформу
                if 'twitch' not in command.platforms.split(','):
                    return  # Команда не для Twitch
                
                # Получаем ID владельца канала
                channel_owner_id = None
                try:
                    # Получаем информацию о канале из базы данных
                    # Ищем пользователя по platform_user_id через Twitch API
                    channel_user = None
                    try:
                        from api.twitch_api import TwitchAPI
                        twitch_api = TwitchAPI(self.connection_manager)
                        user_info = await twitch_api.get_user_by_username(channel_name, await twitch_api.get_app_access_token())
                        if user_info:
                            channel_user = db.query(UserToken).filter(
                                UserToken.platform == 'twitch',
                                UserToken.platform_user_id == user_info.get('id')
                            ).first()
                    except Exception as e:
                        logger.error(f"Error getting user info for {channel_name}: {e}")
                    if channel_user:
                        channel_owner_id = str(channel_user.platform_user_id)
                except Exception as e:
                    logger.error(f"Error getting channel owner ID: {e}")
                
                # Получаем роли пользователя
                user_badges = getattr(message.author, 'badges', [])
                user_roles = RoleChecker.check_twitch_role(
                    user_badges, 
                    str(message.author.id), 
                    channel_owner_id or str(message.channel.name)
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

    async def _create_basic_command(self, db, channel_name: str, command_name: str, internal_user_id: int):
        """Создает базовую команду если её нет в базе данных"""
        try:
            from datetime import datetime
            
            # Определяем настройки для базовых команд
            basic_commands_config = {
                'sr': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'all',
                    'cooldown_seconds': 0
                },
                'tts': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'all',
                    'cooldown_seconds': 0
                },
                'queue': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'all',
                    'cooldown_seconds': 0
                },
                'next': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'all',
                    'cooldown_seconds': 0
                },
                'clear': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'broadcaster,moderator',
                    'cooldown_seconds': 0
                },
                'help': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'all',
                    'cooldown_seconds': 0
                },
                'voice': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'all',
                    'cooldown_seconds': 5
                },
                'ttsvolume': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'broadcaster,moderator',
                    'cooldown_seconds': 5
                },
                'youtubevolume': {
                    'command_type': 'basic',
                    'response_text': None,
                    'is_enabled': True,
                    'platforms': 'twitch,vk',
                    'allowed_roles': 'broadcaster,moderator',
                    'cooldown_seconds': 5
                }
            }
            
            # Проверяем, является ли это базовой командой
            if command_name not in basic_commands_config:
                logger.warning(f"Unknown command: {command_name}")
                return None
            
            config = basic_commands_config[command_name]
            
            # Создаем команду
            command = BotCommand(
                user_id=internal_user_id,
                channel_name=channel_name,
                command_name=command_name,
                command_type=config['command_type'],
                response_text=config['response_text'],
                is_enabled=config['is_enabled'],
                platforms=config['platforms'],
                allowed_roles=config['allowed_roles'],
                cooldown_seconds=config['cooldown_seconds'],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(command)
            db.commit()
            
            logger.info(f"Created basic command '{command_name}' for channel '{channel_name}'")
            return command
            
        except Exception as e:
            logger.error(f"Error creating basic command '{command_name}': {e}")
            db.rollback()
            return None

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
            elif command_name == 'voice':
                await self.voice_command_from_message(message)
            elif command_name == 'ttsvolume':
                await self.tts_volume_command_from_message(message)
            elif command_name == 'youtubevolume':
                await self.youtube_volume_command_from_message(message)
            elif command_name == 'category':
                await self.category_command_from_message(message)
            elif command_name == 'title':
                await self.title_command_from_message(message)
            elif command_name == 'about':
                await self.about_command_from_message(message)
            elif command_name == 'lootbox':
                await self.lootbox_command_from_message(message)
            elif command_name == 'open':
                # Обработка команды !open <id>
                parts = message.content.split()
                if len(parts) > 1:
                    try:
                        lootbox_id = int(parts[1])
                        await self.open_lootbox_command_from_message(message, lootbox_id)
                    except ValueError:
                        await message.channel.send("❌ ID лутбокса должен быть числом")
                else:
                    await message.channel.send("❌ Укажите ID лутбокса: !open <id>")
            # Добавьте другие базовые команды по необходимости
        except Exception as e:
            logger.error(f"Error in handle_basic_command: {e}")

    @commands.command(name='tts')
    async def toggle_tts(self, ctx):
        """Команда для переключения TTS для Twitch"""
        channel_name = ctx.channel.name.lower()
        
        # Проверяем whitelist
        if not self.connection_manager.is_channel_whitelisted(channel_name):
            await ctx.send("❌ Канал не в белом списке для использования TTS")
            return
        
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
            # Попытаемся найти пользователя по имени канала
            from core.database import User
            db_temp = next(get_db())
            try:
                channel_owner = db_temp.query(User).filter(User.twitch_username == ctx.channel.name.lower()).first()
                if channel_owner:
                    channel_owner_id = channel_owner.id
                else:
                    # Если пользователь не найден, используем временное решение
                    channel_owner_id = 1
                    logger.warning(f"Channel owner not found for {ctx.channel.name}, using default user_id=1")
            except Exception as e:
                logger.error(f"Error finding channel owner: {e}")
                channel_owner_id = 1
            finally:
                db_temp.close()
            
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
!voice <номер> - Выбрать голос для TTS
!voice random - Выбрать случайный голос
!queue - Показать очередь видео
!next - Следующее видео
!clear - Очистить очередь
!sr <url> - Добавить видео в очередь
!help - Показать это сообщение
        """
        await ctx.send(help_text)

    # Функции для работы с сообщениями (не ctx)
    async def toggle_tts_from_message(self, message):
        """Команда для переключения TTS для Twitch (из сообщения)"""
        channel_name = message.channel.name.lower()
        user_name = message.author.name
        
        # Проверяем whitelist
        if not self.connection_manager.is_channel_whitelisted(channel_name):
            await message.channel.send("❌ Канал не в белом списке для использования TTS")
            return
        
        
        # Обычное переключение TTS
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
            from core.database import get_db, User, UserToken
            
            # Получаем информацию о пользователе
            user_name = message.author.name
            channel_name = message.channel.name.lower()
            
            # Находим владельца канала в базе данных
            db = next(get_db())
            result = None
            try:
                # Ищем пользователя по Twitch токену, который владеет этим каналом
                # Ищем пользователя по platform_user_id через Twitch API
                user_token = None
                try:
                    from api.twitch_api import TwitchAPI
                    twitch_api = TwitchAPI(self.connection_manager)
                    user_info = await twitch_api.get_user_by_username(channel_name, await twitch_api.get_app_access_token())
                    if user_info:
                        user_token = db.query(UserToken).filter(
                            UserToken.platform == 'twitch',
                            UserToken.platform_user_id == user_info.get('id')
                        ).first()
                except Exception as e:
                    logger.error(f"Error getting user info for {channel_name}: {e}")
                
                if not user_token:
                    await message.channel.send("❌ Канал не найден в системе")
                    return
                
                user_id = user_token.user_id
                logger.info(f"Found user ID {user_id} for channel {channel_name}")
                
                # Добавляем видео в очередь через сервис
                queue_service = QueueService(connection_manager=self.connection_manager)
                result = await queue_service.add_video_to_queue(
                    user_id=user_id, 
                    video_url=url, 
                    channel_name=channel_name,
                    platform='twitch',
                    requester_name=user_name,
                    requester_id=str(message.author.id),
                    db=db
                )
            finally:
                db.close()
            
            if result and result['success']:
                video_info = result['video_info']
                await message.channel.send(f"✅ {user_name} добавил в очередь: {video_info['title']}")
                
                # Отправляем событие обновления очереди
                await self.connection_manager.send_youtube_event_to_user(
                    user_id=str(user_id),
                    event_type="queue_updated",
                    data={"action": "video_added", "video": video_info}
                )
            elif result:
                await message.channel.send(f"❌ Ошибка добавления видео: {result['error']}")
                
        except Exception as e:
            logger.error(f"Error in song_request_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при добавлении видео")

    async def help_command_from_message(self, message):
        """Показать список команд (из сообщения)"""
        help_text = """
🤖 Доступные команды:
!tts - Включить/выключить TTS
!voice <номер> - Выбрать голос для TTS
!voice random - Выбрать случайный голос
!queue - Показать очередь видео
!next - Следующее видео
!clear - Очистить очередь
!sr <url> - Добавить видео в очередь
!help - Показать это сообщение
        """
        await message.channel.send(help_text)

    async def voice_command_from_message(self, message):
        """Выбор голоса для TTS (из сообщения)"""
        try:
            parts = message.content.split()
            if len(parts) < 2:
                await message.channel.send("❌ Укажите номер голоса или 'random': !voice <номер> или !voice random")
                return
            
            user_name = message.author.name
            channel_name = message.channel.name.lower()
            
            # Проверяем, если это команда !voice random
            if parts[1].lower() == 'random':
                from api.tts_api import TTSAPI
                tts_api = TTSAPI()
                
                result = await tts_api.get_random_voice(channel_name)
                if result.get('success'):
                    voice_number = result.get('voice_number')
                    await message.channel.send(f"🎲 {user_name} выбрал случайный голос #{voice_number}")
                else:
                    await message.channel.send(f"❌ Ошибка выбора случайного голоса: {result.get('error', 'Неизвестная ошибка')}")
                return
            
            # Обычный выбор голоса по номеру
            try:
                voice_number = int(parts[1])
            except ValueError:
                await message.channel.send("❌ Номер голоса должен быть числом или используйте 'random'")
                return
            
            # Получаем информацию о пользователе
            user_id = str(message.author.id)
            
            # Отправляем запрос на смену голоса
            from api.tts_api import TTSAPI
            tts_api = TTSAPI()
            
            result = await tts_api.set_voice(channel_name, voice_number, user_name)
            
            if result.get('success'):
                await message.channel.send(f"✅ {user_name} изменил голос на #{voice_number}")
            else:
                await message.channel.send(f"❌ Ошибка смены голоса: {result.get('error', 'Неизвестная ошибка')}")
                
        except Exception as e:
            logger.error(f"Error in voice_command_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при смене голоса")

    async def event_channel_joined(self, channel):
        """Вызывается когда бот присоединяется к каналу"""
        logger.info(f'✅ SUCCESSFULLY JOINED CHANNEL: {channel.name}')
        logger.info(f'🎯 BOT IS NOW LISTENING TO CHAT IN: {channel.name}')
        
        # Генерируем фейковый IP адрес для шутки
        fake_ip = self._generate_fake_ip()
        await channel.send(f"/me подключен к пользователю с IP адресом: {fake_ip}")
    
    def _generate_fake_ip(self):
        """Генерирует фейковый IP адрес для шутки"""
        import random
        # Генерируем IP в формате xx.xxx.xx.xx
        octet1 = random.randint(10, 99)
        octet2 = random.randint(100, 999)
        octet3 = random.randint(10, 99)
        octet4 = random.randint(10, 99)
        return f"{octet1}.{octet2}.{octet3}.{octet4}"

    # === КОМАНДЫ ЛУТБОКСОВ ===
    
    async def lootbox_command_from_message(self, message):
        """Обработка команд лутбоксов из сообщения"""
        try:
            parts = message.content.split()
            if len(parts) < 2:
                await message.channel.send("🎰 Доступные команды: !lootbox info, !lootbox open <id>, !lootbox list")
                return
            
            action = parts[1].lower()
            channel_name = message.channel.name.lower()
            author_name = message.author.name.lower()
            
            # Получаем пользователя
            from core.database import User, get_db
            db = next(get_db())
            user = db.query(User).filter(User.username == author_name).first()
            if not user:
                await message.channel.send("❌ Пользователь не найден")
                return
            
            # from services.lootbox_service import LootboxService  # Временно отключено
            # lootbox_service = LootboxService(db)  # Временно отключено
            
            if action == "info":
                # Показываем прогрессию пользователя
                # progression = lootbox_service.get_user_progression(user.id, channel_name)  # Временно отключено
                # if progression:
                #     await message.channel.send(f"📊 Прогрессия {author_name}: {progression['total_days_active']} дней, серия: {progression['current_streak']}, сообщений: {progression['total_messages']}")
                # else:
                #     await message.channel.send(f"📊 Пользователь {author_name} еще не имеет прогрессии")
                await message.channel.send(f"📊 Система лутбоксов временно отключена")
                    
            elif action == "list":
                # Показываем доступные лутбоксы
                # lootboxes = lootbox_service.get_channel_lootboxes(channel_name)  # Временно отключено
                # if lootboxes:  # Временно отключено
                #     lootbox_list = []
                #     for lb in lootboxes:
                #         price_text = f" ({lb['price']}₽)" if lb['type'] == 'paid' else " (Бесплатный)"
                #         lootbox_list.append(f"{lb['name']}{price_text}")
                #     await message.channel.send(f"🎁 Доступные лутбоксы: {', '.join(lootbox_list)}")
                # else:
                #     await message.channel.send("🎁 Лутбоксы пока не настроены")
                await message.channel.send("🎁 Система лутбоксов временно отключена")
                    
            elif action == "open":
                if len(parts) < 3:
                    await message.channel.send("❌ Укажите ID лутбокса: !lootbox open <id>")
                    return
                
                try:
                    lootbox_id = int(parts[2])
                    await self.open_lootbox_command_from_message(message, lootbox_id)
                except ValueError:
                    await message.channel.send("❌ ID лутбокса должен быть числом")
                    
        except Exception as e:
            logger.error(f"Error in lootbox command: {e}")
            await message.channel.send("❌ Ошибка выполнения команды лутбокса")
    
    async def open_lootbox_command_from_message(self, message, lootbox_id: int):
        """Открыть лутбокс по ID"""
        try:
            channel_name = message.channel.name.lower()
            author_name = message.author.name.lower()
            
            # Получаем пользователя
            from core.database import User, get_db
            db = next(get_db())
            user = db.query(User).filter(User.username == author_name).first()
            if not user:
                await message.channel.send("❌ Пользователь не найден")
                return
            
            # from services.lootbox_service import LootboxService  # Временно отключено
            # lootbox_service = LootboxService(db)  # Временно отключено
            
            # Открываем лутбокс
            # result = lootbox_service.open_lootbox(user.id, channel_name, lootbox_id)  # Временно отключено
            # if result:  # Временно отключено
            #     reward = result['reward']
            #     await message.channel.send(f"🎁 {author_name} открыл лутбокс '{result['lootbox_name']}' и получил: {reward['name']}! 🎉")
            #     
            #     # Запускаем OBS анимацию
            #     try:
            #         from services.obs_animation_service import OBSAnimationService
            #         obs_service = OBSAnimationService(self.connection_manager)
            #         await obs_service.trigger_lootbox_animation(channel_name, {
            #             **result,
            #             'user_name': author_name
            #         })
            #     except Exception as e:
            #         logger.error(f"Error triggering OBS animation: {e}")
            # else:
            #     await message.channel.send("❌ Не удалось открыть лутбокс. Проверьте ID или попробуйте позже")
            await message.channel.send("🎁 Система лутбоксов временно отключена")
                
        except Exception as e:
            logger.error(f"Error in open lootbox command: {e}")
            await message.channel.send("❌ Ошибка открытия лутбокса")

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
            if hasattr(self, 'close') and self.close:
                await self.close()
            else:
                logger.info("Bot close method not available or already closed")
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")

    async def tts_volume_command_from_message(self, message):
        """Обработка команды !ttsvolume для Twitch"""
        try:
            parts = message.content.split()
            if len(parts) < 2:
                await message.channel.send("❌ Укажите уровень громкости (0-100): !ttsvolume <0-100>")
                return
            
            try:
                volume = int(parts[1])
                if volume < 0 or volume > 100:
                    await message.channel.send("❌ Громкость должна быть от 0 до 100")
                    return
            except ValueError:
                await message.channel.send("❌ Громкость должна быть числом от 0 до 100")
                return
            
            # Отправляем запрос на изменение громкости TTS
            result = await self.tts_api.set_tts_volume(message.channel.name, volume)
            
            if result.get('success'):
                await message.channel.send(f"🔊 {message.author.name} установил громкость TTS на {volume}%")
            else:
                await message.channel.send(f"❌ Ошибка установки громкости TTS: {result.get('error', 'Неизвестная ошибка')}")
                
        except Exception as e:
            logger.error(f"Error in tts_volume_command_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при установке громкости TTS")

    async def youtube_volume_command_from_message(self, message):
        """Обработка команды !youtubevolume для Twitch"""
        try:
            parts = message.content.split()
            if len(parts) < 2:
                await message.channel.send("❌ Укажите уровень громкости (0-100): !youtubevolume <0-100>")
                return
            
            try:
                volume = int(parts[1])
                if volume < 0 or volume > 100:
                    await message.channel.send("❌ Громкость должна быть от 0 до 100")
                    return
            except ValueError:
                await message.channel.send("❌ Громкость должна быть числом от 0 до 100")
                return
            
            # Отправляем запрос на изменение громкости YouTube
            result = await self.youtube_api.set_volume(message.channel.name, volume)
            
            if result.get('success'):
                await message.channel.send(f"🎵 {message.author.name} установил громкость YouTube на {volume}%")
            else:
                await message.channel.send(f"❌ Ошибка установки громкости YouTube: {result.get('error', 'Неизвестная ошибка')}")
                
        except Exception as e:
            logger.error(f"Error in youtube_volume_command_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при установке громкости YouTube")

    async def category_command_from_message(self, message):
        """Обработка команды !category для Twitch"""
        try:
            parts = message.content.split()
            if len(parts) < 2:
                await message.channel.send("❌ Использование: !category <название категории>")
                return
            
            # Объединяем все части после команды в название категории
            category_query = " ".join(parts[1:])
            
            # Получаем ID канала владельца
            channel_owner_id = await self._get_channel_owner_id(message.channel.name)
            if not channel_owner_id:
                await message.channel.send("❌ Не удалось определить владельца канала")
                return
            
            # Импортируем TwitchAPI
            from api.twitch_api import TwitchAPI
            from core.connection_manager import ConnectionManager
            
            # Создаем экземпляр API
            twitch_api = TwitchAPI(ConnectionManager())
            
            # Ищем категории
            categories = await twitch_api.search_categories(category_query)
            
            if not categories:
                await message.channel.send(f"❌ Категория '{category_query}' не найдена")
                return
            
            # Берем первую найденную категорию (наиболее релевантную)
            category = categories[0]
            
            # Используем унифицированную систему обновления
            await self._update_stream_unified(str(channel_owner_id), twitch_category_id=category['id'], category_name=category['name'])
            
            await message.channel.send(f"✅ Категория изменена на: {category['name']}")
                
        except Exception as e:
            logger.error(f"Error in category_command_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при изменении категории")

    async def title_command_from_message(self, message):
        """Обработка команды !title для Twitch"""
        try:
            parts = message.content.split()
            if len(parts) < 2:
                await message.channel.send("❌ Использование: !title <новое название>")
                return
            
            # Объединяем все части после команды в название
            new_title = " ".join(parts[1:])
            
            # Получаем ID канала владельца
            channel_owner_id = await self._get_channel_owner_id(message.channel.name)
            if not channel_owner_id:
                await message.channel.send("❌ Не удалось определить владельца канала")
                return
            
            # Используем унифицированную систему обновления
            await self._update_stream_unified(str(channel_owner_id), title=new_title)
            
            await message.channel.send(f"✅ Название стрима изменено на: {new_title}")
                
        except Exception as e:
            logger.error(f"Error in title_command_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при изменении названия стрима")

    async def about_command_from_message(self, message):
        """Обработка команды !about для психологического анализа"""
        try:
            parts = message.content.split()
            if len(parts) < 2:
                await message.channel.send("❌ Использование: !about <ник пользователя>")
                return
            
            target_username = parts[1].lower().strip('@')
            
            # Получаем информацию о пользователе, который запросил анализ
            requester_id = await self._get_channel_owner_id(message.channel.name)
            if not requester_id:
                await message.channel.send("❌ Не удалось определить владельца канала")
                return
            
            # Импортируем сервис психологического анализа
            from services.psychology_service import PsychologyService
            from core.database import get_db
            
            db = next(get_db())
            psychology_service = PsychologyService(db)
            
            # Анализы больше не кэшируются - каждый раз генерируется новый
            
            # Показываем, что анализ начался
            await message.channel.send(f"🔍 Анализирую личность @{target_username}...")
            
            # Выполняем анализ
            analysis_result = await psychology_service.analyze_user_psychology(
                target_username=target_username,
                platform="twitch",
                analyzed_by_user_id=int(requester_id),
                analyzed_by_username=message.author.name
            )
            
            if analysis_result:
                await message.channel.send(f"🧠 @{target_username}: {analysis_result}")
            else:
                await message.channel.send(f"❌ Не удалось проанализировать @{target_username}")
                
        except Exception as e:
            logger.error(f"Error in about_command_from_message: {e}")
            await message.channel.send("❌ Произошла ошибка при анализе")

    async def _update_stream_unified(self, user_id: str, title: str = None, twitch_category_id: str = None, category_name: str = None):
        """Унифицированное обновление стрима для всех подключенных платформ"""
        try:
            import aiohttp
            
            # Подготавливаем данные для запроса
            payload = {}
            
            if title is not None:
                payload["twitch"] = {"title": title}
                payload["vk"] = {"title": title}
            
            if twitch_category_id is not None:
                if "twitch" not in payload:
                    payload["twitch"] = {}
                payload["twitch"]["category_id"] = twitch_category_id
                
                # Для VK Live нужно найти соответствующую категорию по названию
                if category_name:
                    vk_category_id = await self._find_vk_category_by_name(category_name)
                    if vk_category_id:
                        if "vk" not in payload:
                            payload["vk"] = {}
                        payload["vk"]["category_id"] = vk_category_id
            
            if not payload:
                logger.warning("No data to update")
                return
            
            # Отправляем запрос к унифицированному API
            async with aiohttp.ClientSession() as session:
                url = "http://localhost:8000/api/stream/update"
                headers = {"Content-Type": "application/json"}
                
                # Получаем сессию пользователя для авторизации
                from core.database import UserSession, get_db
                db = next(get_db())
                user_session = db.query(UserSession).filter(UserSession.user_id == int(user_id), UserSession.is_active == True).first()
                
                if not user_session:
                    logger.error(f"No active session found for user {user_id}")
                    return
                
                # Используем cookie-based авторизацию
                cookies = {"session_id": user_session.session_id}
                
                async with session.post(url, json=payload, headers=headers, cookies=cookies) as response:
                    if response.status == 200:
                        logger.info(f"Successfully updated stream for user {user_id}")
                        return True
                    elif response.status == 207:
                        # Multi-status - некоторые обновления прошли успешно
                        logger.warning(f"Partial success updating stream for user {user_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to update stream for user {user_id}: {response.status} - {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error in _update_stream_unified: {e}")
            return False

    async def _find_vk_category_by_name(self, category_name: str) -> str:
        """Найти ID категории VK Live по названию"""
        try:
            from api.vk_api import VKLiveAPI
            vk_api = VKLiveAPI()
            
            # Ищем категории в VK Live по названию
            categories = await vk_api.get_categories(search=category_name)
            
            if categories:
                # Возвращаем ID первой найденной категории
                return categories[0]['id']
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding VK category by name '{category_name}': {e}")
            return None

    async def _get_channel_owner_id(self, channel_name: str) -> Optional[int]:
        """Получить ID владельца канала Twitch"""
        try:
            from core.database import UserToken, get_db
            
            db = next(get_db())
            
            # Ищем пользователя по channel_name (username канала)
            # Ищем пользователя по platform_user_id через Twitch API
            user_token = None
            try:
                from api.twitch_api import TwitchAPI
                twitch_api = TwitchAPI(self.connection_manager)
                user_info = await twitch_api.get_user_by_username(channel_name, await twitch_api.get_app_access_token())
                if user_info:
                    user_token = db.query(UserToken).filter(
                        UserToken.platform == "twitch",
                        UserToken.platform_user_id == user_info.get('id')
                    ).first()
            except Exception as e:
                logger.error(f"Error getting user info for {channel_name}: {e}")
            
            if user_token:
                return user_token.user_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting channel owner ID for {channel_name}: {e}")
            return None

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

    async def send_message(self, channel_name: str, message: str) -> bool:
        """Отправить сообщение в канал от имени стримера"""
        try:
            # Проверяем, что бот подключен (проверяем наличие каналов)
            if not self.connected_channels:
                logger.error(f"❌ Bot is not connected to any channels, cannot send message to {channel_name}")
                return False
                
            # ВНИМАНИЕ: Twitch API не позволяет отправлять сообщения от имени другого пользователя
            # Бот может отправлять только от своего имени, но в интерфейсе мы показываем как сообщение от стримера
            channel = self.get_channel(channel_name)
            if not channel:
                logger.error(f"❌ Channel {channel_name} not found in connected channels")
                return False
            
            # Получаем реальное имя стримера из базы данных
            streamer_name = await self._get_streamer_name_by_channel(channel_name)
            
            # Отправляем сообщение (технически от бота, но в IRC это будет от имени бота payedviewer)
            await channel.send(message)
            logger.info(f"📤 Message sent to {channel_name} as {self.nick} (displayed as {streamer_name}): {message}")
            
            # Передаем через WebSocket для отображения в интерфейсе как сообщение от стримера
            # ВАЖНО: Это сообщение уже будет поймано в event_message как ECHO-сообщение
            # и обработано там, поэтому НЕ отправляем его повторно здесь
            # await self.connection_manager.broadcast_chat_message({...})  # УБРАНО
            
            return True
        except Exception as e:
            logger.error(f"Error sending message to {channel_name}: {e}")
            return False
    
    async def _get_streamer_name_by_channel(self, channel_name: str) -> str:
        """Получить имя стримера из Twitch API по имени канала"""
        try:
            from api.twitch_api import TwitchAPI
            twitch_api = TwitchAPI(self.connection_manager)
            
            # Получаем информацию о пользователе по имени канала
            user_info = await twitch_api.get_user_by_username(channel_name, await twitch_api.get_app_access_token())
            if user_info and user_info.get('login'):
                return user_info['login']
            
            # Если не найдено, возвращаем имя канала
            return channel_name
        except Exception as e:
            logger.error(f"Error getting streamer name for {channel_name}: {e}")
            return channel_name
