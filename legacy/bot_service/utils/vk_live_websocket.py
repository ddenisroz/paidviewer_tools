# bot_service/vk_live_websocket.py
import asyncio
import json
import logging
import aiohttp
import websockets
from typing import Dict, List, Optional, Callable
from urllib.parse import urlencode

logger = logging.getLogger('bot_service')

class VKLiveWebSocketClient:
    """
    WebSocket клиент для VK Live API через Centrifugo
    """
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.websocket = None
        self.is_connected = False
        self.subscribed_channels = set()
        self.message_handlers: Dict[str, Callable] = {}
        
    async def connect(self) -> bool:
        """Подключение к VK Live WebSocket"""
        try:
            # НОВЫЙ ПОДХОД: Подключаемся БЕЗ JWT токена к ПУБЛИЧНОМУ каналу!
            # Публичные каналы VK Live НЕ требуют авторизации
            ws_url = "wss://pubsub-dev.live.vkvideo.ru/connection/websocket?format=json&cf_protocol_version=v2"
            
            logger.info(f"🔌 Connecting to VK Live WebSocket (public channel, no auth)...")
            self.websocket = await websockets.connect(ws_url)
            self.is_connected = True
            logger.info("✅ WebSocket connection established")
            
            # Ждем приветственное сообщение от Centrifugo
            try:
                welcome_msg = await asyncio.wait_for(self.websocket.recv(), timeout=3.0)
                logger.info(f"📥 Welcome from Centrifugo: {welcome_msg}")
            except asyncio.TimeoutError:
                logger.info("⚠️ No welcome message (это может быть нормально)")
            except Exception as e:
                logger.info(f"⚠️ Welcome message error: {e}")
            
            logger.info("✅ VK Live WebSocket ready")
            return True
            
        except Exception as e:
            import traceback
            logger.error(f"Failed to connect to VK Live WebSocket: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    async def _get_websocket_token(self) -> Optional[str]:
        """Получение JWT токена для WebSocket подключения"""
        try:
            # Используем dev API (только он доступен)
            endpoints = [
                "https://apidev.live.vkvideo.ru/v1/websocket/token",
                "https://api.vk.com/method/streaming.getServerUrl"
            ]
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            # SSL context с отключенной верификацией для dev API
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
                for url in endpoints:
                    try:
                        logger.info(f"Trying VK API endpoint: {url}")
                        async with session.get(url, headers=headers) as response:
                            if response.status == 200:
                                data = await response.json()
                                token = data.get("data", {}).get("token") or data.get("response", {}).get("endpoint")
                                if token:
                                    logger.info(f"✅ Got token from {url}")
                                    return token
                            else:
                                try:
                                    body = await response.text()
                                except Exception:
                                    body = "<no body>"
                                logger.warning(f"Endpoint {url} returned {response.status}: {body}")
                    except Exception as e:
                        logger.warning(f"Error with endpoint {url}: {e}")
                        continue
            
            # Если все endpoints не работают, попробуем без токена
            logger.warning("All VK API endpoints failed, trying without token")
            return None
                        
        except Exception as e:
            logger.error(f"Error getting WebSocket token: {e}")
            return None
    
    async def subscribe_to_channel(self, channel_name: str) -> bool:
        """Подписка на канал чата (используется РЕАЛЬНОЕ имя канала из API)"""
        try:
            if not self.is_connected or not self.websocket:
                logger.error("WebSocket not connected")
                return False
            
            logger.info(f"📡 Subscribing to PUBLIC channel: {channel_name}")
            
            # Для ПУБЛИЧНЫХ каналов VK Live НЕ нужен subscription token!
            # Просто отправляем subscribe команду
            subscribe_msg = {
                "id": 1,  # ID команды
                "method": "subscribe",
                "params": {
                    "channel": channel_name  # Используем ТОЧНОЕ имя из API
                }
            }
            
            logger.info(f"📤 Sending subscribe: {json.dumps(subscribe_msg)}")
            await self.websocket.send(json.dumps(subscribe_msg))
            
            try:
                # Ждем подтверждения подписки
                response = await asyncio.wait_for(self.websocket.recv(), timeout=10.0)
                logger.info(f"📥 Subscription response: {response}")
                
                # Парсим ответ подписки
                try:
                    response_data = json.loads(response)
                    if "result" in response_data and response_data.get("result") is not False:
                        self.subscribed_channels.add(channel_name)
                        logger.info(f"✅ Successfully subscribed to channel: {channel_name}")
                        return True
                    elif "error" in response_data:
                        logger.error(f"❌ Subscription error: {response_data.get('error')}")
                        return False
                    else:
                        logger.warning(f"⚠️ Unexpected subscription response: {response_data}")
                        return False
                except json.JSONDecodeError:
                    logger.error(f"❌ Invalid subscription response: {response}")
                    return False
                    
            except asyncio.TimeoutError:
                logger.error(f"⏰ Subscription timeout for {channel_name}")
                return False
            
        except Exception as e:
            logger.error(f"Failed to subscribe to channel {channel_name}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    async def _get_subscription_token_for_channel(self, channel_name: str) -> Optional[str]:
        """Получить subscription token для приватного канала"""
        try:
            import aiohttp
            import ssl
            
            url = "https://apidev.live.vkvideo.ru/v1/websocket/subscription_token"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channels": channel_name  # Передаем точное имя канала
            }
            
            logger.info(f"🔑 Requesting subscription token for: {channel_name}")
            
            # SSL context с отключенной верификацией для dev API
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        channel_tokens = data.get("data", {}).get("channel_tokens", [])
                        
                        for token_info in channel_tokens:
                            if token_info.get("channel") == channel_name:
                                token = token_info.get("token")
                                logger.info(f"✅ Got subscription token for {channel_name}")
                                return token
                        
                        logger.warning(f"⚠️ No subscription token found for {channel_name}")
                        return None
                    else:
                        error_text = await response.text()
                        logger.warning(f"⚠️ Failed to get subscription token: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.warning(f"⚠️ Error getting subscription token: {e}")
            return None
    
    async def receive_message(self) -> Optional[Dict]:
        """Получить одно сообщение из WebSocket"""
        try:
            if not self.is_connected or not self.websocket:
                return None
            
            # Получаем сырое сообщение
            raw_message = await asyncio.wait_for(self.websocket.recv(), timeout=0.1)
            
            # Парсим JSON
            data = json.loads(raw_message)
            
            # Обрабатываем публикации (новые сообщения чата)
            if data.get("method") == "publication":
                params = data.get("params", {})
                message_data = params.get("data", {})
                
                # Возвращаем сообщение чата в формате для обработки
                return message_data
            
            return None
            
        except asyncio.TimeoutError:
            # Нет сообщений - это норма
            return None
        except websockets.exceptions.ConnectionClosed:
            logger.info("VK Live WebSocket connection closed")
            self.is_connected = False
            return None
        except Exception as e:
            logger.debug(f"Error receiving message: {e}")
            return None
    
    async def listen_for_messages(self):
        """Прослушивание сообщений из WebSocket"""
        try:
            while self.is_connected and self.websocket:
                message = await self.websocket.recv()
                await self._handle_message(message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("VK Live WebSocket connection closed")
            self.is_connected = False
        except Exception as e:
            logger.error(f"Error listening for messages: {e}")
            self.is_connected = False
    
    async def _handle_message(self, message: str):
        """Обработка входящих сообщений"""
        try:
            data = json.loads(message)
            
            # Обрабатываем разные типы сообщений Centrifugo
            if "result" in data:
                # Ответ на команду (connect, subscribe)
                logger.debug(f"VK Live WebSocket response: {data}")
            elif "method" in data:
                method = data["method"]
                if method == "message":
                    # Сообщение из канала
                    await self._handle_channel_message(data)
                elif method == "publication":
                    # Публикация в канале (новое сообщение)
                    await self._handle_publication(data)
                else:
                    logger.debug(f"VK Live WebSocket method {method}: {data}")
            else:
                logger.debug(f"VK Live WebSocket message: {data}")
                
        except json.JSONDecodeError:
            logger.error(f"Failed to parse WebSocket message: {message}")
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
    
    async def _handle_publication(self, data: dict):
        """Обработка публикации в канале (новое сообщение)"""
        try:
            channel = data.get("params", {}).get("channel", "")
            message_data = data.get("params", {}).get("data", {})
            
            logger.info(f"📨 VK Live publication in {channel}: {message_data}")
            
            # Обрабатываем как сообщение чата
            await self._handle_chat_message(channel, message_data)
                
        except Exception as e:
            logger.error(f"Error handling publication: {e}")
    
    async def _handle_channel_message(self, data: dict):
        """Обработка сообщения из канала чата"""
        try:
            channel = data.get("params", {}).get("channel", "")
            message_data = data.get("params", {}).get("data", {})
            
            # Извлекаем информацию о сообщении
            message_type = message_data.get("type")
            
            if message_type == "chat_message":
                # Новое сообщение в чате
                await self._handle_chat_message(channel, message_data)
            elif message_type == "user_joined":
                # Пользователь присоединился к чату
                logger.info(f"User joined chat: {message_data}")
            elif message_type == "user_left":
                # Пользователь покинул чат
                logger.info(f"User left chat: {message_data}")
            else:
                logger.debug(f"Unknown message type: {message_type}")
                
        except Exception as e:
            logger.error(f"Error handling channel message: {e}")
    
    async def _handle_chat_message(self, channel: str, message_data: dict):
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
                # ✅ Обрабатываем ссылки если они в отдельном part
                elif "link" in part:
                    link_url = part["link"].get("url", "")
                    if link_url:
                        message_text += link_url
            
            # Извлекаем информацию об авторе
            author_id = author.get("id")
            author_nick = author.get("nick", "Unknown")
            is_moderator = author.get("is_moderator", False)
            is_owner = author.get("is_owner", False)
            
            # Логируем сообщение
            logger.info(f"VK Live chat message from {author_nick} ({author_id}): {message_text}")
            
            # Вызываем обработчик сообщения, если он зарегистрирован
            if channel in self.message_handlers:
                await self.message_handlers[channel]({
                    "channel": channel,
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
    
    def register_message_handler(self, channel: str, handler: Callable):
        """Регистрация обработчика сообщений для канала"""
        self.message_handlers[channel] = handler
    
    async def disconnect(self):
        """Отключение от WebSocket"""
        try:
            self.is_connected = False
            if self.websocket:
                await self.websocket.close()
                self.websocket = None
            logger.info("VK Live WebSocket disconnected")
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}")
