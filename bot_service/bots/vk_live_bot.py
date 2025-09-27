# bot_service/vk_live_bot.py
import asyncio
import logging
import time
from typing import List, Dict, Any, Optional
from core.connection_manager import ConnectionManager
from bots.vk_live_chat_reader import VKLiveChatReader
from bots.vk_live_chat_reader_optimized import OptimizedVKLiveChatReader
from utils.vk_live_websocket import VKLiveWebSocketClient

logger = logging.getLogger('bot_service')

class VKLiveBot:
    """
    VK Live "бот" для гостевого режима.
    Использует обычный пользовательский аккаунт для подключения к каналам VK Live.
    """
    
    def __init__(self, user_access_token: str, connection_manager: ConnectionManager):
        self.user_access_token = user_access_token
        self.connection_manager = connection_manager
        self.connected_channels: List[str] = []
        self.is_running = False
        
        self.chat_reader: Optional[VKLiveChatReader] = None
        self.ws_client: Optional[VKLiveWebSocketClient] = None
        self.ws_task: Optional[asyncio.Task] = None
        
        # Инициализируем TTS API для обработки сообщений
        from api.tts_api import TTSAPI
        self.tts_api = TTSAPI()
        
        # Инициализируем обработчик команд
        from vk_live_command_handler import VKLiveCommandHandler
        self.command_handler = VKLiveCommandHandler(self)
        
    async def start_bot(self):
        """Запуск VK Live бота"""
        if self.is_running:
            logger.warning("VK Live bot is already running")
            return
            
        self.is_running = True
        logger.info("🚀 VK LIVE BOT STARTED - Ready to listen to chat")
        logger.info("VK LIVE BOT: Started and ready to connect to channels")
        
        try:
            # ИСПОЛЬЗУЕМ WEBSOCKET КЛИЕНТ ДЛЯ ЧАТА (реальный тайм)
            self.ws_client = VKLiveWebSocketClient(self.user_access_token)
            connected = await self.ws_client.connect()
            if connected:
                # Запускаем прослушивание в этом же таске (как и раньше с reader)
                await self.ws_client.listen_for_messages()
            else:
                logger.error("Failed to initialize VK Live WebSocket client")
                # Fallback: включаем ОПТИМИЗИРОВАННЫЙ REST-пуллинг для максимальной производительности
                logger.info("🚀 Switching to OPTIMIZED REST API with intelligent polling...")
                self.chat_reader = OptimizedVKLiveChatReader(self.user_access_token, self.connection_manager)
                await self.chat_reader.start_reader()
                
        except Exception as e:
            logger.error(f"VK Live bot error: {e}")
        finally:
            self.is_running = False
            if self.chat_reader:
                await self.chat_reader.stop_reader()
            if self.ws_client:
                await self.ws_client.disconnect()
            logger.info("🛑 VK Live bot stopped")
    
    async def stop_bot(self):
        """Остановка VK Live бота"""
        self.is_running = False
        if self.chat_reader:
            await self.chat_reader.stop_reader()
        self.connected_channels.clear()
        logger.info("VK Live bot stopping...")
    
    async def join_channel(self, channel_name: str) -> bool:
        """Подключение к каналу VK Live"""
        try:
            if channel_name in self.connected_channels:
                logger.info(f"VK Live bot already connected to channel: {channel_name}")
                return True
            
            # Подключаемся к каналу через WebSocket (подписка на канал) или REST fallback
            subscribed = False
            if self.ws_client:
                subscribed = await self.ws_client.subscribe_to_channel(channel_name)

            if subscribed:
                self.connected_channels.append(channel_name)
                
                # Регистрируем обработчик сообщений для этого канала (единый путь в TTS)
                self.ws_client.register_message_handler(
                    f"api-channel-chat:{channel_name}",
                    lambda msg: self._handle_channel_message(channel_name, msg)
                )
                
                logger.info(f"✅ VK LIVE BOT CONNECTED to channel: {channel_name}")
                logger.info(f"VK LIVE BOT: Successfully connected to {channel_name} and listening for chat messages")
                
                # Отправляем шутливое сообщение о подключении
                fake_ip = self._generate_fake_ip()
                await self.send_message(channel_name, f"подключен к стримеру с IP адресом: {fake_ip}")
                
                return True
            else:
                # Fallback на ОПТИМИЗИРОВАННЫЙ REST-ридер
                if not self.chat_reader:
                    logger.info("🚀 Initializing OPTIMIZED VK Live REST API client...")
                    self.chat_reader = OptimizedVKLiveChatReader(self.user_access_token, self.connection_manager)
                    # Если ридер ещё не запущен в start_bot (когда ws ок), запустим его в фоне
                    asyncio.create_task(self.chat_reader.start_reader())

                if await self.chat_reader.join_channel(channel_name):
                    self.connected_channels.append(channel_name)
                    
                    # Регистрируем обработчик с TTS интеграцией
                    self.chat_reader.register_message_handler(
                        channel_name,
                        lambda msg: self._handle_channel_message_optimized(channel_name, msg)
                    )
                    
                    logger.info(f"✅ VK LIVE BOT CONNECTED (Optimized REST) to channel: {channel_name}")
                    return True
                else:
                    logger.error(f"Failed to connect to channel: {channel_name}")
                    return False
            
        except Exception as e:
            logger.error(f"Failed to connect VK Live bot to channel {channel_name}: {e}")
            return False
    
    async def leave_channel(self, channel_name: str) -> bool:
        """Отключение от канала VK Live"""
        try:
            if channel_name not in self.connected_channels:
                logger.warning(f"VK Live bot not connected to channel: {channel_name}")
                return True
            
            # Для WebSocket отписки по каналу в данной версии SDK нет, достаточно очистить локальные структуры
            
            # Удаляем канал из списка подключенных
            self.connected_channels.remove(channel_name)
            logger.info(f"✅ VK Live bot disconnected from channel: {channel_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to disconnect VK Live bot from channel {channel_name}: {e}")
            return False
    
    def is_connected_to_channel(self, channel_name: str) -> bool:
        """Проверка подключения к каналу"""
        return channel_name in self.connected_channels
    
    async def _handle_channel_message(self, channel_name: str, message_data: dict):
        """Обработка сообщения из канала"""
        try:
            author_nick = message_data.get("author_nick", "Unknown")
            message_text = message_data.get("message", "")
            author_id = message_data.get("author_id")
            
            logger.info(f"📨 VK Live chat [{channel_name}] {author_nick}: {message_text}")
            
            # Обрабатываем команды (если сообщение начинается с !)
            if message_text.startswith('!'):
                await self.handle_database_commands(channel_name, message_data)
            
            # Обрабатываем верификацию
            await self.handle_verification_message(channel_name, message_text, str(author_id))
            
            # Обрабатываем TTS (только для не-команд)
            if not message_text.startswith('!'):
                await self.handle_tts_message(channel_name, message_text, author_nick)
            
        except Exception as e:
            logger.error(f"Error handling channel message: {e}")
    
    async def _handle_channel_message_optimized(self, channel_name: str, message_data: dict):
        """Оптимизированный обработчик сообщений для максимальной производительности"""
        try:
            # Быстрая экстракция данных (оптимизированная версия передает готовые данные)
            author_nick = message_data.get('author_nick', 'Unknown')
            message_text = message_data.get('message', '')
            author_id = message_data.get('author_id')
            
            # Быстрая проверка валидности
            if not message_text.strip():
                return
            
            # Логирование уже происходит в оптимизированном reader'е
            
            # Обработка команд (высокий приоритет)
            if message_text.startswith('!'):
                command_task = asyncio.create_task(
                    self.command_handler.handle_message(channel_name, message_data)
                )
            
            # Асинхронная обработка верификации и TTS без блокировки
            verification_task = asyncio.create_task(
                self.handle_verification_message(channel_name, message_text, str(author_id))
            )
            
            # TTS только для не-команд
            if not message_text.startswith('!'):
                tts_task = asyncio.create_task(
                    self.handle_tts_message(channel_name, message_text, author_nick)
                )
            
            # Можно ждать завершения или пустить в фон для максимальной производительности
            # await asyncio.gather(verification_task, tts_task, return_exceptions=True)
            
        except Exception as e:
            logger.error(f"Error in optimized channel message handler: {e}")
    
    async def handle_verification_message(self, channel_name: str, message: str, user_id: str):
        """Обработка сообщения верификации"""
        try:
            # Проверяем, есть ли ожидающий код верификации для этого канала
            if channel_name not in self.connection_manager.pending_verifications:
                return
            
            verification_data = self.connection_manager.pending_verifications[channel_name]
            expected_code = verification_data.get("code")
            
            if not expected_code:
                return
            
            # Проверяем, совпадает ли сообщение с кодом верификации
            if message.strip() == expected_code:
                # Верификация успешна
                self.connection_manager.verify_channel(channel_name)
                
                # Обновляем данные верификации
                verification_data["verified"] = True
                verification_data["verified_at"] = time.time()
                verification_data["verified_by"] = user_id
                
                logger.info(f"VK Live channel {channel_name} verified by user {user_id}")
                
                # Затираем все предыдущие сессии для этого канала (и авторизованные, и гостевые)
                try:
                    from core.session_manager import session_manager
                    session_manager.terminate_all_sessions_for_channel(
                        channel_name=channel_name,
                        reason="new_vk_guest_login"
                    )
                    
                    # Создаем гостевую сессию
                    session_id = session_manager.create_guest_session(
                        channel_name=channel_name,
                        platform="vk_live"
                    )
                    logger.info(f"Created guest session {session_id} for VK Live channel {channel_name}")
                except Exception as e:
                    logger.error(f"Failed to create guest session for {channel_name}: {e}")
                
                # Отправляем подтверждение пользователю
                await self.send_message(channel_name, f"✅ Канал {channel_name} успешно верифицирован!")
                
                # Сохраняем верификацию в базу данных
                await self.save_verification_to_db(channel_name, user_id)
                
            elif message.strip().startswith("!verify"):
                # Пользователь запросил код верификации
                await self.send_message(channel_name, f"🔐 Код верификации: {expected_code}")
                
        except Exception as e:
            logger.error(f"Error handling verification message for {channel_name}: {e}")
    
    async def send_message(self, channel_name: str, message: str):
        """Отправка сообщения в канал VK Live"""
        try:
            import aiohttp
            
            # Получаем stream_id для канала
            stream_id = await self._get_current_stream_id(channel_name)
            if not stream_id:
                logger.error(f"No active stream found for channel {channel_name}")
                return False
            
            url = "https://apidev.live.vkvideo.ru/v1/chat/message/send"
            headers = {
                "Authorization": f"Bearer {self.user_access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_name,
                "stream_id": stream_id
            }
            
            # Формируем сообщение в формате VK Live
            message_data = {
                "parts": [
                    {
                        "text": {
                            "content": message
                        }
                    }
                ]
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params, json=message_data) as response:
                    if response.status == 200:
                        logger.info(f"✅ VK Live bot sent message to {channel_name}: {message}")
                        return True
                    else:
                        response_text = await response.text()
                        logger.error(f"Failed to send message to {channel_name}: {response.status} - {response_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to send message to VK Live channel {channel_name}: {e}")
            return False
    
    async def mute_user(self, channel_name: str, user_id: int, duration: int = 300):
        """Мут пользователя в чате VK Live"""
        try:
            import aiohttp
            
            url = "https://apidev.live.vkvideo.ru/v1/chat/mute"
            headers = {
                "Authorization": f"Bearer {self.user_access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_name,
                "user_id": user_id,
                "duration": duration  # в секундах
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        logger.info(f"✅ VK Live bot muted user {user_id} in {channel_name} for {duration}s")
                        return True
                    else:
                        response_text = await response.text()
                        logger.error(f"Failed to mute user {user_id} in {channel_name}: {response.status} - {response_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to mute user {user_id} in VK Live channel {channel_name}: {e}")
            return False
    
    async def ban_user(self, channel_name: str, user_id: int, duration: int = 0):
        """Бан пользователя в чате VK Live (0 = перманентный)"""
        try:
            import aiohttp
            
            url = "https://apidev.live.vkvideo.ru/v1/chat/ban"
            headers = {
                "Authorization": f"Bearer {self.user_access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_name,
                "user_id": user_id,
                "duration": duration  # 0 = перманентный бан
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        ban_type = "permanent" if duration == 0 else f"{duration}s"
                        logger.info(f"✅ VK Live bot banned user {user_id} in {channel_name} ({ban_type})")
                        return True
                    else:
                        response_text = await response.text()
                        logger.error(f"Failed to ban user {user_id} in {channel_name}: {response.status} - {response_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to ban user {user_id} in VK Live channel {channel_name}: {e}")
            return False
    
    async def unban_user(self, channel_name: str, user_id: int):
        """Разбан пользователя в чате VK Live"""
        try:
            import aiohttp
            
            url = "https://apidev.live.vkvideo.ru/v1/chat/unban"
            headers = {
                "Authorization": f"Bearer {self.user_access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_name,
                "user_id": user_id
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        logger.info(f"✅ VK Live bot unbanned user {user_id} in {channel_name}")
                        return True
                    else:
                        response_text = await response.text()
                        logger.error(f"Failed to unban user {user_id} in {channel_name}: {response.status} - {response_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Failed to unban user {user_id} in VK Live channel {channel_name}: {e}")
            return False
    
    async def _get_current_stream_id(self, channel_name: str) -> Optional[str]:
        """Получение ID текущего стрима для канала"""
        try:
            import aiohttp
            
            url = f"https://apidev.live.vkvideo.ru/v1/channel"
            headers = {
                "Authorization": f"Bearer {self.user_access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_name
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        stream = data.get("data", {}).get("stream", {})
                        return stream.get("id")
                    else:
                        logger.error(f"Failed to get stream info for {channel_name}: {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error getting stream ID for {channel_name}: {e}")
            return None
    
    async def save_verification_to_db(self, channel_name: str, user_id: str):
        """Сохранение верификации в базу данных"""
        try:
            from core.database import get_db, GuestVerification
            db = next(get_db())
            try:
                # Удаляем старую верификацию, если есть
                db.query(GuestVerification).filter(
                    GuestVerification.channel_name == channel_name
                ).delete()
                
                # Создаем новую верификацию
                from datetime import datetime
                verification = GuestVerification(
                    channel_name=channel_name,
                    verification_code=self.connection_manager.pending_verifications[channel_name]["code"],
                    is_verified=True,
                    verified_at=datetime.utcnow()
                )
                db.add(verification)
                db.commit()
                
                logger.info(f"VK Live verification saved to database for channel: {channel_name}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to save VK Live verification to database: {e}")
    
    async def handle_tts_message(self, channel_name: str, message_text: str, author_nick: str):
        """Обработать сообщение для TTS"""
        try:
            # Проверяем, включен ли TTS для канала на платформе VK Live
            if not self.connection_manager.is_tts_enabled(channel_name, 'vk'):
                logger.debug(f"TTS not enabled for VK Live channel {channel_name}, skipping TTS processing")
                return
            
            # Проверяем whitelist для канала
            if not self.connection_manager.is_channel_whitelisted(channel_name):
                logger.debug(f"Channel {channel_name} not whitelisted, skipping TTS processing")
                return

            # Отправляем запрос на озвучку
            if message_text.strip():  # Только если есть текст для озвучки
                # Получаем настройки громкости для канала (общая громкость)
                volume_level = self.connection_manager.get_tts_volume(channel_name)
                logger.info(f"🎤 Sending TTS request for VK Live channel {channel_name}: {message_text[:50]}... (volume: {volume_level}%)")
                
                # Передаем connection_manager для проверки приоритетных голосов
                result = await self.tts_api.send_tts_request(
                    channel_name, message_text, author_nick, volume_level, self.connection_manager
                )
                
                if result.get("success"):
                    logger.debug(f"TTS synthesis successful: voice={result.get('voice')}, volume={result.get('volume')}%")
                else:
                    logger.error(f"TTS synthesis failed: {result.get('error')}")
                
        except Exception as e:
            logger.error(f"Error handling TTS message for VK Live channel {channel_name}: {e}")

    async def handle_database_commands(self, channel_name: str, message_data: dict):
        """Обработка команд из базы данных для VK Live"""
        try:
            author_nick = message_data.get("author_nick", "Unknown")
            message_text = message_data.get("message", "")
            author_id = message_data.get("author_id")
            
            if not message_text.startswith('!'):
                return
            
            # Извлекаем название команды
            command_name = message_text.split()[0][1:].lower()  # Убираем ! и приводим к нижнему регистру
            
            # Получаем команды из базы данных
            from core.database import get_db, BotCommand, UserToken
            db_gen = get_db()
            db = next(db_gen)
            
            try:
                # Находим user_id по platform_user_id (VK ID)
                user_token = db.query(UserToken).filter(
                    UserToken.platform == 'vk',
                    UserToken.platform_user_id == str(author_id)
                ).first()
                
                if not user_token:
                    logger.warning(f"User token not found for VK ID: {author_id}")
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
                if 'vk' not in command.platforms.split(','):
                    return  # Команда не для VK Live
                
                # Получаем роли пользователя из VK Live API
                user_roles = await self._get_user_roles(channel_name, author_id)
                
                # Проверяем права доступа
                if not RoleChecker.can_execute_command(user_roles, command.allowed_roles, 'vk'):
                    await self.send_message(channel_name, f"❌ У вас нет прав для выполнения команды !{command_name}")
                    return
                
                # Проверяем кулдаун
                from datetime import datetime, timedelta
                if command.last_used and command.cooldown_seconds > 0:
                    time_since_last_use = datetime.utcnow() - command.last_used
                    if time_since_last_use.total_seconds() < command.cooldown_seconds:
                        remaining_time = command.cooldown_seconds - int(time_since_last_use.total_seconds())
                        await self.send_message(channel_name, f"⏰ Команда !{command_name} на кулдауне. Осталось: {remaining_time}с")
                        return
                
                # Выполняем команду
                if command.command_type == 'custom':
                    # Кастомная команда - отправляем ответ
                    response = command.response_text
                    if response:
                        await self.send_message(channel_name, response)
                else:
                    # Базовая команда - вызываем соответствующий обработчик
                    await self.handle_basic_command_vk(command_name, channel_name, message_data, command)
                
                # Обновляем статистику использования
                command.last_used = datetime.utcnow()
                command.usage_count += 1
                db.commit()
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in handle_database_commands: {e}")

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
                    'allowed_roles': 'owner,moderator_vk',
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

    async def _get_user_roles(self, channel_name: str, user_id: str) -> List[str]:
        """Получение ролей пользователя в VK Live"""
        try:
            # Здесь нужно сделать запрос к VK Live API для получения информации о пользователе
            # Пока возвращаем базовые роли
            roles = []
            
            # Получение ролей пользователя (заглушка)
            return roles
            
        except Exception as e:
            logger.error(f"Error getting user roles: {e}")
            return []

    async def handle_basic_command_vk(self, command_name: str, channel_name: str, message_data: dict, command):
        """Обработка базовых команд для VK Live"""
        try:
            if command_name == 'tts':
                await self.toggle_tts_vk(channel_name, message_data)
            elif command_name == 'queue':
                await self.show_queue_vk(channel_name)
            elif command_name == 'next':
                await self.next_video_vk(channel_name)
            elif command_name == 'clear':
                await self.clear_queue_vk(channel_name)
            elif command_name == 'sr':
                # Извлекаем URL из сообщения
                message_text = message_data.get("message", "")
                parts = message_text.split()
                url = parts[1] if len(parts) > 1 else None
                author_nick = message_data.get("author_nick", "Unknown")
                await self.song_request_vk(channel_name, url, author_nick)
            elif command_name == 'help':
                await self.help_command_vk(channel_name)
            elif command_name == 'voice':
                await self.voice_command_vk(channel_name, message_data)
            # Добавьте другие базовые команды по необходимости
        except Exception as e:
            logger.error(f"Error in handle_basic_command_vk: {e}")

    # Функции для базовых команд VK Live
    async def toggle_tts_vk(self, channel_name: str, message_data: dict = None):
        """Команда для переключения TTS для VK Live"""
        user_name = "Unknown"
        if message_data:
            user_name = message_data.get("author_nick", "Unknown")
            message_text = message_data.get("message", "")
            parts = message_text.split()
            
            # Проверяем, есть ли дополнительные параметры
            if len(parts) > 1:
                if parts[1].lower() == 'random':
                    # Команда !tts random - выбрать случайный голос
                    from api.tts_api import TTSAPI
                    tts_api = TTSAPI()
                    
                    result = await tts_api.get_random_voice(channel_name)
                    if result.get('success'):
                        voice_number = result.get('voice_number')
                        await self.send_message(channel_name, f"🎲 {user_name} выбрал случайный голос #{voice_number}")
                    else:
                        await self.send_message(channel_name, f"❌ Ошибка выбора случайного голоса: {result.get('error', 'Неизвестная ошибка')}")
                    return
                elif parts[1].lower() == 'on':
                    # Принудительно включить TTS
                    self.connection_manager.enable_tts(channel_name, 'vk')
                    await self.send_message(channel_name, "🔊 TTS включен для VK Live")
                    return
                elif parts[1].lower() == 'off':
                    # Принудительно выключить TTS
                    self.connection_manager.disable_tts(channel_name, 'vk')
                    await self.send_message(channel_name, "🔇 TTS отключен для VK Live")
                    return
        
        # Обычное переключение TTS
        if self.connection_manager.is_tts_enabled(channel_name, 'vk'):
            self.connection_manager.disable_tts(channel_name, 'vk')
            await self.send_message(channel_name, "🔇 TTS отключен для VK Live")
        else:
            self.connection_manager.enable_tts(channel_name, 'vk')
            await self.send_message(channel_name, "🔊 TTS включен для VK Live")

    async def show_queue_vk(self, channel_name: str):
        """Показать очередь YouTube видео для VK Live"""
        queue = self.connection_manager.get_youtube_queue(channel_name)
        
        if not queue:
            await self.send_message(channel_name, "📺 Очередь пуста")
            return
        
        current_video = self.connection_manager.get_current_video(channel_name)
        if current_video:
            await self.send_message(channel_name, f"🎵 Сейчас играет: {current_video.get('title', 'Unknown')}")
        
        queue_text = "📺 Очередь:\n"
        for i, video in enumerate(queue[:5], 1):  # Показываем только первые 5
            queue_text += f"{i}. {video.get('title', 'Unknown')}\n"
        
        if len(queue) > 5:
            queue_text += f"... и еще {len(queue) - 5} видео"
        
        await self.send_message(channel_name, queue_text)

    async def next_video_vk(self, channel_name: str):
        """Переключить на следующее видео для VK Live"""
        next_video = self.connection_manager.next_youtube_video(channel_name)
        
        if next_video:
            await self.send_message(channel_name, f"⏭️ Переключено на: {next_video.get('title', 'Unknown')}")
        else:
            await self.send_message(channel_name, "📺 В очереди нет видео")

    async def clear_queue_vk(self, channel_name: str):
        """Очистить очередь видео для VK Live"""
        self.connection_manager.clear_youtube_queue(channel_name)
        await self.send_message(channel_name, "🗑️ Очередь очищена")

    async def song_request_vk(self, channel_name: str, url: str = None, author_nick: str = "Unknown"):
        """Заказать YouTube видео для VK Live"""
        if not url:
            await self.send_message(channel_name, "❌ Укажите URL видео: !sr <url>")
            return
        
        try:
            from services.queue_service import QueueService
            
            # Добавляем видео в очередь через сервис
            queue_service = QueueService(connection_manager=self.connection_manager)
            result = await queue_service.add_video_to_queue(
                user_id=1,  # Временный ID для VK пользователей
                video_url=url, 
                channel_name=channel_name,
                platform='vk',
                requester_name=author_nick,
                requester_id="vk_user"
            )
            
            if result['success']:
                video_info = result['video_info']
                await self.send_message(channel_name, f"✅ {author_nick} добавил в очередь: {video_info['title']}")
                
                # Отправляем событие обновления очереди
                await self.connection_manager.send_youtube_event_to_user(
                    user_id="1",  # Используем тот же ID что и в add_video_to_queue
                    event_type="queue_updated",
                    data={"action": "video_added", "video": video_info}
                )
            else:
                await self.send_message(channel_name, f"❌ Ошибка добавления видео: {result['error']}")
                
        except Exception as e:
            logger.error(f"Error in song_request_vk: {e}")
            await self.send_message(channel_name, "❌ Произошла ошибка при добавлении видео")

    async def help_command_vk(self, channel_name: str):
        """Показать список команд для VK Live"""
        help_text = """
🤖 Доступные команды:
!tts - Включить/выключить TTS
!tts random - Выбрать случайный голос
!tts on/off - Принудительно включить/выключить TTS
!voice <номер> - Выбрать голос для TTS
!queue - Показать очередь видео
!next - Следующее видео
!clear - Очистить очередь
!sr <url> - Добавить видео в очередь
!help - Показать это сообщение
        """
        await self.send_message(channel_name, help_text)

    async def voice_command_vk(self, channel_name: str, message_data: dict):
        """Выбор голоса для TTS для VK Live"""
        try:
            message_text = message_data.get("message", "")
            author_nick = message_data.get("author_nick", "Unknown")
            
            parts = message_text.split()
            if len(parts) < 2:
                await self.send_message(channel_name, "❌ Укажите номер голоса: !voice <номер>")
                return
            
            try:
                voice_number = int(parts[1])
            except ValueError:
                await self.send_message(channel_name, "❌ Номер голоса должен быть числом")
                return
            
            # Отправляем запрос на смену голоса
            from api.tts_api import TTSAPI
            tts_api = TTSAPI()
            
            result = await tts_api.set_voice(channel_name, voice_number, author_nick)
            
            if result.get('success'):
                await self.send_message(channel_name, f"✅ {author_nick} изменил голос на #{voice_number}")
            else:
                await self.send_message(channel_name, f"❌ Ошибка смены голоса: {result.get('error', 'Неизвестная ошибка')}")
                
        except Exception as e:
            logger.error(f"Error in voice_command_vk: {e}")
            await self.send_message(channel_name, "❌ Произошла ошибка при смене голоса")
    
    def _generate_fake_ip(self):
        """Генерирует фейковый IP адрес для шутки"""
        import random
        # Генерируем IP в формате xx.xxx.xx.xx
        octet1 = random.randint(10, 99)
        octet2 = random.randint(100, 999)
        octet3 = random.randint(10, 99)
        octet4 = random.randint(10, 99)
        return f"{octet1}.{octet2}.{octet3}.{octet4}"
