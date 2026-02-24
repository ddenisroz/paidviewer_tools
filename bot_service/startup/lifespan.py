# bot_service/startup/lifespan.py
"""
Lifecycle events для FastAPI приложения.

Управляет startup и shutdown логикой:
- Инициализация базы данных
- Запуск/остановка сервисов
- Инициализация/остановка ботов
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from core.database import get_db, init_db, BotCommand
from core.config import settings
from core.connection_manager import get_connection_manager
from core.background_tasks import background_tasks
from services.tts.memory_tts_queue import get_memory_tts_queue
from services.memory_websocket_manager import get_memory_websocket_manager

from .bot_registry import get_bot_registry
from .bot_initializer import initialize_all_bots

logger = logging.getLogger(__name__)


async def _startup_database() -> None:
    """Инициализация базы данных."""
    # Production-safe startup: schema must be migrated before app boot.
    init_db(create_schema=False, strict=True)
    logger.info("Database initialized")

async def _startup_commands() -> None:
    """Ensure global bot commands exist for core features like !sr."""
    db = next(get_db())
    try:
        has_global = db.query(BotCommand).filter(
            BotCommand.command_type == 'global',
            BotCommand.user_id.is_(None)
        ).first()
        has_memegrant = db.query(BotCommand).filter(
            BotCommand.command_type == 'global',
            BotCommand.user_id.is_(None),
            BotCommand.command_name == 'memegrant'
        ).first()
        has_givema = db.query(BotCommand).filter(
            BotCommand.command_type == 'global',
            BotCommand.user_id.is_(None),
            BotCommand.command_name == 'givema'
        ).first()
        if not has_global or not has_memegrant or not has_givema:
            logger.info("[STARTUP] Seeding/refreshing global bot commands")
            from init_global_commands import init_global_commands
            init_global_commands()
        else:
            logger.info("[STARTUP] Global bot commands already exist")
    except Exception as e:
        logger.error(f"Failed to seed global commands: {e}")
    finally:
        db.close()


async def _startup_services() -> None:
    """Запуск сервисов (TTS queue, WebSocket manager, TTS worker) параллельно."""
    from services.tts.tts_worker import tts_worker
    try:
        await asyncio.gather(
            get_memory_tts_queue().start(),
            get_memory_websocket_manager().start(),
            tts_worker.start(),
        )
        logger.info("All services started (TTS queue, WebSocket manager, TTS worker)")
    except Exception as e:
        logger.error(f"Failed to start services: {e}")
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
    """Запуск фоновых задач параллельно."""
    from services.bot_token_validator import bot_token_validator
    from services.vk_token_refresh_service import vk_token_refresh_service
    await asyncio.gather(
        background_tasks.start_all_tasks(),
        bot_token_validator.start_monitoring(check_interval=3600),
        vk_token_refresh_service.start(),
    )
    logger.info("All background tasks started (tasks, token monitoring, VK refresh)")

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
        await get_memory_tts_queue().stop()
        # logger.info("Memory TTS Queue stopped") - Logged inside stop()
    except Exception as e:
        logger.error(f"Error stopping Memory TTS Queue: {e}")
    
    try:
        await get_memory_websocket_manager().stop()
        # logger.info("Memory WebSocket Manager stopped") - Logged inside stop()
    except Exception as e:
        logger.error(f"Error stopping Memory WebSocket Manager: {e}")

    # [NEW] Stop TTS Worker
    try:
        from services.tts.tts_worker import tts_worker
        await tts_worker.stop()
    except Exception as e:
        logger.error(f"Error stopping TTS Worker: {e}")


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
    if settings.testing:
        logger.info("Testing mode enabled: skipping heavy startup/shutdown services")
        yield
        return

    # === STARTUP ===
    logger.info("Bot service starting on port 8000")
    
    try:
        # 1. База данных
        await _startup_database()
        await _startup_commands()

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
