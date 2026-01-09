# bots/command_handlers/__init__.py
"""
Command Handlers Package - Strategy Pattern Implementation

This package eliminates code duplication between Twitch and VK handlers
by using a unified Command interface.
"""
from typing import Protocol, Dict, Optional
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger('bot_service.commands')


class PlatformContext(Protocol):
    """Platform-agnostic context for command execution"""
    channel_name: str
    author_name: str
    author_id: str
    platform: str
    args: str
    raw_message: Optional[str]
    
    async def reply(self, message: str) -> None:
        """Send reply to chat"""
        ...
    
    async def send(self, message: str) -> None:
        """Send message to chat"""
        ...


class TwitchContext:
    """Adapter for TwitchIO Context"""
    def __init__(self, ctx, args: str = ""):
        self._ctx = ctx
        self.channel_name = ctx.channel.name if ctx.channel else ""
        self.author_name = ctx.author.name if ctx.author else ""
        self.author_id = str(ctx.author.id) if ctx.author else ""
        self.platform = "twitch"
        self.args = args
        self.raw_message = ctx.message.content if ctx.message else ""
    
    async def reply(self, message: str) -> None:
        await self._ctx.reply(message)
    
    async def send(self, message: str) -> None:
        await self._ctx.send(message)


class VKContext:
    """Adapter for VK message data"""
    def __init__(self, channel_name: str, message_data: Dict, vk_bot, args: str = ""):
        self._vk_bot = vk_bot
        self._message_data = message_data
        self.channel_name = channel_name
        self.author_name = message_data.get('author', {}).get('displayName', 'Unknown')
        self.author_id = str(message_data.get('author', {}).get('id', ''))
        self.platform = "vk"
        self.args = args
        self.raw_message = message_data.get('data', {}).get('text', '')
    
    async def reply(self, message: str) -> None:
        if self._vk_bot:
            await self._vk_bot.send_chat_message(self.channel_name, message)
    
    async def send(self, message: str) -> None:
        if self._vk_bot:
            await self._vk_bot.send_chat_message(self.channel_name, message)


class BaseCommandHandler(ABC):
    """Base class for all command handlers"""
    
    name: str = ""
    aliases: list = []
    description: str = ""
    requires_permission: bool = False
    permission_level: str = "viewer"  # viewer, moderator, broadcaster
    
    @abstractmethod
    async def execute(self, ctx: PlatformContext, db) -> None:
        """Execute the command"""
        pass
    
    def can_execute(self, ctx: PlatformContext, user_roles: list) -> bool:
        """Check if user can execute this command"""
        if not self.requires_permission:
            return True
        
        if self.permission_level == "broadcaster":
            return "broadcaster" in user_roles
        elif self.permission_level == "moderator":
            return "broadcaster" in user_roles or "moderator" in user_roles
        return True


# Export common handlers
__all__ = [
    'PlatformContext',
    'TwitchContext', 
    'VKContext',
    'BaseCommandHandler',
]
