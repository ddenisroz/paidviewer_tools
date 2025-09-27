# bot_service/connection_manager.py
import logging
import time
import json
from typing import Dict, Set, List, TYPE_CHECKING
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from datetime import datetime

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Глобальный экземпляр ConnectionManager (синглтон)
_connection_manager_instance = None

def get_connection_manager():
    """Возвращает глобальный экземпляр ConnectionManager (синглтон)"""
    global _connection_manager_instance
    if _connection_manager_instance is None:
        _connection_manager_instance = ConnectionManager()
        logger.info("🔧 Created global ConnectionManager instance")
    return _connection_manager_instance

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.obs_connections: Dict[str, WebSocket] = {}
        self.youtube_obs_connections: Dict[str, WebSocket] = {}  # YouTube OBS connections
        self.tts_enabled_channels: Set[str] = set()  # Глобальные каналы с TTS
        self.tts_enabled_twitch: Set[str] = set()    # Twitch каналы с TTS
        self.tts_enabled_vk: Set[str] = set()        # VK Live каналы с TTS
        self.blocked_bots: Set[str] = set()
        self.youtube_queues: Dict[str, list] = {}
        self.current_videos: Dict[str, dict] = {}
        self.pending_verifications: Dict[str, dict] = {}  # Для верификации гостевых подключений
        self.verified_sessions: Set[str] = set()  # Отслеживаем верифицированные сессии
        self.active_vk_bots: Dict[str, dict] = {}  # Реестр активных VK ботов
        self.active_sessions: Dict[str, set] = {}  # Активные сессии по каналам {channel: {session_ids}}
        self.tts_volume_settings: Dict[str, float] = {}  # {channel_name: volume_level}
        self.voice_volume_settings: Dict[str, Dict[str, float]] = {}  # {channel_name: {voice_name: volume_level}}
        self.youtube_settings: Dict[str, dict] = {}  # {channel_name: {playback_mode, volume_level}}
        
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
                websocket = self.active_connections[user_id]
                # Проверяем состояние WebSocket перед закрытием
                if hasattr(websocket, 'client_state') and websocket.client_state.name == 'CONNECTED':
                    await websocket.close()
            except Exception as e:
                # Игнорируем ошибки закрытия WebSocket, так как соединение может быть уже закрыто
                logger.debug(f"WebSocket already closed for user {user_id}: {e}")
            finally:
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

    # YouTube events
    async def broadcast_youtube_event(self, event_type: str, data: dict = None):
        """Отправляет событие YouTube всем подключенным пользователям"""
        message = {
            "type": "youtube_event",
            "event": event_type,
            "data": data or {}
        }
        await self.broadcast(json.dumps(message))
        logger.info(f"YouTube event broadcasted: {event_type}")

    async def send_youtube_event_to_user(self, user_id: str, event_type: str, data: dict = None):
        """Отправляет событие YouTube конкретному пользователю"""
        message = {
            "type": "youtube_event",
            "event": event_type,
            "data": data or {}
        }
        await self.send_personal_message(json.dumps(message), user_id)
        logger.info(f"YouTube event sent to user {user_id}: {event_type}")

    # OBS connections
    async def connect_obs(self, websocket: WebSocket, token: str):
        await websocket.accept()
        self.obs_connections[token] = websocket
        logger.info(f"OBS WebSocket connection established for token {token}")

    async def disconnect_obs(self, token: str):
        if token in self.obs_connections:
            try:
                websocket = self.obs_connections[token]
                # Проверяем состояние WebSocket перед закрытием
                if hasattr(websocket, 'client_state') and websocket.client_state.name == 'CONNECTED':
                    await websocket.close()
            except Exception as e:
                # Игнорируем ошибки закрытия WebSocket
                logger.debug(f"OBS WebSocket already closed for token {token}: {e}")
            finally:
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

    # YouTube OBS management
    async def connect_youtube_obs(self, websocket: WebSocket, token: str):
        await websocket.accept()
        self.youtube_obs_connections[token] = websocket
        logger.info(f"YouTube OBS WebSocket connection established for token {token}")

    async def disconnect_youtube_obs(self, token: str):
        if token in self.youtube_obs_connections:
            try:
                websocket = self.youtube_obs_connections[token]
                if hasattr(websocket, 'client_state') and websocket.client_state.name == 'CONNECTED':
                    await websocket.close()
            except Exception as e:
                logger.debug(f"YouTube OBS WebSocket already closed for token {token}: {e}")
            finally:
                del self.youtube_obs_connections[token]
                logger.info(f"YouTube OBS WebSocket connection closed for token {token}")

    async def send_youtube_obs_message(self, message: str, token: str):
        """Отправить сообщение в YouTube OBS WebSocket"""
        if token in self.youtube_obs_connections:
            try:
                await self.youtube_obs_connections[token].send_text(message)
            except WebSocketDisconnect:
                await self.disconnect_youtube_obs(token)
            except Exception as e:
                logger.error(f"Error sending YouTube OBS message to token {token}: {e}")

    async def send_youtube_to_obs(self, channel_name: str, action: str, data: dict = None):
        """Отправить YouTube команду в OBS для канала"""
        try:
            # Получаем настройки YouTube для канала
            youtube_settings = self.get_youtube_settings(channel_name)
            
            if youtube_settings.get("playback_mode") != "obs":
                logger.debug(f"YouTube playback mode is not OBS for channel {channel_name}, skipping OBS send")
                return
            
            # Формируем сообщение
            message_data = {
                "type": f"youtube_{action}",
                "channel": channel_name,
                "volume": youtube_settings.get("volume_level", 50.0),
                **(data if data else {})
            }
            
            # Отправляем всем YouTube OBS подключениям
            message = json.dumps(message_data)
            disconnected_tokens = []
            
            for token, websocket in self.youtube_obs_connections.items():
                try:
                    await websocket.send_text(message)
                    logger.debug(f"YouTube OBS message sent to {token}: {action}")
                except Exception as e:
                    logger.error(f"Error sending YouTube OBS message to {token}: {e}")
                    disconnected_tokens.append(token)
            
            # Удаляем отключенные соединения
            for token in disconnected_tokens:
                await self.disconnect_youtube_obs(token)
                
        except Exception as e:
            logger.error(f"Error sending YouTube to OBS for channel {channel_name}: {e}")

    # TTS management
    def enable_tts(self, channel_name: str, platform: str = None):
        """Включить TTS для канала (глобально или для конкретной платформы)"""
        channel_lower = channel_name.lower()
        self.tts_enabled_channels.add(channel_lower)
        
        if platform == 'twitch':
            self.tts_enabled_twitch.add(channel_lower)
            logger.info(f"TTS enabled for Twitch channel: {channel_name}")
        elif platform == 'vk':
            self.tts_enabled_vk.add(channel_lower)
            logger.info(f"TTS enabled for VK Live channel: {channel_name}")
        else:
            logger.info(f"TTS enabled for channel: {channel_name}")

    def disable_tts(self, channel_name: str, platform: str = None):
        """Отключить TTS для канала (глобально или для конкретной платформы)"""
        channel_lower = channel_name.lower()
        self.tts_enabled_channels.discard(channel_lower)
        
        if platform == 'twitch':
            self.tts_enabled_twitch.discard(channel_lower)
            logger.info(f"TTS disabled for Twitch channel: {channel_name}")
        elif platform == 'vk':
            self.tts_enabled_vk.discard(channel_lower)
            logger.info(f"TTS disabled for VK Live channel: {channel_name}")
        else:
            logger.info(f"TTS disabled for channel: {channel_name}")

    def is_tts_enabled(self, channel_name: str, platform: str = None) -> bool:
        """Проверить, включен ли TTS для канала"""
        channel_lower = channel_name.lower()
        
        if platform == 'twitch':
            return channel_lower in self.tts_enabled_twitch
        elif platform == 'vk':
            return channel_lower in self.tts_enabled_vk
        else:
            return channel_lower in self.tts_enabled_channels
    
    def is_channel_whitelisted(self, channel_name: str) -> bool:
        """Проверяет, находится ли канал в whitelist для TTS"""
        try:
            from core.database import get_db, WhitelistedChannel
            from sqlalchemy import func
            db = next(get_db())
            try:
                whitelisted = db.query(WhitelistedChannel).filter(
                    func.lower(WhitelistedChannel.channel_name) == channel_name.lower()
                ).first()
                return whitelisted is not None and whitelisted.is_enabled
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error checking whitelist for channel {channel_name}: {e}")
            return False

    # Bot management
    def add_blocked_bot(self, bot_name: str):
        self.blocked_bots.add(bot_name.lower())
        logger.info(f"Bot blocked: {bot_name}")

    def remove_blocked_bot(self, bot_name: str):
        self.blocked_bots.discard(bot_name.lower())
        logger.info(f"Bot unblocked: {bot_name}")

    def is_bot_blocked(self, bot_name: str) -> bool:
        return bot_name.lower() in self.blocked_bots

    # TTS Volume management
    def set_tts_volume(self, channel_name: str, volume_level: float):
        """Установить громкость TTS для канала"""
        channel_lower = channel_name.lower()
        self.tts_volume_settings[channel_lower] = max(0.0, min(100.0, volume_level))  # Ограничиваем 0-100%
        logger.info(f"TTS volume set for channel {channel_name}: {volume_level}%")

    def get_tts_volume(self, channel_name: str, voice_name: str = None) -> float:
        """Получить громкость TTS для канала (с учетом приоритета кастомных голосов)"""
        channel_lower = channel_name.lower()
        
        # Если указан голос, проверяем индивидуальную настройку (приоритет)
        if voice_name and channel_lower in self.voice_volume_settings:
            voice_volume = self.voice_volume_settings[channel_lower].get(voice_name)
            if voice_volume is not None:
                logger.debug(f"Using custom voice volume for {channel_name}.{voice_name}: {voice_volume}%")
                return voice_volume
        
        # Иначе используем общую громкость канала
        general_volume = self.tts_volume_settings.get(channel_lower, 50.0)
        logger.debug(f"Using general volume for {channel_name}: {general_volume}%")
        return general_volume

    def set_voice_volume(self, channel_name: str, voice_name: str, volume_level: float):
        """Установить индивидуальную громкость для кастомного голоса (приоритет выше общей)"""
        channel_lower = channel_name.lower()
        
        if channel_lower not in self.voice_volume_settings:
            self.voice_volume_settings[channel_lower] = {}
        
        self.voice_volume_settings[channel_lower][voice_name] = max(0.0, min(100.0, volume_level))
        logger.info(f"Custom voice volume set for {channel_name}.{voice_name}: {volume_level}%")

    def get_voice_volume(self, channel_name: str, voice_name: str) -> float:
        """Получить индивидуальную громкость для кастомного голоса"""
        channel_lower = channel_name.lower()
        
        if channel_lower in self.voice_volume_settings:
            return self.voice_volume_settings[channel_lower].get(voice_name, 50.0)
        
        return 50.0

    def load_tts_volume_from_db(self, db: 'Session'):
        """Загрузить настройки громкости TTS из базы данных"""
        try:
            from core.database import TTSSettings
            
            # Загружаем все настройки TTS из базы данных
            tts_settings_list = db.query(TTSSettings).all()
            
            for tts_settings in tts_settings_list:
                if tts_settings.voice_settings:
                    volume_level = tts_settings.voice_settings.get("volume_level", 50.0)
                    channel_name = tts_settings.channel_name
                    
                    # Загружаем общую громкость
                    self.set_tts_volume(channel_name, volume_level)
                    
                    # Загружаем индивидуальные громкости кастомных голосов
                    custom_volumes = tts_settings.voice_settings.get("custom_voice_volumes", {})
                    for voice_name, voice_volume in custom_volumes.items():
                        self.set_voice_volume(channel_name, voice_name, voice_volume)
            
            logger.info(f"TTS volume settings loaded from database: {len(tts_settings_list)} channels")
        except Exception as e:
            logger.error(f"Error loading TTS volume settings from database: {e}")

    def set_youtube_settings(self, channel_name: str, playback_mode: str, volume_level: float):
        """Установить настройки YouTube для канала"""
        channel_lower = channel_name.lower()
        self.youtube_settings[channel_lower] = {
            "playback_mode": playback_mode,  # browser или obs
            "volume_level": max(0.0, min(100.0, volume_level))
        }
        logger.info(f"YouTube settings set for channel {channel_name}: {playback_mode} mode, volume {volume_level}%")

    def get_youtube_settings(self, channel_name: str) -> dict:
        """Получить настройки YouTube для канала"""
        channel_lower = channel_name.lower()
        return self.youtube_settings.get(channel_lower, {
            "playback_mode": "browser",
            "volume_level": 50.0
        })

    def load_youtube_settings_from_db(self, db: 'Session'):
        """Загрузить настройки YouTube из базы данных"""
        try:
            from core.database import TTSSettings
            
            tts_settings_list = db.query(TTSSettings).all()
            
            for tts_settings in tts_settings_list:
                if tts_settings.voice_settings:
                    playback_mode = tts_settings.voice_settings.get("youtube_playback_mode", "browser")
                    volume_level = tts_settings.voice_settings.get("youtube_volume", 50.0)
                    channel_name = tts_settings.channel_name
                    
                    self.set_youtube_settings(channel_name, playback_mode, volume_level)
            
            logger.info(f"YouTube settings loaded from database: {len(tts_settings_list)} channels")
        except Exception as e:
            logger.error(f"Error loading YouTube settings from database: {e}")

    def initialize_from_db(self, db: 'Session'):
        """Инициализировать ConnectionManager из базы данных при запуске"""
        try:
            self.load_tts_volume_from_db(db)
            self.load_youtube_settings_from_db(db)
            logger.info("ConnectionManager initialized from database")
        except Exception as e:
            logger.error(f"Error initializing ConnectionManager from database: {e}")

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
            # Добавляем сессию в верифицированные
            self.verified_sessions.add(channel)
            logger.info(f"Verification successful for channel {channel} by {username}")
            
            # Затираем все предыдущие сессии для этого канала (и авторизованные, и гостевые)
            try:
                # Используем локальный импорт для избежания циклических зависимостей
                self._create_guest_session_for_channel(channel, "twitch")
            except Exception as e:
                logger.error(f"Failed to create guest session for {channel}: {e}")
            
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
                    # Восстанавливаем данные в памяти, но НЕ помечаем как verified
                    # Это позволяет требовать новую верификацию для новых сессий
                    self.pending_verifications[channel] = {
                        "channel": channel,
                        "code": verification.verification_code,
                        "timestamp": verification.verified_at.timestamp(),
                        "verified": False  # Всегда False для новых сессий
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
        """Проверяет, верифицирован ли канал для текущей сессии"""
        # Проверяем, есть ли канал в верифицированных сессиях
        return channel in self.verified_sessions
    
    def verify_channel(self, channel: str):
        """Отмечает канал как верифицированный"""
        self.verified_sessions.add(channel)
        logger.info(f"Channel {channel} marked as verified")
    
    def clear_verified_session(self, channel: str):
        """Очищает верифицированную сессию для канала"""
        self.verified_sessions.discard(channel)
        logger.info(f"Cleared verified session for channel: {channel}")

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
    
    async def notify_session_terminated(self, user_id: str, reason: str = "new_login", platform: str = None):
        """Уведомить пользователя о завершении сессии"""
        message = {
            "type": "session_terminated",
            "data": {
                "reason": reason,
                "platform": platform,
                "message": "Вы вошли с другого устройства" if reason == "new_login" else "Сессия завершена"
            }
        }
        
        # Отправляем уведомление всем активным соединениям пользователя
        for connection_id, websocket in self.active_connections.items():
            if connection_id.startswith(f"{user_id}_"):
                try:
                    await websocket.send_json(message)
                    logger.info(f"Sent session termination notification to {connection_id}")
                except Exception as e:
                    logger.error(f"Error sending session termination notification: {e}")
    
    async def notify_guest_session_terminated(self, channel_name: str, reason: str = "guest_login"):
        """Уведомить о завершении гостевой сессии"""
        message = {
            "type": "session_terminated",
            "data": {
                "reason": reason,
                "platform": "guest",
                "message": "Гостевой вход с верификацией" if reason == "guest_login" else "Гостевая сессия завершена"
            }
        }
        
        # Отправляем уведомление всем активным соединениям канала
        for connection_id, websocket in self.active_connections.items():
            if connection_id.startswith(f"{channel_name}_"):
                try:
                    await websocket.send_json(message)
                    logger.info(f"Sent guest session termination notification to {connection_id}")
                except Exception as e:
                    logger.error(f"Error sending guest session termination notification: {e}")

    async def notify_all_sessions_terminated_for_channel(self, channel_name: str, reason: str = "new_login"):
        """Уведомить о завершении всех сессий для канала"""
        message = {
            "type": "all_sessions_terminated",
            "data": {
                "reason": reason,
                "channel": channel_name,
                "message": f"Все сессии для канала {channel_name} завершены"
            }
        }
        
        # Отправляем уведомление всем активным соединениям канала
        for connection_id, websocket in self.active_connections.items():
            if connection_id.startswith(f"{channel_name}_"):
                try:
                    await websocket.send_json(message)
                    logger.info(f"Sent all sessions termination notification to {connection_id}")
                except Exception as e:
                    logger.error(f"Error sending all sessions termination notification: {e}")

    def _create_guest_session_for_channel(self, channel: str, platform: str):
        """Вспомогательный метод для создания гостевой сессии"""
        try:
            from .session_manager import session_manager
            session_manager.terminate_all_sessions_for_channel(
                channel_name=channel,
                reason=f"new_{platform}_guest_login"
            )
            
            # Создаем гостевую сессию
            session_id = session_manager.create_guest_session(
                channel_name=channel,
                platform=platform
            )
            logger.info(f"Created guest session {session_id} for {platform} channel {channel}")
        except Exception as e:
            logger.error(f"Error in _create_guest_session_for_channel: {e}")
            raise
    
    # Session management for bot connections
    def add_active_session(self, channel_name: str, session_id: str):
        """Добавить активную сессию для канала"""
        channel_lower = channel_name.lower()
        if channel_lower not in self.active_sessions:
            self.active_sessions[channel_lower] = set()
        self.active_sessions[channel_lower].add(session_id)
        logger.info(f"Added active session {session_id} for channel {channel_name}")
    
    def remove_active_session(self, channel_name: str, session_id: str):
        """Удалить активную сессию для канала"""
        channel_lower = channel_name.lower()
        if channel_lower in self.active_sessions:
            self.active_sessions[channel_lower].discard(session_id)
            if not self.active_sessions[channel_lower]:  # Если больше нет активных сессий
                del self.active_sessions[channel_lower]
                logger.info(f"Removed last active session for channel {channel_name}")
            else:
                logger.info(f"Removed active session {session_id} for channel {channel_name}")
    
    def has_active_sessions(self, channel_name: str) -> bool:
        """Проверить, есть ли активные сессии для канала"""
        channel_lower = channel_name.lower()
        return channel_lower in self.active_sessions and len(self.active_sessions[channel_lower]) > 0
    
    def restore_active_sessions_from_db(self, db: "Session"):
        """Восстановить активные сессии из базы данных"""
        try:
            logger.info("🔄 Starting to restore active sessions from database...")
            from core.database import UserSession
            
            # Получаем все активные сессии из БД
            active_sessions = db.query(UserSession).filter_by(is_active=True).all()
            logger.info(f"📊 Found {len(active_sessions)} active sessions in database")
            
            restored_count = 0
            for session in active_sessions:
                logger.info(f"🔍 Processing session {session.session_id}: {session.device_info}")
                # Извлекаем имя канала из device_info
                device_info = session.device_info
                if isinstance(device_info, dict):
                    channel_name = device_info.get('guest_channel')
                    logger.info(f"📺 Channel name from device_info: {channel_name}")
                    if channel_name:
                        self.add_active_session(channel_name, session.session_id)
                        restored_count += 1
                        logger.info(f"✅ Restored active session {session.session_id} for channel {channel_name}")
                    else:
                        logger.warning(f"⚠️ No guest_channel found in device_info: {device_info}")
                else:
                    logger.warning(f"⚠️ device_info is not a dict: {type(device_info)} - {device_info}")
            
            logger.info(f"🎉 Successfully restored {restored_count} active sessions from database")
            
        except Exception as e:
            logger.error(f"❌ Error restoring active sessions from database: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
    
    def get_active_channels(self) -> List[str]:
        """Получить список каналов с активными сессиями"""
        return list(self.active_sessions.keys())
    
    def get_active_twitch_channels(self, db: "Session") -> List[str]:
        """Получить список только Twitch каналов с активными сессиями"""
        try:
            from core.database import UserToken
            active_channels = list(self.active_sessions.keys())
            twitch_channels = []
            
            for channel_name in active_channels:
                # Проверяем, есть ли этот канал в базе как Twitch канал
                user_token = db.query(UserToken).filter(
                    UserToken.platform_display_name.ilike(channel_name),
                    UserToken.platform == 'twitch'
                ).first()
                
                if user_token:
                    twitch_channels.append(channel_name)
                    logger.info(f"✅ Found Twitch channel: {channel_name}")
                else:
                    logger.info(f"⏭️ Skipping non-Twitch channel: {channel_name}")
            
            return twitch_channels
            
        except Exception as e:
            logger.error(f"Error filtering Twitch channels: {e}")
            # В случае ошибки возвращаем пустой список, чтобы не подключаться к неизвестным каналам
            return []
    
    async def cleanup_inactive_channels(self):
        """Очистка каналов без активных сессий"""
        try:
            # Получаем список каналов, к которым подключен бот
            connected_channels = set()
            
            # Для Twitch бота
            if hasattr(self, 'twitch_bot') and self.twitch_bot:
                connected_channels.update(self.twitch_bot.connected_channels)
            
            # Для VK Live ботов
            for channel_name in self.active_vk_bots.keys():
                connected_channels.add(channel_name)
            
            # Отключаем ботов от каналов без активных сессий
            for channel in connected_channels:
                if not self.has_active_sessions(channel):
                    logger.info(f"Channel {channel} has no active sessions, disconnecting bots...")
                    
                    # Отключаем Twitch бота
                    if hasattr(self, 'twitch_bot') and self.twitch_bot:
                        try:
                            await self.twitch_bot.leave_channel(channel)
                            logger.info(f"Disconnected Twitch bot from {channel}")
                        except Exception as e:
                            logger.error(f"Error disconnecting Twitch bot from {channel}: {e}")
                    
                    # Отключаем VK Live бота
                    if channel in self.active_vk_bots:
                        try:
                            vk_bot_data = self.active_vk_bots[channel]
                            if 'bot' in vk_bot_data:
                                await vk_bot_data['bot'].stop_bot()
                                del self.active_vk_bots[channel]
                                logger.info(f"Disconnected VK Live bot from {channel}")
                        except Exception as e:
                            logger.error(f"Error disconnecting VK Live bot from {channel}: {e}")
                            
        except Exception as e:
            logger.error(f"Error in cleanup_inactive_channels: {e}")

    def get_active_twitch_channels(self, db):
        """Получить список активных Twitch каналов для подключения бота"""
        try:
            from core.database import UserToken
            
            # Получаем все активные Twitch токены
            twitch_tokens = db.query(UserToken).filter(
                UserToken.platform == "twitch"
            ).all()
            
            # Извлекаем имена каналов
            channels = []
            for token in twitch_tokens:
                if token.platform_display_name:
                    channels.append(token.platform_display_name.lower())
            
            logger.info(f"Found {len(channels)} Twitch channels: {channels}")
            return channels
            
        except Exception as e:
            logger.error(f"Error getting active Twitch channels: {e}")
            return []

