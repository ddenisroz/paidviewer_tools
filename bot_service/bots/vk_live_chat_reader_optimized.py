# bot_service/vk_live_chat_reader_optimized.py
import asyncio
import logging
import aiohttp
from typing import Dict, List, Optional, Callable, Set
import time
import json
from datetime import datetime, timedelta

logger = logging.getLogger('bot_service')

class OptimizedVKLiveChatReader:
    """
    Супер-оптимизированный REST API клиент для чтения чата VK Live
    
    Улучшения:
    - Умный adaptive polling (частота зависит от активности)
    - Connection pooling для лучшей производительности  
    - Retry механизм с exponential backoff
    - Кэширование для уменьшения нагрузки на API
    - Batch processing сообщений
    - Автоматическое восстановление соединения
    - Метрики производительности
    """
    
    def __init__(self, access_token: str, connection_manager):
        self.access_token = access_token
        self.connection_manager = connection_manager
        self.connected_channels: List[str] = []
        self.is_running = False
        self.message_handlers: Dict[str, Callable] = {}
        self.last_message_times: Dict[str, float] = {}
        
        # Оптимизации
        self.session: Optional[aiohttp.ClientSession] = None
        self.polling_intervals: Dict[str, float] = {}  # Адаптивная частота для каждого канала
        self.retry_counts: Dict[str, int] = {}
        self.channel_activity: Dict[str, List[float]] = {}  # История активности
        self.message_cache: Dict[str, Set[int]] = {}  # Кэш ID сообщений
        
        # Настройки производительности
        self.min_polling_interval = 1.0  # Минимум 1 секунда для активных каналов
        self.max_polling_interval = 10.0  # Максимум 10 секунд для неактивных
        self.default_polling_interval = 3.0  # По умолчанию 3 секунды
        self.activity_window = 300  # 5 минут для анализа активности
        self.max_retries = 3
        self.timeout = 10.0
        
        # Метрики
        self.stats = {
            'total_messages': 0,
            'api_calls': 0,
            'errors': 0,
            'start_time': time.time()
        }
        
    async def start_reader(self):
        """Запуск супер-оптимизированного чтения чата"""
        if self.is_running:
            logger.warning("VK Live chat reader is already running")
            return
            
        self.is_running = True
        logger.info("🚀 OPTIMIZED VK LIVE CHAT READER STARTED - Maximum performance mode")
        
        # Создаем persistent session для лучшей производительности
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        connector = aiohttp.TCPConnector(
            limit=10,  # Макс. 10 одновременных соединений
            limit_per_host=5,  # Макс. 5 на хост
            keepalive_timeout=60,  # Keep-alive 60 сек
            enable_cleanup_closed=True
        )
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            connector=connector,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "User-Agent": "VK-Live-Bot-Optimized/1.0"
            }
        )
        
        try:
            # Запускаем основной цикл
            await self._main_loop()
        except Exception as e:
            logger.error(f"Optimized VK Live chat reader error: {e}")
        finally:
            await self._cleanup()
    
    async def _main_loop(self):
        """Основной цикл с умным polling"""
        logger.info("📡 Starting intelligent adaptive polling...")
        
        while self.is_running:
            start_time = time.time()
            
            # Создаем задачи для всех каналов параллельно
            tasks = []
            for channel_name in self.connected_channels:
                task = asyncio.create_task(self._check_channel_messages(channel_name))
                tasks.append(task)
            
            # Выполняем все проверки параллельно
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            
            # Вычисляем оптимальную задержку
            processing_time = time.time() - start_time
            optimal_delay = self._calculate_optimal_delay()
            sleep_time = max(0.1, optimal_delay - processing_time)
            
            logger.debug(f"Processing time: {processing_time:.2f}s, sleeping: {sleep_time:.2f}s")
            await asyncio.sleep(sleep_time)
    
    def _calculate_optimal_delay(self) -> float:
        """Вычисление оптимальной задержки на основе активности каналов"""
        if not self.connected_channels:
            return self.default_polling_interval
        
        # Находим наиболее активный канал
        min_interval = self.max_polling_interval
        for channel in self.connected_channels:
            interval = self.polling_intervals.get(channel, self.default_polling_interval)
            min_interval = min(min_interval, interval)
        
        return min_interval
    
    async def _check_channel_messages(self, channel_name: str):
        """Проверка сообщений канала с retry механизмом"""
        retry_count = 0
        
        while retry_count <= self.max_retries:
            try:
                success = await self._get_channel_messages_with_cache(channel_name)
                if success:
                    # Сбрасываем счетчик ошибок при успехе
                    self.retry_counts[channel_name] = 0
                    return
                    
            except Exception as e:
                logger.warning(f"Error checking {channel_name} (attempt {retry_count + 1}): {e}")
                self.stats['errors'] += 1
            
            retry_count += 1
            if retry_count <= self.max_retries:
                # Exponential backoff
                delay = min(2 ** retry_count, 30)
                await asyncio.sleep(delay)
        
        # Увеличиваем интервал для проблемного канала
        current_interval = self.polling_intervals.get(channel_name, self.default_polling_interval)
        self.polling_intervals[channel_name] = min(current_interval * 1.5, self.max_polling_interval)
        logger.warning(f"Increased polling interval for {channel_name} to {self.polling_intervals[channel_name]:.1f}s")
    
    async def _get_channel_messages_with_cache(self, channel_name: str) -> bool:
        """Получение сообщений с кэшированием"""
        try:
            url = "https://apidev.live.vkvideo.ru/v1/chat/messages"
            params = {
                "channel_url": channel_name,
                "limit": 20  # Уменьшено до 20 для лучшей производительности
            }
            
            self.stats['api_calls'] += 1
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    messages = data.get("data", {}).get("chat_messages", [])
                    
                    logger.debug(f"🔍 VK LIVE: Checked {channel_name}, got {len(messages)} messages")
                    
                    # Обрабатываем с кэшированием
                    new_messages = await self._process_messages_with_cache(channel_name, messages)
                    
                    # Обновляем статистику активности
                    self._update_channel_activity(channel_name, len(new_messages))
                    
                    return True
                else:
                    response_text = await response.text()
                    logger.error(f"❌ VK API ERROR for {channel_name}: {response.status} - {response_text}")
                    return False
                    
        except asyncio.TimeoutError:
            logger.warning(f"⏰ Timeout for channel {channel_name}")
            return False
        except Exception as e:
            logger.error(f"Error getting messages for {channel_name}: {e}")
            return False
    
    async def _process_messages_with_cache(self, channel_name: str, messages: List[dict]) -> List[dict]:
        """Обработка сообщений с кэшированием для избежания дублей"""
        if channel_name not in self.message_cache:
            self.message_cache[channel_name] = set()
        
        cache = self.message_cache[channel_name]
        new_messages = []
        
        # Сортируем сообщения по времени создания
        messages = sorted(messages, key=lambda x: x.get("created_at", 0))
        
        for message in messages:
            message_id = message.get("id")
            created_at = message.get("created_at", 0)
            
            # Проверяем, что сообщение новое
            if message_id and message_id not in cache:
                # Дополнительная проверка по времени
                last_time = self.last_message_times.get(channel_name, 0)
                if created_at > last_time:
                    new_messages.append(message)
                    cache.add(message_id)
                    self.last_message_times[channel_name] = max(
                        self.last_message_times.get(channel_name, 0), 
                        created_at
                    )
        
        # Очищаем старые записи из кэша (оставляем только последние 1000)
        if len(cache) > 1000:
            cache.clear()
            logger.debug(f"Cleared message cache for {channel_name}")
        
        # Обрабатываем новые сообщения batch'ом для лучшей производительности
        if new_messages:
            self.stats['total_messages'] += len(new_messages)
            logger.info(f"🆕 Found {len(new_messages)} new messages in {channel_name}")
            
            # Batch processing
            await self._batch_process_messages(channel_name, new_messages)
        
        return new_messages
    
    async def _batch_process_messages(self, channel_name: str, messages: List[dict]):
        """Batch обработка сообщений для лучшей производительности"""
        try:
            # Обрабатываем сообщения группами по 10
            batch_size = 10
            for i in range(0, len(messages), batch_size):
                batch = messages[i:i + batch_size]
                
                # Создаем задачи для параллельной обработки
                tasks = [
                    self._handle_chat_message_optimized(channel_name, msg) 
                    for msg in batch
                ]
                
                await asyncio.gather(*tasks, return_exceptions=True)
                
                # Небольшая пауза между batch'ами
                if i + batch_size < len(messages):
                    await asyncio.sleep(0.01)
                    
        except Exception as e:
            logger.error(f"Error in batch processing for {channel_name}: {e}")
    
    async def _handle_chat_message_optimized(self, channel_name: str, message_data: dict):
        """Оптимизированная обработка сообщения чата"""
        try:
            # Быстрая экстракция данных
            author = message_data.get("author", {})
            message_id = message_data.get("id")
            created_at = message_data.get("created_at")
            parts = message_data.get("parts", [])
            
            # Оптимизированная сборка текста
            message_text = self._extract_message_text_fast(parts)
            
            # Быстрая экстракция автора
            author_id = author.get("id")
            author_nick = author.get("nick", "Unknown")
            is_moderator = author.get("is_moderator", False)
            is_owner = author.get("is_owner", False)
            
            # Форматированный лог с timestamp
            timestamp = datetime.now().strftime("%H:%M:%S")
            logger.info(f"📨 [{timestamp}] VK LIVE CHAT [{channel_name}] {author_nick}: {message_text}")
            
            # Быстрый вызов обработчика
            if channel_name in self.message_handlers:
                message_obj = {
                    "channel": channel_name,
                    "author_id": author_id,
                    "author_nick": author_nick,
                    "message": message_text,
                    "is_moderator": is_moderator,
                    "is_owner": is_owner,
                    "message_id": message_id,
                    "created_at": created_at
                }
                
                # Неблокирующий вызов обработчика
                asyncio.create_task(self.message_handlers[channel_name](message_obj))
                
        except Exception as e:
            logger.error(f"Error handling optimized chat message: {e}")
    
    def _extract_message_text_fast(self, parts: List[dict]) -> str:
        """Быстрая экстракция текста сообщения"""
        text_parts = []
        
        for part in parts:
            if "text" in part:
                content = part["text"].get("content", "")
                if content:
                    text_parts.append(content)
            elif "mention" in part:
                nick = part["mention"].get("nick", "")
                if nick:
                    text_parts.append(f"@{nick}")
            elif "smile" in part:
                name = part["smile"].get("name", "")
                if name:
                    text_parts.append(f":{name}:")
        
        return "".join(text_parts)
    
    def _update_channel_activity(self, channel_name: str, new_message_count: int):
        """Обновление статистики активности канала для умного polling"""
        current_time = time.time()
        
        if channel_name not in self.channel_activity:
            self.channel_activity[channel_name] = []
        
        activity = self.channel_activity[channel_name]
        
        # Добавляем текущую активность
        if new_message_count > 0:
            activity.append(current_time)
        
        # Очищаем старые записи (старше activity_window)
        cutoff_time = current_time - self.activity_window
        activity[:] = [t for t in activity if t > cutoff_time]
        
        # Вычисляем новый интервал polling на основе активности
        activity_rate = len(activity) / (self.activity_window / 60)  # сообщений в минуту
        
        if activity_rate > 5:  # Очень активный канал
            new_interval = self.min_polling_interval
        elif activity_rate > 1:  # Умеренно активный
            new_interval = self.min_polling_interval * 2
        elif activity_rate > 0.2:  # Малоактивный
            new_interval = self.default_polling_interval
        else:  # Неактивный
            new_interval = self.max_polling_interval
        
        self.polling_intervals[channel_name] = new_interval
        
        if new_message_count > 0:
            logger.debug(f"Channel {channel_name} activity: {activity_rate:.1f} msg/min, polling interval: {new_interval:.1f}s")
    
    async def join_channel(self, channel_name: str) -> bool:
        """Оптимизированное подключение к каналу"""
        try:
            if channel_name in self.connected_channels:
                logger.info(f"VK Live chat reader already connected to channel: {channel_name}")
                return True
            
            # Инициализируем данные канала
            self.connected_channels.append(channel_name)
            self.last_message_times[channel_name] = time.time()
            self.polling_intervals[channel_name] = self.default_polling_interval
            self.retry_counts[channel_name] = 0
            self.channel_activity[channel_name] = []
            self.message_cache[channel_name] = set()
            
            logger.info(f"✅ Optimized VK Live chat reader connected to channel: {channel_name}")
            logger.info(f"📡 Using intelligent adaptive polling (starting at {self.default_polling_interval}s)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect optimized VK Live chat reader to channel {channel_name}: {e}")
            return False
    
    async def leave_channel(self, channel_name: str) -> bool:
        """Отключение от канала с очисткой данных"""
        try:
            if channel_name not in self.connected_channels:
                logger.warning(f"VK Live chat reader not connected to channel: {channel_name}")
                return True
            
            # Очищаем все данные канала
            self.connected_channels.remove(channel_name)
            self.last_message_times.pop(channel_name, None)
            self.polling_intervals.pop(channel_name, None)
            self.retry_counts.pop(channel_name, None)
            self.channel_activity.pop(channel_name, None)
            self.message_cache.pop(channel_name, None)
            
            logger.info(f"Optimized VK Live chat reader disconnected from channel: {channel_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to disconnect optimized VK Live chat reader from channel {channel_name}: {e}")
            return False
    
    def register_message_handler(self, channel_name: str, handler: Callable):
        """Регистрация обработчика сообщений для канала"""
        self.message_handlers[channel_name] = handler
    
    def is_connected_to_channel(self, channel_name: str) -> bool:
        """Проверка подключения к каналу"""
        return channel_name in self.connected_channels
    
    def get_performance_stats(self) -> dict:
        """Получение статистики производительности"""
        uptime = time.time() - self.stats['start_time']
        return {
            'uptime_seconds': uptime,
            'total_messages': self.stats['total_messages'],
            'api_calls': self.stats['api_calls'],
            'errors': self.stats['errors'],
            'messages_per_minute': (self.stats['total_messages'] / uptime) * 60 if uptime > 0 else 0,
            'api_calls_per_minute': (self.stats['api_calls'] / uptime) * 60 if uptime > 0 else 0,
            'error_rate': (self.stats['errors'] / self.stats['api_calls']) * 100 if self.stats['api_calls'] > 0 else 0,
            'connected_channels': len(self.connected_channels),
            'polling_intervals': dict(self.polling_intervals)
        }
    
    async def _cleanup(self):
        """Очистка ресурсов"""
        self.is_running = False
        
        if self.session:
            await self.session.close()
            self.session = None
        
        self.connected_channels.clear()
        self.last_message_times.clear()
        self.message_handlers.clear()
        self.polling_intervals.clear()
        self.retry_counts.clear()
        self.channel_activity.clear()
        self.message_cache.clear()
        
        logger.info("🛑 Optimized VK Live chat reader stopped and cleaned up")
    
    async def stop_reader(self):
        """Остановка оптимизированного чтения чата"""
        await self._cleanup()
