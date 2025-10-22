"""
VK Live HTTP Polling клиент для получения сообщений из чата
Использует GET /v1/chat/messages вместо WebSocket
"""
import asyncio
import aiohttp
import logging
from typing import Optional, Callable, Dict, Set
from datetime import datetime

logger = logging.getLogger(__name__)


class VKLiveHTTPPolling:
    """HTTP polling клиент для VK Live чата (альтернатива WebSocket)"""
    
    def __init__(self, access_token: str, channel_url: str):
        """
        Args:
            access_token: OAuth токен пользователя VK Live
            channel_url: URL канала (например, "yourchy")
        """
        self.access_token = access_token
        self.channel_url = channel_url
        self.is_running = False
        self.poll_task = None
        self.message_handler: Optional[Callable] = None
        self.seen_message_ids: Set[int] = set()  # Для предотвращения дубликатов
        self.last_message_time: int = 0  # Timestamp последнего сообщения
        
    async def start(self, message_handler: Callable):
        """Запустить polling сообщений"""
        if self.is_running:
            logger.warning(f"Polling already running for {self.channel_url}")
            return
            
        self.message_handler = message_handler
        self.is_running = True
        self.poll_task = asyncio.create_task(self._poll_loop())
        logger.info(f"✅ Started HTTP polling for VK Live channel: {self.channel_url}")
        
    async def stop(self):
        """Остановить polling"""
        self.is_running = False
        if self.poll_task:
            self.poll_task.cancel()
            try:
                await self.poll_task
            except asyncio.CancelledError:
                pass
            self.poll_task = None
        logger.info(f"🛑 Stopped HTTP polling for channel: {self.channel_url}")
        
    async def _poll_loop(self):
        """Основной цикл polling"""
        poll_interval = 0.5  # Запрашиваем каждые 500ms для быстрой реакции (как Twitch WebSocket)
        
        try:
            while self.is_running:
                try:
                    await self._fetch_and_process_messages()
                except Exception as e:
                    logger.error(f"Error in polling loop: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                # Ждем перед следующим запросом
                await asyncio.sleep(poll_interval)
                
        except asyncio.CancelledError:
            logger.info(f"Polling loop cancelled for {self.channel_url}")
            
    async def _fetch_and_process_messages(self):
        """Получить и обработать новые сообщения"""
        try:
            url = "https://apidev.live.vkvideo.ru/v1/chat/messages"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": self.channel_url,
                "limit": 20  # Получаем последние 20 сообщений
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        messages = data.get("data", {}).get("chat_messages", [])
                        
                        # Обрабатываем сообщения в обратном порядке (от старых к новым)
                        for message in reversed(messages):
                            await self._process_message(message)
                            
                    elif response.status == 401:
                        logger.warning(f"🔄 VK Live OAuth token expired, needs refresh")
                    elif response.status == 403:
                        logger.error(f"❌ Forbidden: No access to channel {self.channel_url}")
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Error fetching messages: {response.status} - {error_text}")
                        
        except Exception as e:
            logger.error(f"Error fetching VK Live messages: {e}")
            
    async def _process_message(self, message: Dict):
        """Обработать одно сообщение"""
        try:
            message_id = message.get("id")
            created_at = message.get("created_at", 0)
            
            # ВАЖНО: Инициализируем last_message_time при первом запуске
            if self.last_message_time == 0:
                # Получаем текущее время в секундах (VK использует Unix timestamp)
                import time
                self.last_message_time = int(time.time()) - 10  # Последние 10 секунд
                logger.info(f"📅 Initialized polling timestamp: {self.last_message_time}")
            
            # Пропускаем уже обработанные сообщения
            if message_id in self.seen_message_ids:
                return
                
            # Пропускаем старые сообщения (до запуска бота)
            if created_at <= self.last_message_time:
                return
                
            # Помечаем как обработанное
            self.seen_message_ids.add(message_id)
            
            # Обновляем время последнего сообщения
            if created_at > self.last_message_time:
                self.last_message_time = created_at
                
            # Извлекаем данные автора
            author = message.get("author", {})
            author_nick = author.get("nick", "Unknown")
            author_id = author.get("id", 0)
            is_moderator = author.get("is_moderator", False)
            is_owner = author.get("is_owner", False)
            
            # Извлекаем текст сообщения из parts
            message_text = ""
            parts = message.get("parts", [])
            for part in parts:
                if "text" in part:
                    text_content = part["text"].get("content", "")
                    message_text += text_content
                    
            if not message_text:
                return  # Пропускаем пустые сообщения
                
            # Формируем объект сообщения для обработчика
            processed_message = {
                "id": message_id,
                "author": {
                    "nick": author_nick,
                    "id": author_id,
                    "is_moderator": is_moderator,
                    "is_owner": is_owner
                },
                "text": message_text,
                "created_at": created_at,
                "channel": self.channel_url,
                "platform": "vk"
            }
            
            # Отправляем в обработчик
            if self.message_handler:
                logger.info(f"📩 [VK HTTP] {author_nick}: {message_text}")
                await self.message_handler(processed_message)
                
        except Exception as e:
            logger.error(f"Error processing VK message: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
    async def send_message(self, text: str) -> bool:
        """Отправить сообщение в чат"""
        try:
            url = "https://apidev.live.vkvideo.ru/v1/chat/message/send"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": self.channel_url
            }
            body = {
                "parts": [
                    {
                        "text": {
                            "content": text
                        }
                    }
                ]
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, params=params, json=body) as response:
                    if response.status == 200:
                        logger.info(f"✅ VK message sent: {text}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Failed to send VK message: {response.status} - {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error sending VK message: {e}")
            return False

