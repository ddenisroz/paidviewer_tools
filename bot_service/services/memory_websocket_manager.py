# bot_service/services/memory_websocket_manager.py
"""
Простой WebSocket Manager в памяти
Заменяет Redis WebSocket Manager
"""
import asyncio
import logging
import time
from typing import Dict, List, Set, Any, Optional
from fastapi import WebSocket
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class WebSocketConnection:
    """Информация о WebSocket соединении"""
    websocket: WebSocket
    user_id: int
    channel: str
    platform: str
    connected_at: float
    last_ping: float
    is_active: bool = True
    name: str = ""  # Добавляем поле name для идентификации соединения

class MemoryWebSocketManager:
    """
    Простой WebSocket Manager в памяти
    """
    
    def __init__(self):
        self.connections: Dict[str, WebSocketConnection] = {}
        self.user_connections: Dict[int, Set[str]] = {}
        self.channel_connections: Dict[str, Set[str]] = {}
        self._running = False
        self._ping_interval = 30  # Ping каждые 30 секунд
        self._ping_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Запуск менеджера"""
        if self._running:
            return
            
        self._running = True
        self._ping_task = asyncio.create_task(self._ping_loop())
        logger.info("Memory WebSocket Manager started")
        
    async def stop(self):
        """Остановка менеджера"""
        self._running = False
        
        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass
                
        # Закрываем все соединения
        for conn_id, connection in list(self.connections.items()):
            try:
                await connection.websocket.close()
            except Exception as e:
                logger.error(f"Error closing WebSocket {conn_id}: {e}")
                
        self.connections.clear()
        self.user_connections.clear()
        self.channel_connections.clear()
        
        logger.info("Memory WebSocket Manager stopped")
        
    async def add_connection(
        self,
        websocket: WebSocket,
        user_id: int,
        channel: str,
        platform: str = "twitch"
    ) -> str:
        """
        Добавить WebSocket соединение
        
        Args:
            websocket: WebSocket соединение
            user_id: ID пользователя
            channel: Канал
            platform: Платформа
            
        Returns:
            str: ID соединения
        """
        conn_id = f"{user_id}_{channel}_{platform}_{int(time.time())}"
        
        connection = WebSocketConnection(
            websocket=websocket,
            user_id=user_id,
            channel=channel,
            platform=platform,
            connected_at=time.time(),
            last_ping=time.time(),
            name=channel  # Используем channel как name
        )
        
        self.connections[conn_id] = connection
        
        # Добавляем в индексы
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(conn_id)
        
        if channel not in self.channel_connections:
            self.channel_connections[channel] = set()
        self.channel_connections[channel].add(conn_id)
        
        logger.info(f"WebSocket connection added: {conn_id}")
        return conn_id
        
    async def remove_connection(self, conn_id: str):
        """
        Удалить WebSocket соединение
        
        Args:
            conn_id: ID соединения
        """
        if conn_id not in self.connections:
            return
            
        connection = self.connections[conn_id]
        
        # Удаляем из индексов
        if connection.user_id in self.user_connections:
            self.user_connections[connection.user_id].discard(conn_id)
            if not self.user_connections[connection.user_id]:
                del self.user_connections[connection.user_id]
                
        if connection.channel in self.channel_connections:
            self.channel_connections[connection.channel].discard(conn_id)
            if not self.channel_connections[connection.channel]:
                del self.channel_connections[connection.channel]
        
        # Удаляем соединение
        del self.connections[conn_id]
        
        logger.info(f"WebSocket connection removed: {conn_id}")
        
    async def send_to_user(self, user_id: int, message: Dict[str, Any]):
        """
        Отправить сообщение пользователю
        
        Args:
            user_id: ID пользователя
            message: Сообщение
        """
        if user_id not in self.user_connections:
            return
            
        for conn_id in list(self.user_connections[user_id]):
            try:
                connection = self.connections.get(conn_id)
                if connection and connection.is_active:
                    await connection.websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                # Удаляем неактивное соединение
                await self.remove_connection(conn_id)
                
    async def send_to_channel(self, channel: str, message: Dict[str, Any]):
        """
        Отправить сообщение в канал
        
        Args:
            channel: Канал
            message: Сообщение
        """
        if channel not in self.channel_connections:
            return
            
        for conn_id in list(self.channel_connections[channel]):
            try:
                connection = self.connections.get(conn_id)
                if connection and connection.is_active:
                    await connection.websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to channel {channel}: {e}")
                # Удаляем неактивное соединение
                await self.remove_connection(conn_id)
                
    async def broadcast(self, message: Dict[str, Any]):
        """
        Отправить сообщение всем подключенным пользователям
        
        Args:
            message: Сообщение
        """
        for conn_id, connection in list(self.connections.items()):
            try:
                if connection.is_active:
                    await connection.websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                # Удаляем неактивное соединение
                await self.remove_connection(conn_id)
                
    async def _ping_loop(self):
        """Цикл ping для проверки соединений"""
        while self._running:
            try:
                current_time = time.time()
                inactive_connections = []
                
                for conn_id, connection in self.connections.items():
                    if not connection.is_active:
                        continue
                        
                    # Проверяем, нужно ли отправить ping
                    if current_time - connection.last_ping > self._ping_interval:
                        try:
                            # FastAPI WebSocket не имеет метода ping, используем send_text
                            await connection.websocket.send_text('{"type": "ping"}')
                            connection.last_ping = current_time
                        except Exception as e:
                            logger.warning(f"Ping failed for {conn_id}: {e}")
                            inactive_connections.append(conn_id)
                            
                # Удаляем неактивные соединения
                for conn_id in inactive_connections:
                    await self.remove_connection(conn_id)
                    
                await asyncio.sleep(5)  # Проверяем каждые 5 секунд
                
            except Exception as e:
                logger.error(f"Error in ping loop: {e}")
                await asyncio.sleep(5)
                
    def get_connection_stats(self) -> Dict[str, Any]:
        """
        Получить статистику соединений
        
        Returns:
            Dict со статистикой
        """
        active_connections = sum(1 for conn in self.connections.values() if conn.is_active)
        total_connections = len(self.connections)
        unique_users = len(self.user_connections)
        unique_channels = len(self.channel_connections)
        
        return {
            "active_connections": active_connections,
            "total_connections": total_connections,
            "unique_users": unique_users,
            "unique_channels": unique_channels,
            "running": self._running
        }
        
    def get_user_connections(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Получить соединения пользователя
        
        Args:
            user_id: ID пользователя
            
        Returns:
            List с информацией о соединениях
        """
        if user_id not in self.user_connections:
            return []
            
        connections = []
        for conn_id in self.user_connections[user_id]:
            connection = self.connections.get(conn_id)
            if connection:
                connections.append({
                    "conn_id": conn_id,
                    "channel": connection.channel,
                    "platform": connection.platform,
                    "connected_at": connection.connected_at,
                    "is_active": connection.is_active
                })
                
        return connections

# Глобальный экземпляр
memory_websocket_manager = MemoryWebSocketManager()
