# bot_service/services/admin/bot_control_service.py
"""
Сервис управления ботами (статус, перезапуск).
"""

import logging

import httpx

from core.config import settings
from core.datetime_utils import utcnow_naive
from core.connection_manager import get_connection_manager
from core.database import get_db
from startup.bot_registry import get_bot_registry

logger = logging.getLogger(__name__)


class BotControlService:
    """Сервис для управления ботами."""

    async def get_bots_status(self) -> dict:
        """Получить статус всех ботов."""
        try:
            registry = get_bot_registry()
            connection_manager = get_connection_manager()
            bots = []

            # Twitch bot status
            twitch_status = "stopped"
            twitch_channels = 0

            if registry.is_twitch_running():
                twitch_status = "running"
                if registry.twitch_bot and hasattr(registry.twitch_bot, 'connected_channels'):
                    twitch_channels = len(registry.twitch_bot.connected_channels)

            bots.append({
                "name": "twitch_bot",
                "status": twitch_status,
                "last_activity": utcnow_naive().isoformat(),
                "platform": "twitch",
                "connected_channels": twitch_channels
            })

            # VK Live bot status
            vk_status = "stopped"
            vk_channels = 0

            if registry.is_vk_running():
                vk_status = "running"
                if hasattr(connection_manager, 'active_vk_bots'):
                    vk_channels = len(connection_manager.active_vk_bots)

            bots.append({
                "name": "vk_live_bot",
                "status": vk_status,
                "last_activity": utcnow_naive().isoformat(),
                "platform": "vk_live",
                "connected_channels": vk_channels
            })

            return {"bots": bots}

        except Exception as e:
            logger.error(f"Error getting bots status: {e}")
            return {
                "bots": [
                    {
                        "name": "twitch_bot",
                        "status": "error",
                        "last_activity": utcnow_naive().isoformat(),
                        "platform": "twitch",
                        "connected_channels": 0
                    },
                    {
                        "name": "vk_live_bot",
                        "status": "error",
                        "last_activity": utcnow_naive().isoformat(),
                        "platform": "vk_live",
                        "connected_channels": 0
                    }
                ]
            }

    async def restart_bot(self, bot_name: str) -> dict:
        """Перезапустить бота."""
        try:
            registry = get_bot_registry()
            connection_manager = get_connection_manager()

            if bot_name == "twitch_bot":
                return await self._restart_twitch_bot(registry, connection_manager)
            elif bot_name == "vk_live_bot":
                return await self._restart_vk_bot(registry, connection_manager)
            else:
                return {"error": f"Unknown bot: {bot_name}"}

        except Exception as e:
            logger.error(f"Error restarting bot {bot_name}: {e}")
            return {"error": f"Failed to restart bot: {str(e)}"}

    async def _restart_twitch_bot(self, registry, connection_manager) -> dict:
        """Перезапустить Twitch бота."""
        logger.info("[REFRESH] Restarting Twitch bot...")

        # Останавливаем текущий бот
        await registry.stop_twitch_bot()

        # Получаем активные каналы
        db = next(get_db())
        try:
            active_channels = await connection_manager.get_twitch_channels_for_bot(db)
        finally:
            db.close()
        from startup.bot_initializer import initialize_twitch_bot

        success = await initialize_twitch_bot(active_channels)
        if not success:
            return {"error": "Twitch bot OAuth token not configured. Use /auth/twitch/bot/login"}

        logger.info(f"[OK] Twitch bot restarted with channels: {active_channels}")
        return {
            "message": "Twitch bot restarted successfully",
            "channels": active_channels
        }

    async def _restart_vk_bot(self, registry, connection_manager) -> dict:
        """Перезапустить VK Live бота."""
        logger.info("[REFRESH] Restarting VK Live bot...")

        # Останавливаем текущий бот
        await registry.stop_vk_bot()

        # Получаем активные каналы
        db = next(get_db())
        try:
            active_channels = await connection_manager.get_vk_channels_for_bot(db)
        finally:
            db.close()
        from startup.bot_initializer import initialize_vk_bot

        success = await initialize_vk_bot(active_channels)
        if not success:
            return {"error": "VK bot OAuth token not configured. Use /auth/vk/bot/login"}

        # Подключаем к каналам

        logger.info(f"[OK] VK Live bot restarted with channels: {active_channels}")
        return {
            "message": "VK Live bot restarted successfully",
            "channels": active_channels
        }

    async def restart_tts_engine(self) -> dict:
        """Перезагрузить TTS движок."""
        try:
            tts_service_url = settings.tts_service_url
            if not tts_service_url:
                raise ValueError("TTS_SERVICE_URL is not configured")

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(f"{tts_service_url}/api/tts/restart")

                if response.status_code == 200:
                    logger.info("[OK] TTS engine restart requested")
                    return {"message": "TTS engine restart requested successfully"}
                else:
                    logger.error(f"[ERROR] TTS restart failed: {response.status_code}")
                    return {"error": f"TTS engine restart failed: {response.status_code}"}

        except Exception as e:
            logger.error(f"Error restarting TTS engine: {e}")
            return {"error": f"Failed to restart TTS engine: {str(e)}"}


# Singleton instance
bot_control_service = BotControlService()
