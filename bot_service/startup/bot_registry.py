# bot_service/startup/bot_registry.py
"""
Singleton registry для управления ботами.

Заменяет глобальные переменные bot_instance, vk_live_bot_instance из main.py.
Обеспечивает thread-safe доступ к ботам из любого модуля.
"""

import asyncio
import logging
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from bots.twitch_bot import Bot
    from bots.vk_live_bot import VKLiveBot

logger = logging.getLogger(__name__)


class BotRegistry:
    """
    Singleton registry для управления экземплярами ботов.
    
    Использование:
        registry = get_bot_registry()
        twitch_bot = registry.twitch_bot
        vk_bot = registry.vk_bot
    """
    
    _instance: Optional["BotRegistry"] = None
    _lock = asyncio.Lock()
    
    def __init__(self):
        self._twitch_bot: Optional["Bot"] = None
        self._twitch_task: Optional[asyncio.Task] = None
        self._vk_bot: Optional["VKLiveBot"] = None
        self._vk_task: Optional[asyncio.Task] = None
    
    @classmethod
    def get_instance(cls) -> "BotRegistry":
        """Получить singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    # === Twitch Bot ===
    
    @property
    def twitch_bot(self) -> Optional["Bot"]:
        """Получить Twitch бота."""
        return self._twitch_bot
    
    @twitch_bot.setter
    def twitch_bot(self, bot: Optional["Bot"]) -> None:
        """Установить Twitch бота."""
        self._twitch_bot = bot
    
    @property
    def twitch_task(self) -> Optional[asyncio.Task]:
        """Получить task Twitch бота."""
        return self._twitch_task
    
    @twitch_task.setter
    def twitch_task(self, task: Optional[asyncio.Task]) -> None:
        """Установить task Twitch бота."""
        self._twitch_task = task
    
    def is_twitch_running(self) -> bool:
        """Проверить, запущен ли Twitch бот."""
        return (
            self._twitch_bot is not None 
            and self._twitch_task is not None 
            and not self._twitch_task.done()
        )
    
    # === VK Live Bot ===
    
    @property
    def vk_bot(self) -> Optional["VKLiveBot"]:
        """Получить VK Live бота."""
        return self._vk_bot
    
    @vk_bot.setter
    def vk_bot(self, bot: Optional["VKLiveBot"]) -> None:
        """Установить VK Live бота."""
        self._vk_bot = bot
    
    @property
    def vk_task(self) -> Optional[asyncio.Task]:
        """Получить task VK Live бота."""
        return self._vk_task
    
    @vk_task.setter
    def vk_task(self, task: Optional[asyncio.Task]) -> None:
        """Установить task VK Live бота."""
        self._vk_task = task
    
    def is_vk_running(self) -> bool:
        """Проверить, запущен ли VK Live бот."""
        return (
            self._vk_bot is not None 
            and self._vk_bot.is_running
        )
    
    # === Cleanup ===
    
    async def stop_twitch_bot(self) -> None:
        """Остановить Twitch бота."""
        if self._twitch_task:
            self._twitch_task.cancel()
            try:
                await self._twitch_task
            except asyncio.CancelledError:
                pass
            self._twitch_task = None
        self._twitch_bot = None
        logger.info("[OK] Twitch bot stopped")
    
    async def stop_vk_bot(self) -> None:
        """Остановить VK Live бота."""
        if self._vk_bot:
            try:
                await self._vk_bot.stop_bot()
            except Exception as e:
                logger.error(f"[ERROR] Error stopping VK bot: {e}")
        if self._vk_task:
            self._vk_task.cancel()
            try:
                await self._vk_task
            except asyncio.CancelledError:
                pass
            self._vk_task = None
        self._vk_bot = None
        logger.info("[OK] VK Live bot stopped")
    
    async def stop_all(self) -> None:
        """Остановить всех ботов."""
        await self.stop_twitch_bot()
        await self.stop_vk_bot()


def get_bot_registry() -> BotRegistry:
    """
    Получить singleton instance BotRegistry.
    
    Использование:
        from startup.bot_registry import get_bot_registry
        
        registry = get_bot_registry()
        if registry.is_twitch_running():
            bot = registry.twitch_bot
    """
    return BotRegistry.get_instance()


# === Backward Compatibility ===
# Для обратной совместимости с существующим кодом, который импортирует из main.py

def get_bot_instance():
    """Backward compatibility: получить Twitch бота."""
    return get_bot_registry().twitch_bot


def get_vk_bot_instance():
    """Backward compatibility: получить VK Live бота."""
    return get_bot_registry().vk_bot
