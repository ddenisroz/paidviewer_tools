# bots/command_handlers/song_request_handler.py
"""
Song Request (!sr) Command Handler - Unified for all platforms
"""
import logging
from bots.command_handlers import BaseCommandHandler, PlatformContext

logger = logging.getLogger('bot_service.commands.sr')


class SongRequestHandler(BaseCommandHandler):
    """Handler for !sr command - works on Twitch and VK"""
    
    name = "sr"
    aliases = ["songrequest", "play"]
    description = "Add a song to the queue"
    requires_permission = False
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        """Execute song request command"""
        try:
            from services.youtube.queue_service import QueueService
            youtube_queue_service = QueueService()
            from core.database import User
            from sqlalchemy import func
            
            if not ctx.args:
                await ctx.reply("[ERROR] Укажите ссылку на видео: !sr <url>")
                return
            
            url = ctx.args.strip()
            
            # Find channel owner
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return

            # Check settings
            from repositories.tts_settings_repository import TTSSettingsRepository
            tts_repo = TTSSettingsRepository(db)
            tts_settings = tts_repo.get_or_create(user_id=user.id)
            youtube_settings = getattr(tts_settings, 'youtube_settings', None) or {}
            
            if not youtube_settings.get('requests_command_enabled', True):
                await ctx.reply("Заказ видео через команды отключен стримером.")
                return
            
            # Add to queue
            result = await youtube_queue_service.add_video(
                user_id=user.id,
                url=url,
                requested_by=ctx.author_name,
                requester_id=ctx.author_id,
                platform=ctx.platform
            )
            
            if result.get('success'):
                title = result.get('title', 'Video')
                position = result.get('position', '?')
                await ctx.send(f" {ctx.author_name}, добавлено: {title[:50]} (#{position})")
            else:
                error = result.get('error', 'Unknown error')
                await ctx.reply(f"[ERROR] {error}")
                
        except Exception as e:
            logger.error(f"Error in !sr command: {e}")
            await ctx.reply("[ERROR] Ошибка добавления видео")


class SkipHandler(BaseCommandHandler):
    """Handler for !skip command"""
    
    name = "skip"
    aliases = ["next"]
    description = "Skip current video"
    requires_permission = True
    permission_level = "moderator"
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from services.youtube.queue_service import QueueService
            youtube_queue_service = QueueService()
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            result = await youtube_queue_service.skip_current(user.id)
            
            if result.get('success'):
                await ctx.send(f"⏭ {ctx.author_name} пропустил видео")
            else:
                await ctx.reply(f"[ERROR] {result.get('error', 'Ошибка')}")
                
        except Exception as e:
            logger.error(f"Error in !skip: {e}")
            await ctx.reply("[ERROR] Ошибка")


class QueueHandler(BaseCommandHandler):
    """Handler for !queue command"""
    
    name = "queue"
    aliases = ["q", "list"]
    description = "Show video queue"
    requires_permission = False
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from services.youtube.queue_service import QueueService
            youtube_queue_service = QueueService()
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            queue = await youtube_queue_service.get_queue(user.id, limit=5)
            
            if not queue:
                await ctx.send(" Очередь пуста")
                return
            
            items = []
            for i, item in enumerate(queue, 1):
                title = item.get('title', 'Unknown')[:30]
                requester = item.get('requested_by', 'Unknown')
                items.append(f"{i}. {title} ({requester})")
            
            await ctx.send(" " + " | ".join(items))
                
        except Exception as e:
            logger.error(f"Error in !queue: {e}")
            await ctx.reply("[ERROR] Ошибка")


class ClearHandler(BaseCommandHandler):
    """Handler for !clear command"""
    
    name = "clear"
    aliases = ["clearqueue"]
    description = "Clear the video queue"
    requires_permission = True
    permission_level = "broadcaster"
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from services.youtube.queue_service import QueueService
            youtube_queue_service = QueueService()
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            result = await youtube_queue_service.clear_queue(user.id)
            
            if result.get('success'):
                await ctx.send(f" {ctx.author_name} очистил очередь")
            else:
                await ctx.reply(f"[ERROR] {result.get('error', 'Ошибка')}")
                
        except Exception as e:
            logger.error(f"Error in !clear: {e}")
            await ctx.reply("[ERROR] Ошибка")


class WrongLinkHandler(BaseCommandHandler):
    """Handler for !wronglink command - remove own last video"""
    
    name = "wronglink"
    aliases = ["undo", "removelast"]
    description = "Remove your last added video"
    requires_permission = False
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from services.youtube.queue_service import QueueService
            youtube_queue_service = QueueService()
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            result = await youtube_queue_service.remove_last_by_user(
                user_id=user.id,
                requester_name=ctx.author_name
            )
            
            if result.get('success'):
                title = result.get('title', 'video')
                await ctx.send(f" {ctx.author_name}, удалено: {title[:40]}")
            else:
                await ctx.reply(f"[ERROR] {result.get('error', 'Не найдено')}")
                
        except Exception as e:
            logger.error(f"Error in !wronglink: {e}")
            await ctx.reply("[ERROR] Ошибка")
