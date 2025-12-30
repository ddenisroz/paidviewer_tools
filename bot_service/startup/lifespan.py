# bot_service/startup/lifespan.py
"""
Lifecycle events для FastAPI приложения.

Управляет startup и shutdown логикой:
- Инициализация базы данных
- Запуск/остановка сервисов
- Инициализация/остановка ботов
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from core.config import settings
from core.database import get_db, init_db
from core.connection_manager import get_connection_manager
from core.background_tasks import background_tasks
from features.tts.memory_tts_queue import memory_tts_queue
from services.memory_websocket_manager import memory_websocket_manager

from .bot_registry import get_bot_registry
from .bot_initializer import initialize_all_bots

logger = logging.getLogger(__name__)


async def _startup_database() -> None:
    """Инициализация базы данных."""
    init_db()
    logger.info("Database initialized")


async def _startup_services() -> None:
    """Запуск сервисов (TTS queue, WebSocket manager)."""
    try:
        await memory_tts_queue.start()
        logger.info("Memory TTS Queue started")
    except Exception as e:
        logger.error(f"Failed to start Memory TTS Queue: {e}")
        raise
    
    try:
        await memory_websocket_manager.start()
        logger.info("Memory WebSocket Manager started")
    except Exception as e:
        logger.error(f"Failed to start Memory WebSocket Manager: {e}")
        raise


async def _startup_connection_manager() -> None:
    """Восстановление активных сессий."""
    connection_manager = get_connection_manager()
    db = next(get_db())
    
    try:
        await connection_manager.restore_active_sessions_from_db(db)
        active_channels = connection_manager.get_active_channels()
        logger.info(f"Restored {len(active_channels)} active channels")
        
        # TTS включается только при подключении пользователя через WebSocket
        logger.info("[OK] TTS will be enabled when users connect via WebSocket")
    finally:
        db.close()


async def _startup_background_tasks() -> None:
    """Запуск фоновых задач."""
    await background_tasks.start_all_tasks()
    logger.info("Background tasks started")
    
    # Запускаем мониторинг токенов ботов
    from services.bot_token_validator import bot_token_validator
    await bot_token_validator.start_monitoring(check_interval=3600)  # Проверка каждый час
    logger.info("Bot token monitoring started")
    
    # Запускаем автообновление VK токенов
    from services.vk_token_refresh_service import vk_token_refresh_service
    await vk_token_refresh_service.start()
    logger.info("VK token refresh service started")


async def _shutdown_bots() -> None:
    """Остановка всех ботов."""
    registry = get_bot_registry()
    connection_manager = get_connection_manager()
    
    # Очищаем активные VK боты
    active_vk_bots = getattr(connection_manager, 'active_vk_bots', {})
    logger.info(f"[CLEANUP] Cleaning up {len(active_vk_bots)} active VK bots...")
    
    for channel_name, bot_data in list(active_vk_bots.items()):
        try:
            vk_bot = bot_data.get("bot")
            if vk_bot:
                await vk_bot.disconnect()
                logger.info(f"[OK] VK bot disconnected from {channel_name}")
        except Exception as e:
            logger.error(f"[ERROR] Error disconnecting VK bot from {channel_name}: {e}")
    
    # Останавливаем ботов через registry
    await registry.stop_all()


async def _shutdown_services() -> None:
    """Остановка сервисов."""
    try:
        await memory_tts_queue.stop()
        logger.info("Memory TTS Queue stopped")
    except Exception as e:
        logger.error(f"Error stopping Memory TTS Queue: {e}")
    
    try:
        await memory_websocket_manager.stop()
        logger.info("Memory WebSocket Manager stopped")
    except Exception as e:
        logger.error(f"Error stopping Memory WebSocket Manager: {e}")


async def _shutdown_background_tasks() -> None:
    """Остановка фоновых задач."""
    # Останавливаем мониторинг токенов
    from services.bot_token_validator import bot_token_validator
    await bot_token_validator.stop_monitoring()
    logger.info("Bot token monitoring stopped")
    
    # Останавливаем автообновление VK токенов
    from services.vk_token_refresh_service import vk_token_refresh_service
    await vk_token_refresh_service.stop()
    logger.info("VK token refresh service stopped")
    
    await background_tasks.stop_all_tasks()
    logger.info("Background tasks stopped")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifecycle context manager для FastAPI.
    
    Управляет startup и shutdown логикой приложения.
    
    Usage:
        app = FastAPI(lifespan=lifespan)
    """
    # === STARTUP ===
    logger.info("Bot service starting on port 8000")
    
    try:
        # 1. База данных
        await _startup_database()
        
        # 2. Сервисы (TTS, WebSocket)
        await _startup_services()
        
        # 3. Connection manager (восстановление сессий)
        await _startup_connection_manager()
        
        # 4. Фоновые задачи
        await _startup_background_tasks()
        
        # 5. Боты
        await initialize_all_bots()
        
        logger.info("=== BOT SERVICE STARTED ===")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
    
    yield
    
    # === SHUTDOWN ===
    logger.info("Bot service shutting down")
    
    try:
        # 1. Боты
        await _shutdown_bots()
        
        # 2. Фоновые задачи
        await _shutdown_background_tasks()
        
        # 3. Сервисы
        await _shutdown_services()
        
        logger.info("Connections cleaned up")
        logger.info("=== BOT SERVICE STOPPED ===")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")
