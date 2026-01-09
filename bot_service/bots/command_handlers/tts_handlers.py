# bots/command_handlers/tts_handlers.py
"""
TTS Command Handlers - Voice management commands
"""
import logging
from bots.command_handlers import BaseCommandHandler, PlatformContext

logger = logging.getLogger('bot_service.commands.tts')


class VoiceHandler(BaseCommandHandler):
    """Handler for !voice command - show/change TTS voice"""
    
    name = "voice"
    aliases = ["ttsvoice", "голос"]
    description = "Show or change TTS voice"
    requires_permission = False
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from core.database import User, TTSUserSettings
            from sqlalchemy import func
            
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("❌ Канал не найден")
                return
            
            from repositories.tts_settings_repository import TTSSettingsRepository
            settings_repo = TTSSettingsRepository(db)
            settings = settings_repo.get_or_create(user_id=user.id)
            
            current_voice = settings.voice
            
            if not ctx.args:
                await ctx.send(f"🎤 Текущий голос: {current_voice}")
            else:
                new_voice = ctx.args.strip().lower()
                settings_repo.update_settings(settings, {'voice': new_voice})
                db.commit()
                await ctx.send(f"✅ Голос изменен на: {new_voice}")
                
        except Exception as e:
            logger.error(f"Error in !voice: {e}")
            await ctx.reply("❌ Ошибка")


class RandomVoiceHandler(BaseCommandHandler):
    """Handler for !randomvoice command"""
    
    name = "randomvoice"
    aliases = ["rv", "случайныйголос"]
    description = "Set random voice for TTS"
    requires_permission = True
    permission_level = "moderator"
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            import random
            from core.database import User, TTSUserSettings
            from sqlalchemy import func
            
            # List of available voices
            voices = ["female_1", "female_2", "male_1", "male_2", "robot", "child"]
            
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("❌ Канал не найден")
                return
            
            random_voice = random.choice(voices)
            
            from repositories.tts_settings_repository import TTSSettingsRepository
            settings_repo = TTSSettingsRepository(db)
            settings = settings_repo.get_or_create(user_id=user.id)
            settings_repo.update_settings(settings, {'voice': random_voice})
            db.commit()
            await ctx.send(f"🎲 Случайный голос: {random_voice}")
                
        except Exception as e:
            logger.error(f"Error in !randomvoice: {e}")
            await ctx.reply("❌ Ошибка")


class TTSVolumeHandler(BaseCommandHandler):
    """Handler for !ttsvolume command"""
    
    name = "ttsvolume"
    aliases = ["volume", "громкость"]
    description = "Set TTS volume (0-100)"
    requires_permission = True
    permission_level = "moderator"
    
    async def execute(self, ctx: PlatformContext, db) -> None:
        try:
            from core.database import User, AudioSettings
            from sqlalchemy import func
            
            from repositories.user_repository import UserRepository
            repo = UserRepository(db)
            if ctx.platform == 'twitch':
                user = repo.get_by_twitch_username(ctx.channel_name)
            else:
                user = repo.get_by_vk_channel_name(ctx.channel_name)
            
            if not user:
                await ctx.reply("❌ Канал не найден")
                return
            
            from repositories.audio_settings_repository import AudioSettingsRepository
            audio_repo = AudioSettingsRepository(db)
            settings = audio_repo.get_or_create(user.id)
            
            current_volume = settings.website_volume
            
            if not ctx.args:
                await ctx.send(f"🔊 Громкость TTS: {current_volume}%")
                return
            
            try:
                new_volume = int(ctx.args.strip())
                if not 0 <= new_volume <= 100:
                    raise ValueError("Invalid range")
            except ValueError:
                await ctx.reply("❌ Укажите число от 0 до 100")
                return
            
            audio_repo.update_volume(user.id, website_volume=new_volume)
            await ctx.send(f"🔊 Громкость TTS: {new_volume}%")
                
        except Exception as e:
            logger.error(f"Error in !ttsvolume: {e}")
            await ctx.reply("❌ Ошибка")
