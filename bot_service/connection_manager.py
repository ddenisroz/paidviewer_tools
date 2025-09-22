# bot_service/connection_manager.py
import logging
import time
from typing import Dict, Set
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from datetime import datetime

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.obs_connections: Dict[str, WebSocket] = {}
        self.tts_enabled_channels: Set[str] = set()
        self.blocked_bots: Set[str] = set()
        self.youtube_queues: Dict[str, list] = {}
        self.current_videos: Dict[str, dict] = {}
        self.pending_verifications: Dict[str, dict] = {}  # Для верификации гостевых подключений
        
        # Кэш для Twitch API
        self.twitch_cache = {
            'categories': {},
            'streams': {},
            'last_update': 0
        }
        
        # Кэш для YouTube API
        self.youtube_cache = {
            'videos': {},
            'last_update': 0
        }

    @property
    def connected_users(self):
        """Возвращает список активных соединений для совместимости"""
        return self.active_connections

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connection established for user {user_id}")

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].close()
            except Exception as e:
                logger.warning(f"Error closing WebSocket for user {user_id}: {e}")
            del self.active_connections[user_id]
            logger.info(f"WebSocket connection closed for user {user_id}")

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
            except WebSocketDisconnect:
                await self.disconnect(user_id)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")

    async def broadcast(self, message: str):
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except WebSocketDisconnect:
                await self.disconnect(user_id)
            except Exception as e:
                logger.error(f"Error broadcasting message to user {user_id}: {e}")

    # OBS connections
    async def connect_obs(self, websocket: WebSocket, token: str):
        await websocket.accept()
        self.obs_connections[token] = websocket
        logger.info(f"OBS WebSocket connection established for token {token}")

    async def disconnect_obs(self, token: str):
        if token in self.obs_connections:
            try:
                await self.obs_connections[token].close()
            except Exception as e:
                logger.warning(f"Error closing OBS WebSocket for token {token}: {e}")
            del self.obs_connections[token]
            logger.info(f"OBS WebSocket connection closed for token {token}")

    async def send_obs_message(self, message: str, token: str):
        if token in self.obs_connections:
            try:
                await self.obs_connections[token].send_text(message)
            except WebSocketDisconnect:
                await self.disconnect_obs(token)
            except Exception as e:
                logger.error(f"Error sending OBS message to token {token}: {e}")

    # TTS management
    def enable_tts(self, channel_name: str):
        self.tts_enabled_channels.add(channel_name.lower())
        logger.info(f"TTS enabled for channel: {channel_name}")

    def disable_tts(self, channel_name: str):
        self.tts_enabled_channels.discard(channel_name.lower())
        logger.info(f"TTS disabled for channel: {channel_name}")

    def is_tts_enabled(self, channel_name: str) -> bool:
        return channel_name.lower() in self.tts_enabled_channels

    # Bot management
    def add_blocked_bot(self, bot_name: str):
        self.blocked_bots.add(bot_name.lower())
        logger.info(f"Bot blocked: {bot_name}")

    def remove_blocked_bot(self, bot_name: str):
        self.blocked_bots.discard(bot_name.lower())
        logger.info(f"Bot unblocked: {bot_name}")

    def is_bot_blocked(self, bot_name: str) -> bool:
        return bot_name.lower() in self.blocked_bots

    # YouTube queue management
    def add_to_youtube_queue(self, user_id: str, video_data: dict):
        if user_id not in self.youtube_queues:
            self.youtube_queues[user_id] = []
        self.youtube_queues[user_id].append(video_data)
        logger.info(f"Video added to queue for user {user_id}: {video_data.get('title', 'Unknown')}")

    def get_youtube_queue(self, user_id: str) -> list:
        return self.youtube_queues.get(user_id, [])

    def clear_youtube_queue(self, user_id: str):
        if user_id in self.youtube_queues:
            self.youtube_queues[user_id] = []
            logger.info(f"YouTube queue cleared for user {user_id}")

    def set_current_video(self, user_id: str, video_data: dict):
        self.current_videos[user_id] = video_data
        logger.info(f"Current video set for user {user_id}: {video_data.get('title', 'Unknown')}")

    def get_current_video(self, user_id: str) -> dict:
        return self.current_videos.get(user_id, {})

    def next_youtube_video(self, user_id: str):
        if user_id in self.youtube_queues and self.youtube_queues[user_id]:
            next_video = self.youtube_queues[user_id].pop(0)
            self.set_current_video(user_id, next_video)
            return next_video
        return None

    # Cache management
    def update_twitch_cache(self, key: str, data: dict):
        self.twitch_cache[key] = data
        self.twitch_cache['last_update'] = time.time()

    def get_twitch_cache(self, key: str, max_age: int = 300):
        if key in self.twitch_cache:
            if time.time() - self.twitch_cache['last_update'] < max_age:
                return self.twitch_cache[key]
        return None

    def update_youtube_cache(self, key: str, data: dict):
        self.youtube_cache[key] = data
        self.youtube_cache['last_update'] = time.time()

    def get_youtube_cache(self, key: str, max_age: int = 300):
        if key in self.youtube_cache:
            if time.time() - self.youtube_cache['last_update'] < max_age:
                return self.youtube_cache[key]
        return None

    # Методы для верификации гостевых подключений
    def add_verification(self, channel: str, code: str):
        """Добавляет код верификации для канала"""
        self.pending_verifications[channel] = {
            "code": code,
            "timestamp": time.time(),
            "verified": False
        }
        logger.info(f"Added verification code for channel {channel}: {code}")

    def check_verification(self, channel: str, message: str, username: str) -> bool:
        """Проверяет, содержит ли сообщение код верификации от владельца канала"""
        if channel not in self.pending_verifications:
            return False
        
        verification = self.pending_verifications[channel]
        
        # Проверяем, не истек ли код (60 секунд)
        if time.time() - verification["timestamp"] > 60:
            logger.info(f"Verification code expired for channel {channel}")
            del self.pending_verifications[channel]
            return False
        
        # Проверяем, что сообщение от владельца канала
        if username.lower() != channel.lower():
            logger.warning(f"Verification attempt from non-owner: {username} for channel {channel}")
            return False
        
        # Проверяем, содержит ли сообщение код
        if verification["code"] in message:
            verification["verified"] = True
            logger.info(f"Verification successful for channel {channel} by {username}")
            
            # Сохраняем в базу данных для персистентности
            self.save_verification_to_db(channel, verification["code"])
            
            return True
        
        return False

    def save_verification_to_db(self, channel: str, code: str):
        """Сохраняет данные верификации в базу данных"""
        try:
            from .database import get_db, GuestVerification
            db_gen = get_db()
            db = next(db_gen)
            try:
                # Создаем или обновляем запись верификации
                verification = db.query(GuestVerification).filter(
                    GuestVerification.channel_name == channel
                ).first()
                
                if verification:
                    verification.verification_code = code
                    verification.is_verified = True
                    verification.verified_at = datetime.utcnow()
                else:
                    verification = GuestVerification(
                        channel_name=channel,
                        verification_code=code,
                        is_verified=True,
                        verified_at=datetime.utcnow()
                    )
                    db.add(verification)
                
                db.commit()
                logger.info(f"Saved verification to database for channel: {channel}")
            finally:
                db.close()
            
        except Exception as e:
            logger.error(f"Failed to save verification to database: {e}")

    def load_verification_from_db(self, channel: str) -> bool:
        """Загружает данные верификации из базы данных"""
        try:
            from .database import get_db, GuestVerification
            db_gen = get_db()
            db = next(db_gen)
            try:
                verification = db.query(GuestVerification).filter(
                    GuestVerification.channel_name == channel,
                    GuestVerification.is_verified == True
                ).first()
                
                if verification:
                    # Восстанавливаем данные в памяти
                    self.pending_verifications[channel] = {
                        "channel": channel,
                        "code": verification.verification_code,
                        "timestamp": verification.verified_at.timestamp(),
                        "verified": True
                    }
                    logger.info(f"Loaded verification from database for channel: {channel}")
                    return True
                
                return False
            finally:
                db.close()
            
        except Exception as e:
            logger.error(f"Failed to load verification from database: {e}")
            return False

    def is_verified(self, channel: str) -> bool:
        """Проверяет, верифицирован ли канал"""
        if channel not in self.pending_verifications:
            # НЕ загружаем из базы данных автоматически
            # Данные из БД загружаются только при инициализации сервера
            return False
        
        verification = self.pending_verifications[channel]
        
        # Если пользователь уже верифицирован, возвращаем True без проверки таймаута
        # Активные сессии существуют до тех пор, пока не будут заменены новой верификацией
        if verification.get("verified", False):
            return True
        
        # Проверяем, не истек ли код только для неверифицированных пользователей (60 секунд)
        if time.time() - verification["timestamp"] > 60:
            del self.pending_verifications[channel]
            return False
        
        return verification["verified"]

    def cleanup_expired_verifications(self):
        """Очищает истекшие коды верификации"""
        current_time = time.time()
        expired_channels = []
        
        for channel, verification in self.pending_verifications.items():
            if current_time - verification["timestamp"] > 60:
                expired_channels.append(channel)
        
        for channel in expired_channels:
            del self.pending_verifications[channel]
            logger.info(f"Cleaned up expired verification for channel {channel}")
