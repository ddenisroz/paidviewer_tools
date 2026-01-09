# bot_service/services/admin/bot_control_service.py
"""
Сервис управления ботами (статус, перезапуск).
"""

import asyncio
import logging

import httpx

from core.config import settings
from core.datetime_utils import utcnow_naive
from core.connection_manager import get_connection_manager
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

        # Проверяем токен
        bot_token = settings.twitch_bot_token
        if not bot_token:
            return {"error": "TWITCH_BOT_TOKEN not configured"}

        # Получаем активные каналы
        active_channels = connection_manager.get_active_channels()

        # Создаем новый экземпляр
        from bots.twitch_bot import Bot
        new_bot = Bot(bot_token, active_channels, connection_manager)
        new_task = asyncio.create_task(new_bot.start())

        registry.twitch_bot = new_bot
        registry.twitch_task = new_task

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

        # Проверяем токен
        vk_token = settings.vk_live_user_token
        if not vk_token:
            return {"error": "VK_LIVE_USER_TOKEN not configured"}

        # Получаем активные каналы
        active_channels = connection_manager.get_active_channels()

        # Создаем новый экземпляр
        from bots.vk_live_bot import VKLiveBot
        new_bot = VKLiveBot(vk_token, connection_manager)
        new_task = asyncio.create_task(new_bot.start_bot())

        registry.vk_bot = new_bot
        registry.vk_task = new_task

        # Подключаем к каналам
        for channel_name in active_channels:
            await new_bot.join_channel(channel_name)

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
