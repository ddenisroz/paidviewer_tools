# bot_service/core/connection_manager.py
"""Главный файл ConnectionManager - объединяет все модули"""
import logging
from typing import List, TYPE_CHECKING
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from .connection_manager_core import ConnectionManagerCore

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
        logger.info("[FIX] Created global ConnectionManager instance")
    return _connection_manager_instance

class ConnectionManager(ConnectionManagerCore):
    """Главный класс управления соединениями"""

    def __init__(self):
        super().__init__()
        logger.info("[CONNECTION] ConnectionManager initialized")

    async def connect(self, websocket: WebSocket, user_id: str):
        """Подключить WebSocket"""
        try:
            await websocket.accept()
            self.active_connections[user_id] = websocket
            logger.info(f"WebSocket connected: {user_id}")
        except Exception as e:
            logger.error(f"Error connecting WebSocket: {e}")

    async def disconnect(self, user_id: str):
        """Отключить WebSocket"""
        try:
            if user_id in self.active_connections:
                websocket = self.active_connections[user_id]
                await websocket.close()
                del self.active_connections[user_id]
                logger.info(f"WebSocket disconnected: {user_id}")
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}")

    async def connect_obs(self, websocket: WebSocket, token: str):
        """Подключить OBS WebSocket"""
        try:
            await websocket.accept()
            self.obs_connections[token] = websocket
            logger.info(f"OBS WebSocket connected: {token[:10]}...")

            # [START] FIX: Отменяем отложенное отключение TTS при подключении OBS
            # Получаем user_id из токена
            from auth.auth import verify_jwt_token

            try:
                payload = verify_jwt_token(token)
                if payload and 'user_id' in payload:
                    user_id = payload['user_id']
                    self.cancel_tts_disconnect(user_id)
                    try:
                        from services.memory_websocket_manager import get_memory_websocket_manager
                        await get_memory_websocket_manager().sync_user_tts_generation(user_id)
                    except Exception as sync_error:
                        logger.warning(f"Failed to sync TTS generation after OBS connect: {sync_error}")
                    logger.info(f"[OK] [OBS CONNECT] Cancelled TTS disconnect for user {user_id} (OBS connected)")
            except Exception as e:
                logger.debug(f"Could not extract user_id from OBS token: {e}")

        except Exception as e:
            logger.error(f"Error connecting OBS WebSocket: {e}")

    async def disconnect_obs(self, token: str):
        """Отключить OBS WebSocket"""
        try:
            if token in self.obs_connections:
                websocket = self.obs_connections[token]
                await websocket.close()
                del self.obs_connections[token]
                logger.info(f"OBS WebSocket disconnected: {token[:10]}...")

                # [START] FIX: Планируем отключение TTS если нет других активных соединений
                # Получаем user_id из токена
                from auth.auth import verify_jwt_token
                from core.database import get_db, User

                try:
                    payload = verify_jwt_token(token)
                    if payload and 'user_id' in payload:
                        user_id = payload['user_id']
                        db = next(get_db())
                        try:
                            user = db.query(User).filter(User.id == user_id).first()
                            if user:
                                username = user.twitch_username or user.vk_username or f"user_{user_id}"
                                # Планируем отключение TTS только если нет других активных соединений
                                # Это будет проверено в _delayed_tts_disable
                                self.schedule_tts_disconnect(user_id, username)
                                try:
                                    from services.memory_websocket_manager import get_memory_websocket_manager
                                    await get_memory_websocket_manager().sync_user_tts_generation(user_id)
                                except Exception as sync_error:
                                    logger.warning(f"Failed to sync TTS generation after OBS disconnect: {sync_error}")
                                logger.info(f"⏱️ [OBS DISCONNECT] Scheduled TTS disconnect for user {user_id} (OBS disconnected)")
                        finally:
                            db.close()
                except Exception as e:
                    logger.debug(f"Could not extract user_id from OBS token: {e}")

        except Exception as e:
            logger.error(f"Error disconnecting OBS WebSocket: {e}")

    async def connect_audio(self, websocket: WebSocket, channel: str):
        """Подключить аудио WebSocket"""
        try:
            await websocket.accept()
            self.audio_connections[channel] = websocket
            logger.info(f"Audio WebSocket connected: {channel}")
        except Exception as e:
            logger.error(f"Error connecting audio WebSocket: {e}")

    async def disconnect_audio(self, channel: str):
        """Отключить аудио WebSocket"""
        try:
            if channel in self.audio_connections:
                websocket = self.audio_connections[channel]
                await websocket.close()
                del self.audio_connections[channel]
                logger.info(f"Audio WebSocket disconnected: {channel}")
        except Exception as e:
            logger.error(f"Error disconnecting audio WebSocket: {e}")

    async def send_to_user(self, user_id: str, message: dict):
        """Отправить сообщение пользователю"""
        try:
            if user_id in self.active_connections:
                websocket = self.active_connections[user_id]
                await websocket.send_json(message)
                logger.debug(f"Message sent to user {user_id}")
                return True
            else:
                logger.warning(f"User {user_id} not connected")
                return False
        except Exception as e:
            logger.error(f"Error sending message to user {user_id}: {e}")
            return False

    async def send_to_channel(self, channel: str, message: dict):
        """Отправить сообщение в канал"""
        try:
            if channel in self.audio_connections:
                websocket = self.audio_connections[channel]
                await websocket.send_json(message)
                logger.debug(f"Message sent to channel {channel}")
                return True
            else:
                logger.warning(f"Channel {channel} not connected")
                return False
        except Exception as e:
            logger.error(f"Error sending message to channel {channel}: {e}")
            return False

    async def broadcast(self, message: dict):
        """Отправить сообщение всем подключенным пользователям"""
        disconnected = []
        for user_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except WebSocketDisconnect:
                disconnected.append(user_id)
            except Exception as e:
                logger.error(f"Error broadcasting to user {user_id}: {e}")
                disconnected.append(user_id)

        # Удаляем отключенных пользователей
        for user_id in disconnected:
            del self.active_connections[user_id]
            logger.debug(f"Removed disconnected user: {user_id}")

    async def broadcast_settings_update(self, user_id: str, setting_type: str, settings: dict):
        """Broadcast settings update to user's connections"""
        message = {
            "type": f"{setting_type}_updated",
            "data": {
                "settings": settings
            }
        }
        await self.send_to_user(user_id, message)
        logger.debug(f"Broadcasted {setting_type} update to user {user_id}")

    async def broadcast_stream_info_update(self, user_id: str, platform: str, stream_info: dict):
        """Broadcast stream info update to user's connections"""
        message = {
            "type": "stream_info_updated",
            "data": {
                "platform": platform,
                "stream_info": stream_info
            }
        }
        await self.send_to_user(user_id, message)
        logger.debug(f"Broadcasted stream info update to user {user_id}")

    async def broadcast_tts_status_change(self, user_id: str, enabled: bool):
        """Broadcast TTS status change to user's connections"""
        message = {
            "type": "tts_status_changed",
            "data": {
                "enabled": enabled
            }
        }
        await self.send_to_user(user_id, message)
        logger.debug(f"Broadcasted TTS status change to user {user_id}: {enabled}")

    def register_client_connection(self, user_id: str, connection_type: str):
        """Зарегистрировать клиентское соединение"""
        logger.info(f"Client connection registered: {user_id} ({connection_type})")

    def unregister_client_connection(self, user_id: str, connection_type: str):
        """Отменить регистрацию клиентского соединения"""
        logger.info(f"Client connection unregistered: {user_id} ({connection_type})")

    async def restore_active_sessions_from_db(self, db: 'Session'):
        """Восстановить активные сессии из БД"""
        try:
            from core.database import UserSession

            # Получаем все активные сессии
            active_sessions = db.query(UserSession).filter(
                UserSession.is_active
            ).all()

            restored_count = 0
            for session in active_sessions:
                device_info = session.device_info or {}
                monitored_channel = device_info.get('monitored_channel')

                if monitored_channel:
                    # Добавляем сессию в connection manager
                    self.add_active_session(monitored_channel, session.session_id)
                    restored_count += 1
                    logger.info(f"Restored session {session.session_id} for channel {monitored_channel}")

            logger.info(f"Restored {restored_count} active sessions from database")

        except Exception as e:
            logger.error(f"Error restoring sessions from DB: {e}")

    async def get_twitch_channels_for_bot(self, db: 'Session') -> List[str]:
        """Получить список Twitch каналов для бота (бот слушает ВСЕ каналы, tts_enabled проверяется отдельно)"""
        try:
            # Получаем ВСЕ каналы с активным Twitch токеном
            from core.database import User, UserToken

            # Ищем пользователей с активным Twitch токеном
            twitch_users = db.query(User).join(UserToken).filter(
                UserToken.platform == 'twitch',
                UserToken.is_active.is_(True),
                User.twitch_username.isnot(None)
            ).all()

            twitch_channels = []
            for user in twitch_users:
                if user.twitch_username:
                    twitch_channels.append(user.twitch_username.lower())

            logger.info(f"[GAME] Found {len(twitch_channels)} Twitch channels to listen: {twitch_channels}")
            return twitch_channels
        except Exception as e:
            logger.error(f"Error getting Twitch channels: {e}", exc_info=True)
            return []

    async def get_vk_channels_for_bot(self, db: 'Session') -> List[str]:
        """Получить список VK Live каналов для бота (бот слушает ВСЕ каналы, tts_enabled проверяется отдельно)"""
        try:
            # Получаем ВСЕ каналы с активным VK токеном
            from core.database import User, UserToken
            from sqlalchemy import or_
            # Ищем пользователей с активным VK токеном
            vk_users = db.query(User).join(UserToken).filter(
                UserToken.platform == 'vk',
                UserToken.is_active.is_(True),
                or_(User.vk_channel_name.isnot(None), User.vk_username.isnot(None))
            ).all()

            vk_channels = []
            for user in vk_users:
                # Используем vk_channel_name как основной идентификатор канала
                channel_name = user.vk_channel_name or user.vk_username
                if user.vk_channel_name and user.vk_username and user.vk_channel_name.lower() != user.vk_username.lower():
                    logger.info(
                        "[VK] User %s: using vk_channel_name='%s' (vk_username='%s')",
                        user.id,
                        user.vk_channel_name,
                        user.vk_username,
                    )
                if channel_name:
                    candidate = channel_name.strip()
                    if ' ' in candidate:
                        logger.warning(f"[VK] Skipping invalid channel name with spaces: {candidate}")
                        continue
                    vk_channels.append(candidate)

            logger.info(f"Found {len(vk_channels)} VK Live channels to listen (channel slugs): {vk_channels}")
            return vk_channels
        except Exception as e:
            logger.error(f"Error getting VK channels: {e}", exc_info=True)
            return []

    async def cleanup_inactive_channels(self):
        """Очистка неактивных каналов"""
        try:
            # Логика очистки неактивных каналов
            logger.debug("Cleaning up inactive channels")
        except Exception as e:
            logger.error(f"Error cleaning up inactive channels: {e}")

    async def cleanup_inactive_clients(self):
        """Очистка неактивных клиентов"""
        try:
            # Логика очистки неактивных клиентов
            logger.debug("Cleaning up inactive clients")
        except Exception as e:
            logger.error(f"Error cleaning up inactive clients: {e}")

    def cleanup(self):
        """Очистка ресурсов"""
        try:
            # Закрываем все соединения
            for websocket in self.active_connections.values():
                try:
                    # websocket.close() - синхронный метод
                    pass
                except Exception:
                    pass

            self.active_connections.clear()
            self.obs_connections.clear()
            self.youtube_obs_connections.clear()
            self.audio_connections.clear()
            self.active_sessions.clear()

            logger.info("ConnectionManager cleanup completed")
        except Exception as e:
            logger.error(f"Error during ConnectionManager cleanup: {e}")

