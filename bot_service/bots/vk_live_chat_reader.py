# bot_service/vk_live_chat_reader.py
import asyncio
import logging
import aiohttp
from typing import Dict, List, Optional, Callable
import time

logger = logging.getLogger(__name__)

class VKLiveChatReader:
    """
    REST API клиент для чтения чата VK Live
    """
    
    def __init__(self, access_token: str, connection_manager):
        self.access_token = access_token
        self.connection_manager = connection_manager
        self.connected_channels: List[str] = []
        self.is_running = False
        self.message_handlers: Dict[str, Callable] = {}
        self.last_message_times: Dict[str, float] = {}
        
    async def start_reader(self):
        """Запуск чтения чата"""
        if self.is_running:
            logger.warning("VK Live chat reader is already running")
            return
            
        self.is_running = True
        logger.info("🚀 VK Live chat reader started")
        
        try:
            # Запускаем цикл чтения сообщений
            while self.is_running:
                await self._check_messages()
                await asyncio.sleep(5)  # Проверяем каждые 5 секунд (меньше нагрузки)
                
        except Exception as e:
            logger.error(f"VK Live chat reader error: {e}")
        finally:
            self.is_running = False
            logger.info("🛑 VK Live chat reader stopped")
    
    async def _check_messages(self):
        """Проверка новых сообщений во всех подключенных каналах"""
        for channel_name in self.connected_channels:
            try:
                await self._get_channel_messages(channel_name)
            except Exception as e:
                logger.error(f"Error checking messages for channel {channel_name}: {e}")
    
    async def _get_channel_messages(self, channel_name: str):
        """Получение сообщений из канала"""
        try:
            url = "https://apidev.live.vkvideo.ru/v1/chat/messages"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": channel_name,
                "limit": 50  # Получаем последние 50 сообщений (больше для надежности)
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.debug(f"VK Live chat API response for {channel_name}: {data}")
                        messages = data.get("data", {}).get("chat_messages", [])
                        
                        # Логируем только если есть новые сообщения или это первая проверка
                        if len(messages) > 0:
                            logger.debug(f"📥 Retrieved {len(messages)} messages from {channel_name}")
                        
                        # Обрабатываем только новые сообщения
                        await self._process_messages(channel_name, messages)
                    else:
                        response_text = await response.text()
                        logger.warning(f"Failed to get messages for {channel_name}: {response.status} - {response_text}")
                        
        except Exception as e:
            logger.error(f"Error getting messages for {channel_name}: {e}")
    
    async def _process_messages(self, channel_name: str, messages: List[dict]):
        """Обработка сообщений"""
        try:
            last_time = self.last_message_times.get(channel_name, 0)
            new_messages = []
            
            for message in messages:
                created_at = message.get("created_at", 0)
                if created_at > last_time:
                    new_messages.append(message)
                    last_time = max(last_time, created_at)
            
            # Обновляем время последнего сообщения
            if new_messages:
                self.last_message_times[channel_name] = last_time
                logger.info(f"🆕 Found {len(new_messages)} new messages in {channel_name}")
                
                # Обрабатываем новые сообщения
                for message in new_messages:
                    await self._handle_chat_message(channel_name, message)
                    
        except Exception as e:
            logger.error(f"Error processing messages for {channel_name}: {e}")
    
    async def _handle_chat_message(self, channel_name: str, message_data: dict):
        """Обработка сообщения чата"""
        try:
            # Извлекаем данные сообщения
            author = message_data.get("author", {})
            message_id = message_data.get("id")
            created_at = message_data.get("created_at")
            parts = message_data.get("parts", [])
            
            # Формируем текст сообщения
            message_text = ""
            for part in parts:
                if "text" in part:
                    message_text += part["text"].get("content", "")
                elif "mention" in part:
                    message_text += f"@{part['mention'].get('nick', '')}"
                elif "smile" in part:
                    message_text += f":{part['smile'].get('name', '')}:"
            
            # Извлекаем информацию об авторе
            author_id = author.get("id")
            author_nick = author.get("nick", "Unknown")
            is_moderator = author.get("is_moderator", False)
            is_owner = author.get("is_owner", False)
            
            # Логируем сообщение
            logger.info(f"📨 VK Live chat [{channel_name}] {author_nick}: {message_text}")
            
            # Вызываем обработчик сообщения, если он зарегистрирован
            if channel_name in self.message_handlers:
                await self.message_handlers[channel_name]({
                    "channel": channel_name,
                    "author_id": author_id,
                    "author_nick": author_nick,
                    "message": message_text,
                    "is_moderator": is_moderator,
                    "is_owner": is_owner,
                    "message_id": message_id,
                    "created_at": created_at
                })
                
        except Exception as e:
            logger.error(f"Error handling chat message: {e}")
    
    async def join_channel(self, channel_name: str) -> bool:
        """Подключение к каналу"""
        try:
            if channel_name in self.connected_channels:
                logger.info(f"VK Live chat reader already connected to channel: {channel_name}")
                return True
            
            # Добавляем канал в список
            self.connected_channels.append(channel_name)
            self.last_message_times[channel_name] = time.time()
            
            logger.info(f"✅ VK Live chat reader connected to channel: {channel_name}")
            logger.info(f"📡 Monitoring chat messages every 5 seconds...")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect VK Live chat reader to channel {channel_name}: {e}")
            return False
    
    async def leave_channel(self, channel_name: str) -> bool:
        """Отключение от канала"""
        try:
            if channel_name not in self.connected_channels:
                logger.warning(f"VK Live chat reader not connected to channel: {channel_name}")
                return True
            
            # Удаляем канал из списка
            self.connected_channels.remove(channel_name)
            if channel_name in self.last_message_times:
                del self.last_message_times[channel_name]
            
            logger.info(f"VK Live chat reader disconnected from channel: {channel_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to disconnect VK Live chat reader from channel {channel_name}: {e}")
            return False
    
    def register_message_handler(self, channel_name: str, handler: Callable):
        """Регистрация обработчика сообщений для канала"""
        self.message_handlers[channel_name] = handler
    
    def is_connected_to_channel(self, channel_name: str) -> bool:
        """Проверка подключения к каналу"""
        return channel_name in self.connected_channels
    
    async def stop_reader(self):
        """Остановка чтения чата"""
        self.is_running = False
        # Очищаем все подключенные каналы
        self.connected_channels.clear()
        self.last_message_times.clear()
        self.message_handlers.clear()
        logger.info("VK Live chat reader stopping...")
