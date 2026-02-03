# bots/command_handlers/stream_handlers.py
"""
Stream Info Command Handlers - Game, Title, etc.
"""
import logging
from bots.command_handlers import BaseCommandHandler, PlatformContext

logger = logging.getLogger('bot_service.commands.stream')


async def _broadcast_stream_info_update(user_id: int, platform: str, db) -> None:
    try:
        from services.stream_info_service import StreamInfoService
        from utils.stream_info_cache import set_cached_stream_info
        from utils.websocket_broadcast import broadcast_stream_info_change

        service = StreamInfoService(db)
        info = await service.get_stream_info(user_id, platform)
        set_cached_stream_info(user_id, platform, info)
        await broadcast_stream_info_change(user_id, platform, info)
    except Exception as e:
        logger.warning(f"[STREAM_INFO] Broadcast failed for {platform}: {e}")


class GameHandler(BaseCommandHandler):
    """Handler for !game command - show/change stream game"""
    
    name = "game"
    aliases = ["category", "игра"]
    description = "Show or change stream game/category"
    requires_permission = True
    permission_level = "moderator"
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            if ctx.platform == 'twitch':
                await self._handle_twitch_game(ctx, user, db)
            elif ctx.platform == 'vk':
                await self._handle_vk_game(ctx, user, db)
                
        except Exception as e:
            logger.error(f"Error in !game: {e}")
            await ctx.reply("[ERROR] Ошибка")
    
    async def _handle_twitch_game(self, ctx: PlatformContext, user, db) -> None:
        from platforms.registry import platform_registry
        from repositories.user_token_repository import UserTokenRepository
        
        token = UserTokenRepository(db).get_active_token(user.id, 'twitch')
        
        if not token:
            await ctx.reply("[ERROR] Twitch не подключен")
            return
        
        twitch_platform = platform_registry.get('twitch')
        if not twitch_platform:
            await ctx.reply("[ERROR] Twitch platform not available")
            return
        
        if not ctx.args:
            # Get current game
            channel_info = await twitch_platform.get_channel_info(user.twitch_username)
            if channel_info:
                game = channel_info.get('game_name', 'Not set')
                await ctx.send(f" Игра: {game}")
            else:
                await ctx.reply("[ERROR] Не удалось получить информацию")
        else:
            # Set new game - search then update
            new_game = ctx.args.strip()
            games = await twitch_platform.search_categories(new_game)
            if games:
                result = await twitch_platform.update_stream_category(user.id, games[0].get('id'))
                if result:
                    await _broadcast_stream_info_update(user.id, "twitch", db)
                    await ctx.send(f" Игра изменена на: {games[0].get('name', new_game)}")
                else:
                    await ctx.reply("[ERROR] Не удалось изменить игру")
            else:
                await ctx.reply(f"[ERROR] Игра '{new_game}' не найдена")
    
    async def _handle_vk_game(self, ctx: PlatformContext, user, db) -> None:
        await ctx.reply("ℹ VK не поддерживает смену категории через API")


class TitleHandler(BaseCommandHandler):
    """Handler for !title command - show/change stream title"""
    
    name = "title"
    aliases = ["название", "заголовок"]
    description = "Show or change stream title"
    requires_permission = True
    permission_level = "moderator"
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            if ctx.platform == 'twitch':
                await self._handle_twitch_title(ctx, user, db)
            elif ctx.platform == 'vk':
                await self._handle_vk_title(ctx, user, db)
                
        except Exception as e:
            logger.error(f"Error in !title: {e}")
            await ctx.reply("[ERROR] Ошибка")
    
    async def _handle_twitch_title(self, ctx: PlatformContext, user, db) -> None:
        from platforms.registry import platform_registry
        from repositories.user_token_repository import UserTokenRepository
        
        token = UserTokenRepository(db).get_active_token(user.id, 'twitch')
        
        if not token:
            await ctx.reply("[ERROR] Twitch не подключен")
            return
        
        twitch_platform = platform_registry.get('twitch')
        if not twitch_platform:
            await ctx.reply("[ERROR] Twitch platform not available")
            return
        
        if not ctx.args:
            channel_info = await twitch_platform.get_channel_info(user.twitch_username)
            if channel_info:
                title = channel_info.get('title', 'Not set')
                await ctx.send(f" Название: {title[:100]}")
            else:
                await ctx.reply("[ERROR] Не удалось получить информацию")
        else:
            new_title = ctx.args.strip()
            result = await twitch_platform.update_stream_title(user.id, new_title)
            if result:
                await _broadcast_stream_info_update(user.id, "twitch", db)
                await ctx.send(" Название изменено")
            else:
                await ctx.reply("[ERROR] Не удалось изменить название")
    
    async def _handle_vk_title(self, ctx: PlatformContext, user, db) -> None:
        await ctx.reply("ℹ VK не поддерживает смену названия через API")


class UptimeHandler(BaseCommandHandler):
    """Handler for !uptime command"""
    
    name = "uptime"
    aliases = ["live", "время"]
    description = "Show stream uptime"
    requires_permission = False
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from repositories.user_repository import UserRepository
            from datetime import datetime
            
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("[ERROR] Канал не найден")
                return
            
            if ctx.platform == 'twitch':
                from platforms.registry import platform_registry
                
                twitch_platform = platform_registry.get('twitch')
                if twitch_platform:
                    stream = await twitch_platform.get_stream_status(user.twitch_username)
                    
                    if stream:
                        started_at = stream.get('started_at')
                        if started_at:
                            start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                            uptime = datetime.now(start.tzinfo) - start
                            hours, remainder = divmod(int(uptime.total_seconds()), 3600)
                            minutes, seconds = divmod(remainder, 60)
                            await ctx.send(f"⏱ Стрим идет: {hours}ч {minutes}м")
                            return
                    
                    await ctx.send(" Стрим офлайн")
            else:
                await ctx.reply("ℹ Команда !uptime поддерживается только на Twitch")
                
        except Exception as e:
            logger.error(f"Error in !uptime: {e}")
            await ctx.reply("[ERROR] Ошибка")
