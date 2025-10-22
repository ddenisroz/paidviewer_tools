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
            # Получаем JWT токен для подключения к WebSocket
            jwt_token = await self._get_websocket_token()
            if not jwt_token:
                logger.error("Failed to get WebSocket JWT token")
                return False
            
            # ИСПРАВЛЕННЫЙ СПОСОБ: Подключаемся с токеном в URL параметре
            ws_url = f"wss://pubsub-dev.live.vkvideo.ru/connection/websocket?token={jwt_token}"
            
            logger.info(f"Connecting to VK Live WebSocket with token in URL")
            self.websocket = await websockets.connect(ws_url)
            self.is_connected = True
            
            # НЕ отправляем connect сообщение - токен уже в URL
            logger.info("✅ VK Live WebSocket connection established")
            return True
            
        except Exception as e:
            import traceback
            logger.error(f"Failed to connect to VK Live WebSocket: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    async def _get_websocket_token(self) -> Optional[str]:
        """Получение JWT токена для WebSocket подключения"""
        try:
            url = "https://apidev.live.vkvideo.ru/v1/websocket/token"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("data", {}).get("token")
                    else:
                        try:
                            body = await response.text()
                        except Exception:
                            body = "<no body>"
                        logger.error(f"Failed to get WebSocket token: {response.status} - {body}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error getting WebSocket token: {e}")
            return None
    
    async def subscribe_to_channel(self, channel_name: str) -> bool:
        """Подписка на канал чата"""
        try:
            if not self.is_connected or not self.websocket:
                logger.error("WebSocket not connected")
                return False
            
            # Получаем токен подписки для канала (если нужен)
            subscription_token = await self._get_subscription_token(channel_name)
            logger.info(f"Subscription token for {channel_name}: {'Found' if subscription_token else 'Not available'}")
            
            # Пробуем разные форматы подписки
            channel_formats = [
                f"api-channel-chat:{channel_name}",
                f"chat:{channel_name}",
                channel_name
            ]
            
            for channel_format in channel_formats:
                logger.info(f"Trying to subscribe to channel format: {channel_format}")
                
                # Формируем команду подписки
                subscribe_msg = {
                    "id": len(self.subscribed_channels) + 2,
                    "method": "subscribe",
                    "params": {
                        "channel": channel_format
                    }
                }
                
                # Добавляем токен подписки, если он есть
                if subscription_token:
                    subscribe_msg["params"]["token"] = subscription_token
                
                await self.websocket.send(json.dumps(subscribe_msg))
                logger.info(f"Sent subscription message: {json.dumps(subscribe_msg)}")
                
                try:
                    # Ждем подтверждения подписки
                    response = await asyncio.wait_for(self.websocket.recv(), timeout=10.0)
                    logger.info(f"Subscription response for {channel_format}: {response}")
                    
                    # Парсим ответ подписки
                    try:
                        response_data = json.loads(response)
                        if "result" in response_data and response_data.get("result") is not False:
                            self.subscribed_channels.add(channel_name)
                            logger.info(f"✅ Successfully subscribed to channel: {channel_name} (format: {channel_format})")
                            return True
                        elif "error" in response_data:
                            logger.warning(f"❌ Subscription error for {channel_format}: {response_data.get('error')}")
                            continue  # Пробуем следующий формат
                        else:
                            logger.warning(f"❌ Unexpected subscription response for {channel_format}: {response_data}")
                            continue
                    except json.JSONDecodeError:
                        logger.error(f"❌ Invalid subscription response: {response}")
                        continue
                        
                except asyncio.TimeoutError:
                    logger.warning(f"⏰ Subscription timeout for {channel_format}")
                    continue
            
            logger.error(f"❌ Failed to subscribe to channel {channel_name} with any format")
            return False
            
        except Exception as e:
            logger.error(f"Failed to subscribe to channel {channel_name}: {e}")
            return False
    
    async def _get_subscription_token(self, channel_name: str) -> Optional[str]:
        """Получение токена подписки для канала"""
        try:
            # Пробуем разные форматы каналов для получения токена
            channel_formats = [
                f"api-channel-chat:{channel_name}",
                f"chat:{channel_name}",
                channel_name
            ]
            
            for channel_format in channel_formats:
                logger.info(f"Requesting subscription token for channel format: {channel_format}")
                
                url = "https://apidev.live.vkvideo.ru/v1/websocket/subscription_token"
                headers = {
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                }
                params = {
                    "channels": channel_format
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers, params=params) as response:
                        logger.info(f"Subscription token request status for {channel_format}: {response.status}")
                        
                        if response.status == 200:
                            data = await response.json()
                            logger.info(f"Subscription token response: {data}")
                            
                            channel_tokens = data.get("data", {}).get("channel_tokens", [])
                            
                            # Ищем токен для любого из возможных форматов канала
                            for token_info in channel_tokens:
                                token_channel = token_info.get("channel", "")
                                token_value = token_info.get("token", "")
                                
                                if token_channel and token_value:
                                    logger.info(f"✅ Found subscription token for channel: {token_channel}")
                                    return token_value
                            
                            # Если токены есть, но не для нашего канала
                            if channel_tokens:
                                logger.warning(f"⚠️ Found tokens for other channels: {[t.get('channel') for t in channel_tokens]}")
                        else:
                            try:
                                body = await response.text()
                            except Exception:
                                body = "<no body>"
                            logger.warning(f"❌ Failed to get subscription token for {channel_format}: {response.status} - {body}")
            
            logger.warning(f"❌ No subscription token found for any format of channel: {channel_name}")
            return None
                        
        except Exception as e:
            logger.error(f"Error getting subscription token: {e}")
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
