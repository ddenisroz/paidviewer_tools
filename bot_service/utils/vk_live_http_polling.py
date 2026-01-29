"""
VK Live HTTP Polling клиент для получения сообщений из чата
Использует GET /v1/chat/messages вместо WebSocket
"""
import asyncio
import aiohttp
import logging
from typing import Optional, Callable, Dict, Set

from utils.vk_channel_url import extract_vk_channel_slug

logger = logging.getLogger(__name__)


class VKLiveHTTPPolling:
    """HTTP polling клиент для VK Live чата (альтернатива WebSocket)"""
    PROD_API_BASE_URL = "https://api.live.vkvideo.ru"
    DEV_API_BASE_URL = "https://apidev.live.vkvideo.ru"
    # Default to dev API per VK docs.
    API_BASE_URL = DEV_API_BASE_URL

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
        self.error_count: int = 0  # Счетчик последовательных ошибок
        self.max_errors: int = 10  # Максимум ошибок перед увеличением интервала
        # Use instance-level API base to allow safe fallback.
        self.api_base_url = self.API_BASE_URL

    def _format_channel_url(self, channel_url: str) -> str:
        if not channel_url:
            return channel_url
        if channel_url.startswith('http://') or channel_url.startswith('https://'):
            return channel_url
        return f"https://live.vkvideo.ru/{channel_url}"

    def _format_chat_channel(self, channel_url: str) -> str:
        slug = extract_vk_channel_slug(channel_url)
        return slug or channel_url

    def _get_connector(self) -> aiohttp.TCPConnector:
        if 'apidev.' in self.api_base_url:
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            return aiohttp.TCPConnector(ssl=ssl_context)
        return aiohttp.TCPConnector()

    async def start(self, message_handler: Callable):
        """Запустить polling сообщений"""
        if self.is_running:
            logger.warning(f"Polling already running for {self.channel_url}")
            return

        self.message_handler = message_handler
        self.is_running = True
        self.poll_task = asyncio.create_task(self._poll_loop())
        logger.info(f"[OK] Started HTTP polling for VK Live channel: {self.channel_url}")

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
        logger.info(f"[STOP] Stopped HTTP polling for channel: {self.channel_url}")

    async def _poll_loop(self):
        """Основной цикл polling"""
        poll_interval = 0.5  # Запрашиваем каждые 500ms для быстрой реакции (как Twitch WebSocket)
        max_interval = 30.0  # Максимальный интервал при ошибках (30 секунд)

        try:
            while self.is_running:
                try:
                    await self._fetch_and_process_messages()
                    # Успешный запрос - сбрасываем счетчик ошибок
                    if self.error_count > 0:
                        logger.info(f"[OK] VK Live polling recovered after {self.error_count} errors")
                        self.error_count = 0

                except asyncio.CancelledError:
                    raise  # Пробрасываем CancelledError выше
                except Exception as e:
                    self.error_count += 1
                    logger.error(f"[ERROR] Error in polling loop ({self.error_count}/{self.max_errors}): {e}")

                    # При превышении лимита показываем stack trace
                    if self.error_count >= self.max_errors:
                        import traceback
                        logger.error(traceback.format_exc())

                # Вычисляем интервал: экспоненциальный backoff при ошибках
                if self.error_count > 0:
                    # Интервал растет: 0.5 -> 1 -> 2 -> 4 -> 8 -> 16 -> max_interval
                    current_interval = min(poll_interval * (2 ** (self.error_count - 1)), max_interval)
                    if self.error_count % 5 == 0:  # Логируем каждую 5-ю ошибку
                        logger.warning(f"[WAIT] Increased polling interval to {current_interval}s due to errors")
                else:
                    current_interval = poll_interval

                # Ждем перед следующим запросом
                await asyncio.sleep(current_interval)

        except asyncio.CancelledError:
            logger.info(f"Polling loop cancelled for {self.channel_url}")

    async def _fetch_and_process_messages(self, retry: bool = False):
        """Получить и обработать новые сообщения"""
        try:
            url = f"{self.api_base_url}/v1/chat/messages"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": self._format_chat_channel(self.channel_url),
                "limit": 20  # Получаем последние 20 сообщений
            }

            # Timeout: 10 секунд на соединение, 30 секунд на чтение
            timeout = aiohttp.ClientTimeout(total=30, connect=10)

            async with aiohttp.ClientSession(
                connector=self._get_connector(),
                timeout=timeout
            ) as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        messages = data.get("data", {}).get("chat_messages", [])

                        # Обрабатываем сообщения в обратном порядке (от старых к новым)
                        for message in reversed(messages):
                            await self._process_message(message)

                    elif response.status == 401:
                        logger.warning("[REFRESH] VK Live OAuth token expired, needs refresh")
                    elif response.status == 403:
                        logger.error(f"[ERROR] Forbidden: No access to channel {self.channel_url}")
                    else:
                        error_text = await response.text()
                        # VK dev API may not support chat messages; fallback to prod once.
                        if (
                            response.status == 404
                            and "unknown_api_method" in error_text
                            and not retry
                            and self.api_base_url != self.PROD_API_BASE_URL
                        ):
                            logger.warning("[VK HTTP] Chat messages not available on dev API, switching to prod.")
                            self.api_base_url = self.PROD_API_BASE_URL
                            await self._fetch_and_process_messages(retry=True)
                            return
                        logger.error(f"[ERROR] Error fetching messages: {response.status} - {error_text}")

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
                logger.info(f"[INIT] Initialized polling timestamp: {self.last_message_time}")

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
                # [OK] Также обрабатываем другие типы parts (упоминания, смайлы и т.д.)
                elif "mention" in part:
                    message_text += f"@{part['mention'].get('nick', '')}"
                elif "smile" in part:
                    message_text += f":{part['smile'].get('name', '')}:"
                # [OK] Если есть другие типы parts (например, ссылки), добавляем их
                elif "link" in part:
                    link_url = part["link"].get("url", "")
                    if link_url:
                        message_text += link_url

            # [OK] НЕ пропускаем сообщения, даже если текст пустой - возможно это только ссылка или эмодзи
            # Проверяем наличие хотя бы одного part
            if not message_text and not parts:
                return  # Пропускаем только если вообще нет parts

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
                logger.info(f"[MSG] [VK HTTP] {author_nick}: {message_text}")
                await self.message_handler(processed_message)

        except Exception as e:
            logger.error(f"Error processing VK message: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def send_message(self, text: str) -> bool:
        """Отправить сообщение в чат"""
        try:
            url = f"{self.api_base_url}/v1/chat/message/send"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            params = {
                "channel_url": self._format_channel_url(self.channel_url)
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

            async with aiohttp.ClientSession(connector=self._get_connector()) as session:
                async with session.post(url, headers=headers, params=params, json=body) as response:
                    if response.status == 200:
                        logger.info(f"[OK] VK message sent: {text}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"[ERROR] Failed to send VK message: {response.status} - {error_text}")
                        return False

        except Exception as e:
            logger.error(f"Error sending VK message: {e}")
            return False

