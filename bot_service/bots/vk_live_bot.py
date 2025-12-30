# bot_service/bots/vk_live_bot.py
"""Главный файл VK Live бота"""
import logging
from core.connection_manager import ConnectionManager
from .vk_live_bot_core import VKLiveBotCore

logger = logging.getLogger('bot_service')

class VKLiveBot(VKLiveBotCore):
    """Главный класс VK Live бота"""

    def __init__(self, user_access_token: str, connection_manager: ConnectionManager):
        super().__init__(user_access_token, connection_manager)
        logger.info("[VK BOT] VK Live bot initialized")

    async def start_bot(self):
        """Запуск VK Live бота"""
        await super().start_bot()
        logger.info("[VK BOT] All modules loaded and ready!")

    async def stop_bot(self):
        """Остановка VK Live бота"""
        await super().stop_bot()
        logger.info("[VK BOT] VK Live bot shutdown complete")

    async def connect_to_channel(self, channel_id: str) -> bool:
        """Подключиться к каналу VK Live"""
        success = await super().connect_to_channel(channel_id)

        if success:
            # Уведомляем connection_manager
            self.connection_manager.add_active_session(
                channel_id,
                f"vk_{channel_id}",
                "vk"
            )

            # Note: VK Live API не поддерживает отправку сообщений от бота в чат
            # Можно логировать подключение, но нельзя отправить welcome message
            import random
            fake_ip = f"{random.randint(100, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}"
            logger.info(f"[OK] [VK BOT] Connected to {channel_id} (fake IP for fun: {fake_ip})")

        return success

    async def disconnect_from_channel(self, channel_id: str) -> bool:
        """Отключиться от канала VK Live"""
        success = await super().disconnect_from_channel(channel_id)

        if success:
            # Уведомляем connection_manager
            self.connection_manager.remove_active_session(
                channel_id,
                "vk_disconnect"
            )

        return success

    async def send_message(self, channel_id: str, message: str) -> bool:
        """Отправить сообщение в канал VK Live"""
        try:
            if not self.is_connected_to_channel(channel_id):
                logger.error(f"Not connected to channel {channel_id}")
                return False

            # Отправляем сообщение через WebSocket
            if self.ws_client:
                await self.ws_client.send_message(message)
                logger.info(f"VK Live message sent to {channel_id}: {message}")
                return True
            else:
                logger.error("WebSocket client not available")
                return False

        except Exception as e:
            logger.error(f"Error sending VK Live message: {e}")
            return False

    async def shutdown(self):
        """Корректное завершение работы бота"""
        try:
            logger.info("[VK BOT] Shutting down VK Live bot...")

            # Отключаемся от всех каналов
            for channel_id in self.connected_channels.copy():
                await self.disconnect_from_channel(channel_id)

            await self.stop_bot()
            logger.info("[VK BOT] VK Live bot shutdown complete")
        except Exception as e:
            logger.error(f"[VK BOT] Error during bot shutdown: {e}")
