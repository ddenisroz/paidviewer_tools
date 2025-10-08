from fastapi import WebSocket, WebSocketDisconnect
import json
from datetime import datetime
from typing import List, Dict, Any
import asyncio

class WidgetWebSocketManager:
    def __init__(self):
        # Структура: {user_id: [websocket1, websocket2, ...]}
        self.chat_connections: Dict[str, List[WebSocket]] = {}
        self.lootbox_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect_chat_widget(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.chat_connections:
            self.chat_connections[user_id] = []
        self.chat_connections[user_id].append(websocket)
        print(f"Chat widget connected for user {user_id}. Total connections: {len(self.chat_connections.get(user_id, []))}")
    
    async def disconnect_chat_widget(self, websocket: WebSocket, user_id: str):
        if user_id in self.chat_connections and websocket in self.chat_connections[user_id]:
            self.chat_connections[user_id].remove(websocket)
            if not self.chat_connections[user_id]:  # Удаляем пустой список
                del self.chat_connections[user_id]
        print(f"Chat widget disconnected for user {user_id}")
    
    async def connect_lootbox_widget(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.lootbox_connections:
            self.lootbox_connections[user_id] = []
        self.lootbox_connections[user_id].append(websocket)
        print(f"Lootbox widget connected for user {user_id}. Total connections: {len(self.lootbox_connections.get(user_id, []))}")
    
    async def disconnect_lootbox_widget(self, websocket: WebSocket, user_id: str):
        if user_id in self.lootbox_connections and websocket in self.lootbox_connections[user_id]:
            self.lootbox_connections[user_id].remove(websocket)
            if not self.lootbox_connections[user_id]:  # Удаляем пустой список
                del self.lootbox_connections[user_id]
        print(f"Lootbox widget disconnected for user {user_id}")
    
    async def _send_to_connections(self, connections: List[WebSocket], message: Dict[str, Any]):
        """Отправить сообщение списку соединений"""
        if not connections:
            return
        
        disconnected = []
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                disconnected.append(connection)
        
        # Удаляем отключенные соединения
        for connection in disconnected:
            connections.remove(connection)
    
    async def send_chat_message(self, message_data: Dict[str, Any], user_id: str = None):
        """Отправить сообщение чата виджетам конкретного пользователя или всем"""
        message = {
            "type": "chat_message",
            "username": message_data.get("username", "Unknown"),
            "message": message_data.get("message", ""),
            "role": message_data.get("role", "normal"),
            "platform": message_data.get("platform", "twitch"),
            "timestamp": datetime.now().isoformat()
        }
        
        # Если указан user_id, отправляем только этому пользователю
        if user_id and user_id in self.chat_connections:
            await self._send_to_connections(self.chat_connections[user_id], message)
        elif not user_id:
            # Отправляем всем пользователям
            for user_connections in self.chat_connections.values():
                await self._send_to_connections(user_connections, message)
    
    async def send_lootbox_opened(self, lootbox_data: Dict[str, Any], user_id: str = None):
        """Отправить событие открытия лутбокса виджетам конкретного пользователя или всем"""
        message = {
            "type": "lootbox_opened",
            "username": lootbox_data.get("username", "Unknown"),
            "rarity": lootbox_data.get("rarity", "common"),
            "lootbox_type": lootbox_data.get("lootbox_type", "common"),
            "reward": lootbox_data.get("reward", ""),
            "timestamp": datetime.now().isoformat()
        }
        
        # Если указан user_id, отправляем только этому пользователю
        if user_id and user_id in self.lootbox_connections:
            await self._send_to_connections(self.lootbox_connections[user_id], message)
        elif not user_id:
            # Отправляем всем пользователям
            for user_connections in self.lootbox_connections.values():
                await self._send_to_connections(user_connections, message)
    
    async def broadcast_to_all(self, message_type: str, data: Dict[str, Any], user_id: str = None):
        """Отправить сообщение всем подключенным виджетам пользователя или всем"""
        message = {
            "type": message_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        if user_id:
            # Отправляем только конкретному пользователю
            if user_id in self.chat_connections:
                await self._send_to_connections(self.chat_connections[user_id], message)
            if user_id in self.lootbox_connections:
                await self._send_to_connections(self.lootbox_connections[user_id], message)
        else:
            # Отправляем всем пользователям
            for user_connections in self.chat_connections.values():
                await self._send_to_connections(user_connections, message)
            for user_connections in self.lootbox_connections.values():
                await self._send_to_connections(user_connections, message)
    
    def get_stats(self) -> Dict[str, Any]:
        """Получить статистику подключений"""
        total_chat = sum(len(connections) for connections in self.chat_connections.values())
        total_lootbox = sum(len(connections) for connections in self.lootbox_connections.values())
        
        return {
            "users_with_chat": len(self.chat_connections),
            "users_with_lootbox": len(self.lootbox_connections),
            "total_chat_connections": total_chat,
            "total_lootbox_connections": total_lootbox,
            "total_connections": total_chat + total_lootbox
        }

# Глобальный экземпляр менеджера
widget_manager = WidgetWebSocketManager()

# Функции для использования в других частях приложения
async def send_chat_message(username: str, message: str, role: str = "normal", platform: str = "twitch", user_id: str = None):
    """Отправить сообщение чата в виджеты конкретного пользователя или всех"""
    await widget_manager.send_chat_message({
        "username": username,
        "message": message,
        "role": role,
        "platform": platform
    }, user_id)

async def send_lootbox_opened(username: str, rarity: str, lootbox_type: str = None, reward: str = None, user_id: str = None):
    """Отправить событие открытия лутбокса в виджеты конкретного пользователя или всех"""
    await widget_manager.send_lootbox_opened({
        "username": username,
        "rarity": rarity,
        "lootbox_type": lootbox_type or rarity,
        "reward": reward
    }, user_id)

async def broadcast_event(event_type: str, data: Dict[str, Any], user_id: str = None):
    """Отправить событие виджетам конкретного пользователя или всех"""
    await widget_manager.broadcast_to_all(event_type, data, user_id)
