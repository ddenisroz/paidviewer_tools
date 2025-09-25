# bot_service/vk_live_bot.py
import asyncio
import logging
import time
from typing import List, Dict, Any, Optional
from core.connection_manager import ConnectionManager
from bots.vk_live_chat_reader import VKLiveChatReader

logger = logging.getLogger(__name__)

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
        from api.tts_api import TTSAPI
        self.tts_api = TTSAPI()
        
    async def start_bot(self):
        """Запуск VK Live бота"""
        if self.is_running:
            logger.warning("VK Live bot is already running")
            return
            
        self.is_running = True
        logger.info("🚀 VK Live bot started")
        
        try:
            # Создаем REST API клиент для чтения чата
            self.chat_reader = VKLiveChatReader(self.user_access_token, self.connection_manager)
            
            # Запускаем чтение чата
            await self.chat_reader.start_reader()
                
        except Exception as e:
            logger.error(f"VK Live bot error: {e}")
        finally:
            self.is_running = False
            if self.chat_reader:
                await self.chat_reader.stop_reader()
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
            
            if not self.chat_reader:
                logger.error("Chat reader not initialized")
                return False
            
            # Подключаемся к каналу через REST API
            if await self.chat_reader.join_channel(channel_name):
                self.connected_channels.append(channel_name)
                
                # Регистрируем обработчик сообщений для этого канала
                self.chat_reader.register_message_handler(
                    channel_name,
                    lambda msg: self._handle_channel_message(channel_name, msg)
                )
                
                logger.info(f"✅ VK Live bot connected to channel: {channel_name}")
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
            
            # Останавливаем chat_reader для этого канала
            if self.chat_reader:
                await self.chat_reader.leave_channel(channel_name)
            
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
            
            # Обрабатываем верификацию
            await self.handle_verification_message(channel_name, message_text, str(author_id))
            
            # Обрабатываем TTS
            await self.handle_tts_message(channel_name, message_text, author_nick)
            
        except Exception as e:
            logger.error(f"Error handling channel message: {e}")
    
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
                logger.info(f"🎤 Sending TTS request for VK Live channel {channel_name}: {message_text[:50]}...")
                await self.tts_api.send_tts_request(channel_name, message_text, author_nick)
                
        except Exception as e:
            logger.error(f"Error handling TTS message for VK Live channel {channel_name}: {e}")
