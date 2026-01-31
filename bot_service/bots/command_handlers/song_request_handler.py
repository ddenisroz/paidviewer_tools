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
    """Handler for !skip command with optional vote-based skipping"""
    
    name = "skip"
    aliases = ["next"]
    description = "Skip current video"
    requires_permission = False  # Changed: permission check is done dynamically
    permission_level = "moderator"  # Default for single-skip mode
    
    # In-memory vote tracking: {channel_owner_id: {video_id: set(voter_usernames)}}
    _skip_votes: dict = {}
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from services.youtube.queue_service import QueueService
            youtube_queue_service = QueueService()
            from repositories.user_repository import UserRepository
            from repositories.command_repository import CommandRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            # Get skip_votes_required from command override settings
            cmd_repo = CommandRepository(db)
            skip_votes_required = 1  # Default: instant skip
            
            # Check for user override of skip command
            override = cmd_repo.get_override_by_name('skip', user.id)
            if override and override.extra_settings:
                skip_votes_required = override.extra_settings.get('skip_votes_required', 1)
            
            # If skip_votes_required == 1: moderator-only instant skip (original behavior)
            if skip_votes_required <= 1:
                # Check moderator permission
                is_mod = any(role in ['moderator', 'broadcaster', 'owner'] for role in (ctx.author_roles or []))
                is_owner = ctx.author_name.lower() == ctx.channel_name.lower()
                
                if not is_mod and not is_owner:
                    await ctx.reply("Только модераторы могут использовать !skip")
                    return
                
                result = await youtube_queue_service.skip_current(user.id)
                
                if result.get('success'):
                    await ctx.send(f"⏭ {ctx.author_name} пропустил видео")
                else:
                    await ctx.reply(f"[ERROR] {result.get('error', 'Ошибка')}")
                return
            
            # Vote-based skip mode
            current_video = await youtube_queue_service.get_current_video(user.id)
            if not current_video:
                await ctx.reply("Нет текущего видео для пропуска")
                return
            
            video_id = current_video.get('id') or current_video.get('video_id', 'unknown')
            
            # Initialize vote tracking for this channel if needed
            if user.id not in self._skip_votes:
                self._skip_votes[user.id] = {}
            
            # Reset votes if video changed
            if video_id not in self._skip_votes[user.id]:
                self._skip_votes[user.id] = {video_id: set()}
            
            # Add voter (unique by username)
            voter_name = ctx.author_name.lower()
            votes_set = self._skip_votes[user.id][video_id]
            
            if voter_name in votes_set:
                await ctx.reply(f"{ctx.author_name}, ты уже голосовал за скип!")
                return
            
            votes_set.add(voter_name)
            current_votes = len(votes_set)
            
            if current_votes >= skip_votes_required:
                # Threshold reached - skip!
                result = await youtube_queue_service.skip_current(user.id)
                
                if result.get('success'):
                    # Clear votes for this channel
                    self._skip_votes[user.id] = {}
                    await ctx.send(f"⏭ Видео пропущено! ({current_votes}/{skip_votes_required} голосов)")
                else:
                    await ctx.reply(f"[ERROR] {result.get('error', 'Ошибка')}")
            else:
                # Not enough votes yet
                remaining = skip_votes_required - current_votes
                await ctx.send(f"🗳 {ctx.author_name} голосует за скип ({current_votes}/{skip_votes_required}). Нужно ещё {remaining}!")
                
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
