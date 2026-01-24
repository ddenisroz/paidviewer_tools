# bot_service/core/connection_manager_core.py
"""Основная логика ConnectionManager"""
import logging
import asyncio
from typing import Dict, Set, List, TYPE_CHECKING, Any
from fastapi import WebSocket

# Импортируем константы для таймаутов
from constants import TTS_RECONNECT_TIMEOUT_SECONDS

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

class ConnectionManagerCore:
    """Основная логика управления соединениями"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.obs_connections: Dict[str, WebSocket] = {}
        self.youtube_obs_connections: Dict[str, WebSocket] = {}
        self.audio_connections: Dict[str, WebSocket] = {}
        self.tts_enabled_channels: Set[str] = set()
        self.tts_enabled_twitch: Set[str] = set()
        self.tts_enabled_vk: Set[str] = set()

        # Новая система: два типа TTS
        self.basic_tts_enabled_channels: Set[str] = set()
        self.ai_tts_enabled_channels: Set[str] = set()

        self.blocked_bots: Set[str] = set()
        self.youtube_queues: Dict[str, list] = {}
        self.current_videos: Dict[str, dict] = {}
        self.pending_verifications: Dict[str, dict] = {}
        self.verified_sessions: Set[str] = set()
        self.active_vk_bots: Dict[str, dict] = {}
        self.active_sessions: Dict[str, set] = {}
        self.tts_volume_settings: Dict[str, float] = {}
        self.voice_volume_settings: Dict[str, Dict[str, float]] = {}
        self.youtube_settings: Dict[str, dict] = {}
        self.twitch_cache: Dict[str, Any] = {}

        # Отложенные отключения TTS (user_id -> asyncio.Task)
        self.pending_tts_disconnects: Dict[int, asyncio.Task] = {}
        # Таймаут ожидания переподключения (в секундах)
        # Используем константу из constants.py (настраивается через env переменную)
        self.reconnect_timeout: int = TTS_RECONNECT_TIMEOUT_SECONDS

    def add_active_session(self, channel_name: str, session_id: str, platform: str = "twitch"):
        """Добавить активную сессию и отменить запланированное отключение TTS"""
        if channel_name not in self.active_sessions:
            self.active_sessions[channel_name] = set()
        self.active_sessions[channel_name].add(session_id)
        logger.debug(f"Added session {session_id} to channel {channel_name} ({platform})")

        # Отменяем запланированное отключение TTS если бот переподключился
        try:
            from core.database import get_db, User
            db = next(get_db())
            try:
                user = db.query(User).filter(
                    (User.twitch_username == channel_name.lower()) |
                    (User.vk_username == channel_name.lower()) |
                    (User.vk_channel_name == channel_name.lower())
                ).first()

                if user:
                    logger.info(f"[OK] [TTS RECONNECT] Bot reconnected to {channel_name}, cancelling TTS disconnect for user {user.id}")
                    self.cancel_tts_disconnect(user.id)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[ERROR] [TTS RECONNECT] Error cancelling TTS disconnect for {channel_name}: {e}")

    def remove_active_session(self, channel_name: str, reason: str = "disconnect") -> bool:
        """Удалить активную сессию и запустить таймер отключения TTS если это была последняя сессия"""
        if channel_name in self.active_sessions:
            sessions = self.active_sessions[channel_name]
            if sessions:
                session_id = sessions.pop()
                logger.debug(f"Removed session {session_id} from channel {channel_name} ({reason})")

                # Если это была последняя сессия канала, запускаем таймер отключения TTS
                if not sessions:  # Пустое множество
                    del self.active_sessions[channel_name]
                    logger.info(f"[TIMER] [SESSION] Last session removed for {channel_name}, checking TTS disconnect")
                    self._schedule_tts_disconnect_for_channel(channel_name)

                return True
            else:
                del self.active_sessions[channel_name]
                logger.debug(f"Removed empty channel {channel_name} ({reason})")
                self._schedule_tts_disconnect_for_channel(channel_name)
                return True
        return False

    def _schedule_tts_disconnect_for_channel(self, channel_name: str):
        """Запланировать отключение TTS для канала (найти пользователя по имени канала)"""
        try:
            from core.database import get_db, User
            db = next(get_db())
            try:
                # Ищем пользователя по Twitch username или VK channel name/username
                user = db.query(User).filter(
                    (User.twitch_username == channel_name.lower()) |
                    (User.vk_username == channel_name.lower()) |
                    (User.vk_channel_name == channel_name.lower())
                ).first()

                if user:
                    logger.info(f"[TIMER] [TTS DISCONNECT] Found user {user.id} for channel {channel_name}")
                    self.schedule_tts_disconnect(user.id, channel_name)
                else:
                    logger.warning(f"[WARN] [TTS DISCONNECT] User not found for channel {channel_name}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[ERROR] [TTS DISCONNECT] Error scheduling TTS disconnect for {channel_name}: {e}")

    def get_active_channels(self) -> List[str]:
        """Получить список активных каналов"""
        return list(self.active_sessions.keys())

    def get_active_sessions(self) -> Dict[str, set]:
        """Получить активные сессии"""
        return self.active_sessions.copy()

    def is_channel_active(self, channel_name: str) -> bool:
        """Проверить активность канала"""
        return channel_name in self.active_sessions and len(self.active_sessions[channel_name]) > 0

    def get_channel_session_count(self, channel_name: str) -> int:
        """Получить количество сессий канала"""
        return len(self.active_sessions.get(channel_name, set()))

    def enable_tts_for_channel(self, channel_name: str, tts_type: str = "basic"):
        """Включить TTS для канала"""
        if tts_type == "basic":
            self.basic_tts_enabled_channels.add(channel_name)
        elif tts_type == "ai":
            self.ai_tts_enabled_channels.add(channel_name)

        self.tts_enabled_channels.add(channel_name)
        logger.info(f"TTS enabled for channel {channel_name} (type: {tts_type})")

    def disable_tts_for_channel(self, channel_name: str):
        """Отключить TTS для канала"""
        self.basic_tts_enabled_channels.discard(channel_name)
        self.ai_tts_enabled_channels.discard(channel_name)
        self.tts_enabled_channels.discard(channel_name)
        logger.info(f"TTS disabled for channel {channel_name}")

    def is_tts_enabled(self, channel_name: str) -> bool:
        """Проверить включен ли TTS для канала"""
        is_enabled = channel_name in self.tts_enabled_channels
        logger.warning(f"[DEBUG] [TTS CHECK] is_tts_enabled('{channel_name}') = {is_enabled}")
        logger.warning(f"[DEBUG] [TTS CHECK] Current tts_enabled_channels: {self.tts_enabled_channels}")
        logger.warning(f"[DEBUG] [TTS CHECK] Current tts_enabled_twitch: {self.tts_enabled_twitch}")
        logger.warning(f"[DEBUG] [TTS CHECK] Current tts_enabled_vk: {self.tts_enabled_vk}")
        return is_enabled

    def get_tts_type(self, channel_name: str) -> str:
        """Получить тип TTS для канала"""
        if channel_name in self.ai_tts_enabled_channels:
            return "ai"
        elif channel_name in self.basic_tts_enabled_channels:
            return "basic"
        return "none"

    def set_tts_volume(self, channel_name: str, volume: float):
        """Установить громкость TTS для канала"""
        self.tts_volume_settings[channel_name] = max(0.0, min(1.0, volume))
        logger.debug(f"TTS volume set to {volume} for channel {channel_name}")

    def get_tts_volume(self, channel_name: str) -> float:
        """Получить громкость TTS для канала"""
        return self.tts_volume_settings.get(channel_name, 1.0)

    def set_voice_volume(self, channel_name: str, voice_name: str, volume: float):
        """Установить громкость голоса для канала"""
        if channel_name not in self.voice_volume_settings:
            self.voice_volume_settings[channel_name] = {}
        self.voice_volume_settings[channel_name][voice_name] = max(0.0, min(1.0, volume))
        logger.debug(f"Voice {voice_name} volume set to {volume} for channel {channel_name}")

    def get_voice_volume(self, channel_name: str, voice_name: str) -> float:
        """Получить громкость голоса для канала"""
        return self.voice_volume_settings.get(channel_name, {}).get(voice_name, 1.0)

    def get_stats(self) -> Dict[str, any]:
        """Получить статистику соединений"""
        return {
            "active_connections": len(self.active_connections),
            "obs_connections": len(self.obs_connections),
            "youtube_obs_connections": len(self.youtube_obs_connections),
            "audio_connections": len(self.audio_connections),
            "active_channels": len(self.active_sessions),
            "tts_enabled_channels": len(self.tts_enabled_channels),
            "basic_tts_channels": len(self.basic_tts_enabled_channels),
            "ai_tts_channels": len(self.ai_tts_enabled_channels),
            "active_vk_bots": len(self.active_vk_bots),
            "total_sessions": sum(len(sessions) for sessions in self.active_sessions.values())
        }

    def get_twitch_cache(self, cache_key: str) -> Any:
        """Получить значение из Twitch кеша"""
        return self.twitch_cache.get(cache_key)

    def update_twitch_cache(self, cache_key: str, value: Any):
        """Обновить значение в Twitch кеше"""
        self.twitch_cache[cache_key] = value
        logger.debug(f"Updated Twitch cache key: {cache_key}")

    async def _delayed_tts_disable(self, user_id: int, username: str):
        """Отключить TTS с задержкой (вызывается после таймера)"""
        try:
            await asyncio.sleep(self.reconnect_timeout)

            # [START] FIX: Проверяем активные соединения перед отключением TTS
            has_active_connections = self._has_active_connections_for_user(user_id)

            if has_active_connections:
                logger.info(f"[OK] [TTS TIMEOUT] User {user_id} ({username}) has active connections - keeping TTS enabled")
                return

            # Если пользователь не переподключился и нет активных соединений, отключаем TTS
            logger.info(f"[TIMEOUT] [TTS TIMEOUT] User {user_id} ({username}) has no active connections - disabling TTS")

            # Импортируем здесь, чтобы избежать циклических импортов
            from services.tts.tts_service import TTSService
            from core.database import get_db

            db = next(get_db())
            try:
                tts_service = TTSService(db)
                await tts_service.disable_tts(user_id=user_id)
                logger.info(f"[OK] [TTS TIMEOUT] TTS disabled for user {user_id}")
            finally:
                db.close()

        except asyncio.CancelledError:
            logger.info(f"[OK] [TTS RECONNECT] User {user_id} reconnected - keeping TTS enabled")
            raise  # Важно: пробрасываем CancelledError для корректной отмены
        except Exception as e:
            logger.error(f"[ERROR] [TTS TIMEOUT] Error disabling TTS for user {user_id}: {e}")
        finally:
            # [OK] ГАРАНТИРОВАННАЯ ОЧИСТКА: Удаляем задачу из pending в любом случае
            # Это предотвращает утечку памяти и повторное использование завершенных задач
            if user_id in self.pending_tts_disconnects:
                del self.pending_tts_disconnects[user_id]
                logger.debug(f"[DELETE] [TTS CLEANUP] Removed pending disconnect task for user {user_id}")

    def _has_active_connections_for_user(self, user_id: int) -> bool:
        """
        Проверить, есть ли активные соединения для пользователя
        
        ВАЖНО: Проверяем:
        1. WebSocket соединения (сайт) ИЛИ OBS соединения - пользователь слушает
        2. Активность ботов на платформах - боты работают и могут озвучивать
        
        TTS должна отключаться если:
        - НЕТ активных слушателей (WebSocket/OBS)
        - ИЛИ НЕТ активных ботов на платформах
        """
        try:
            has_listeners = False
            has_active_bots = False

            # 1. Проверяем WebSocket соединения через memory_websocket_manager (сайт)
            from services.memory_websocket_manager import get_memory_websocket_manager
            user_connections = get_memory_websocket_manager().get_user_connections(user_id)

            if user_connections:
                # Проверяем, есть ли хотя бы одно активное соединение
                active_connections = [conn for conn in user_connections if conn.get('is_active', True)]
                if active_connections:
                    logger.info(f"[DEBUG] [TTS CHECK] User {user_id} has {len(active_connections)} active WebSocket connections (site)")
                    has_listeners = True

            # 2. Проверяем OBS соединения (через токены в БД)
            from core.database import get_db, User
            db = next(get_db())
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    if user.obs_token and user.obs_token in self.obs_connections:
                        # Проверяем, есть ли OBS соединение с этим токеном
                        logger.info(f"[DEBUG] [TTS CHECK] User {user_id} has OBS connection in registry")
                        has_listeners = True

                    # 3. [OK] НОВОЕ: Проверяем активность ботов на платформах
                    if user.twitch_username:
                        # Проверяем, есть ли активные сессии Twitch бота
                        if self.is_channel_active(user.twitch_username):
                            logger.info(f"[DEBUG] [TTS CHECK] User {user_id} has active Twitch bot sessions for {user.twitch_username}")
                            has_active_bots = True

                    if user.vk_username or user.vk_channel_name:
                        # Проверяем, есть ли активные сессии VK бота
                        vk_channel = user.vk_channel_name or user.vk_username
                        if vk_channel and self.is_channel_active(vk_channel):
                            logger.info(f"[DEBUG] [TTS CHECK] User {user_id} has active VK bot sessions for {vk_channel}")
                            has_active_bots = True

            finally:
                db.close()

            # TTS остается включенной только если есть И слушатели И активные боты
            result = has_listeners and has_active_bots

            if not has_listeners:
                logger.info(f"[DEBUG] [TTS CHECK] User {user_id} has NO listeners (no WebSocket site, no OBS) - TTS will be disabled")
            elif not has_active_bots:
                logger.info(f"[DEBUG] [TTS CHECK] User {user_id} has NO active bot connections on platforms - TTS will be disabled")
            else:
                logger.info(f"[DEBUG] [TTS CHECK] User {user_id} has both listeners AND active bots - keeping TTS enabled")

            return result

        except Exception as e:
            logger.error(f"[ERROR] [TTS CHECK] Error checking active connections for user {user_id}: {e}")
            # В случае ошибки отключаем TTS (безопаснее)
            return False

    def schedule_tts_disconnect(self, user_id: int, username: str):
        """Запланировать отключение TTS с таймаутом
        
        Args:
            user_id: ID пользователя
            username: Имя пользователя для логирования
            
        Note:
            - Отменяет предыдущую задачу если она существует
            - Создает новую задачу с гарантированной очисткой
            - Задача автоматически удаляется из pending_tts_disconnects при завершении
        """
        # Если уже есть pending задача - отменяем её
        self.cancel_tts_disconnect(user_id)

        # Создаём новую задачу с обработчиком завершения
        task = asyncio.create_task(self._delayed_tts_disable(user_id, username))
        self.pending_tts_disconnects[user_id] = task

        # [OK] ЗАЩИТА ОТ УТЕЧЕК: Добавляем callback для гарантированной очистки
        # Даже если задача завершится с исключением или будет отменена
        def cleanup_callback(finished_task):
            # Удаляем из словаря только если это все еще та же задача
            if self.pending_tts_disconnects.get(user_id) == finished_task:
                try:
                    # Проверяем исключение чтобы не потерять ошибки
                    finished_task.exception()
                except asyncio.CancelledError:
                    pass  # Это нормально, задача была отменена
                except Exception as e:
                    logger.error(f"[ERROR] [TTS TASK] Unexpected error in disconnect task for user {user_id}: {e}")

        task.add_done_callback(cleanup_callback)

        logger.info(f"[TIMER] [TTS DISCONNECT] Scheduled TTS disable for user {user_id} ({username}) in {self.reconnect_timeout}s")

    def cancel_tts_disconnect(self, user_id: int):
        """Отменить запланированное отключение TTS
        
        Args:
            user_id: ID пользователя
            
        Note:
            - Безопасно отменяет задачу если она существует
            - Удаляет задачу из словаря
            - Не вызывает исключения если задачи нет
        """
        if user_id in self.pending_tts_disconnects:
            task = self.pending_tts_disconnects[user_id]
            if not task.done():
                task.cancel()
                logger.info(f"[REFRESH] [TTS RECONNECT] Cancelled scheduled TTS disable for user {user_id}")
            # Удаляем из словаря сразу, не дожидаясь callback
            del self.pending_tts_disconnects[user_id]
