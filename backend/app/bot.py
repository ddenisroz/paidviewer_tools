import logging
from pathlib import Path
from typing import Dict, List, Optional
from dotenv import load_dotenv
from twitchio.ext import commands
from twitchio import Message

from app.core.config import settings
from app.services.state_service import StateService
from app.services.tts_service import TTSService
from app.services.audio_service import AudioService
from app.services.seventv_service import SevenTVService

load_dotenv()

logger = logging.getLogger(__name__)

class Bot(commands.Bot):
    def __init__(self, state_service: StateService, tts_service: TTSService, audio_service: AudioService):
        super().__init__(
            token=settings.TWITCH_BOT_TOKEN,
            prefix=settings.BOT_PREFIX,
            initial_channels=[] # Channels will be joined dynamically
        )
        self.tts_service: TTSService = tts_service
        self.audio_service: AudioService = audio_service
        self.state_service: StateService = state_service
        self.seven_tv_service = SevenTVService()
        self._is_stopped = False
        self._is_running = False
        self.channel_emotes: Dict[str, List[str]] = {}
        logger.info("Bot initialized and services configured.")
    
    def update_tts_service(self, tts_service: TTSService):
        """Обновляет ссылку на TTS сервис в боте"""
        self.tts_service = tts_service
        logger.info("TTS service updated in bot")

    @property
    def is_running(self) -> bool:
        """Проверяет, запущен ли бот"""
        return self._is_running and not self._is_stopped

    async def start(self) -> None:
        """Запускает бота"""
        if not self._is_running:
            self._is_running = True
            self._is_stopped = False
            await super().start()

    async def stop(self) -> None:
        """Останавливает бота"""
        if self._is_running:
            self._is_running = False
            self._is_stopped = True
            await super().close()

    async def event_ready(self) -> None:
        logger.info(f'Logged in as | {self.nick}')
        logger.info(f'User id is | {self.user_id}')

    async def add_channel(self, channel_name: str) -> None:
        """Joins a channel if not already in it."""
        channel_name_lower = channel_name.lower()
        if channel_name_lower not in [ch.name for ch in self.connected_channels]:
            await self.join_channels([channel_name_lower])
            logger.info(f"Successfully joined channel: {channel_name_lower}")
            await self.state_service.register_channel(channel_name_lower)
            
            # Fetch 7TV emotes for the channel
            try:
                users = await self.fetch_users(names=[channel_name_lower])
                if users:
                    user_id = users[0].id
                    emotes = await self.seven_tv_service.get_channel_emotes(user_id)
                    self.channel_emotes[channel_name_lower] = emotes
                    logger.info(f"Fetched {len(emotes)} 7TV emotes for channel '{channel_name_lower}'.")
            except Exception as e:
                logger.error(f"Failed to fetch 7TV emotes for {channel_name_lower}: {e}")

        else:
            logger.info(f"Bot is already in channel: {channel_name_lower}")

    async def remove_channel(self, channel_name: str) -> None:
        """Leaves a channel if in it."""
        channel_name_lower = channel_name.lower()
        if channel_name_lower in [ch.name for ch in self.connected_channels]:
            await self.part_channels([channel_name_lower])
            logger.info(f"Successfully left channel: {channel_name_lower}")
            await self.state_service.unregister_channel(channel_name_lower)
        else:
            logger.warning(f"Attempted to leave channel '{channel_name_lower}' but bot was not in it.")


    @commands.command(name='help')
    async def help_command(self, ctx: commands.Context) -> None:
        """Shows available commands."""
        channel_name = ctx.channel.name
        
        # Get channel settings to check which commands are enabled
        channel_settings = self.state_service.get_channel_settings(channel_name)
        custom_commands = channel_settings.get("custom_commands", {})
        
        # Default commands
        commands = {
            "help": {"command": "!help", "description": "Показать список всех доступных команд", "enabled": True},
            "tts": {"command": "!tts", "description": "Включить/выключить озвучку чата", "enabled": True},
            "play": {"command": "!play", "description": "Возобновить воспроизведение очереди", "enabled": True},
            "pause": {"command": "!pause", "description": "Пауза/возобновление видео", "enabled": True},
            "skip": {"command": "!skip", "description": "Пропустить текущее видео", "enabled": True},
            "volume": {"command": "!volume", "description": "Изменить громкость (0-100)", "enabled": True},
            "clear": {"command": "!clear", "description": "Очистить очередь сообщений", "enabled": True},
            "voice": {"command": "!voice", "description": "Изменить голос озвучки", "enabled": True},
            "speed": {"command": "!speed", "description": "Изменить скорость речи (0.5-2.0)", "enabled": True},
            "emotes": {"command": "!emotes", "description": "Включить/выключить озвучку смайлов", "enabled": True},
            "sr": {"command": "!sr", "description": "Заказать видео (YouTube URL)", "enabled": True}
        }
        
        # Merge with custom commands
        for cmd_key, cmd_data in custom_commands.items():
            if cmd_key in commands:
                commands[cmd_key].update(cmd_data)
            else:
                commands[cmd_key] = cmd_data
        
        # Filter enabled commands
        enabled_commands = {k: v for k, v in commands.items() if v.get("enabled", True)}
        
        if not enabled_commands:
            await ctx.send(f"@{ctx.author.name}, нет доступных команд.")
            return
        
        # Format commands message
        message_parts = [f"@{ctx.author.name}, доступные команды:"]
        
        # Group commands by category
        categories = {
            "Основные": ["help", "tts"],
            "YouTube": ["sr", "pause", "skip", "volume"],
            "Управление": ["play", "clear"],
            "Настройки": ["voice", "speed", "emotes"]
        }
        
        for category, cmd_keys in categories.items():
            category_commands = [f"{v['command']} - {v['description']}" for k, v in enabled_commands.items() if k in cmd_keys]
            if category_commands:
                message_parts.append(f"📋 {category}: {', '.join(category_commands)}")
        
        # Add any custom commands not in categories
        custom_cmd_keys = [k for k in enabled_commands.keys() if not any(k in cmd_list for cmd_list in categories.values())]
        if custom_cmd_keys:
            custom_commands_text = [f"{enabled_commands[k]['command']} - {enabled_commands[k]['description']}" for k in custom_cmd_keys]
            message_parts.append(f"🔧 Дополнительные: {', '.join(custom_commands_text)}")
        
        # Send message (split if too long)
        full_message = " | ".join(message_parts)
        if len(full_message) > 500:  # Twitch message limit
            await ctx.send(f"@{ctx.author.name}, доступные команды: {', '.join([v['command'] for v in enabled_commands.values()])}")
            await ctx.send(f"Подробности: https://payedviewer.com/commands")
        else:
            await ctx.send(full_message)

    @commands.command(name='voice')
    async def set_voice_command(self, ctx: commands.Context, *, voice_name: str) -> None:
        """Sets the user's preferred voice for TTS."""
        author_name = ctx.author.name.lower()
        channel_name = ctx.channel.name

        cleaned_voice_name = voice_name.strip().lower()
        if not cleaned_voice_name:
            await ctx.send(f"@{ctx.author.name}, пожалуйста, укажите название голоса. Пример: !voice yourchy")
            return

        if self.tts_service.voice_exists(cleaned_voice_name, channel_name):
            self.state_service.set_user_voice(channel_name, author_name, cleaned_voice_name)
            await ctx.send(f"@{ctx.author.name}, ваш голос изменен на '{cleaned_voice_name}'.")
        else:
            await ctx.send(f"@{ctx.author.name}, голос '{cleaned_voice_name}' не найден для этого канала.")

    @commands.command(name='tts')
    async def tts_toggle_command(self, ctx: commands.Context, *, action: Optional[str] = None) -> None:
        """Toggle TTS on/off."""
        channel_name = ctx.channel.name
        author_name = ctx.author.name.lower()
        
        # Check if user is moderator or broadcaster
        if not (ctx.author.is_mod or ctx.author.is_broadcaster):
            await ctx.send(f"@{ctx.author.name}, эта команда доступна только модераторам и стримеру.")
            return
        
        if action and action.lower() in ['on', 'вкл', 'включить']:
            await self.state_service.set_tts_enabled(channel_name, True)
            await ctx.send(f"@{ctx.author.name}, озвучка чата включена.")
        elif action and action.lower() in ['off', 'выкл', 'выключить']:
            await self.state_service.set_tts_enabled(channel_name, False)
            await ctx.send(f"@{ctx.author.name}, озвучка чата выключена.")
        else:
            current_state = self.state_service.is_tts_enabled(channel_name)
            new_state = not current_state
            await self.state_service.set_tts_enabled(channel_name, new_state)
            status = "включена" if new_state else "выключена"
            await ctx.send(f"@{ctx.author.name}, озвучка чата {status}.")

    @commands.command(name='volume')
    async def volume_command(self, ctx: commands.Context, *, volume: Optional[str] = None) -> None:
        """Set TTS volume."""
        channel_name = ctx.channel.name
        author_name = ctx.author.name.lower()
        
        # Check if user is moderator or broadcaster
        if not (ctx.author.is_mod or ctx.author.is_broadcaster):
            await ctx.send(f"@{ctx.author.name}, эта команда доступна только модераторам и стримеру.")
            return
        
        if not volume:
            await ctx.send(f"@{ctx.author.name}, укажите громкость от 0 до 100. Пример: !volume 50")
            return
        
        try:
            volume_value = int(volume)
            if 0 <= volume_value <= 100:
                # Update global volume in channel settings
                channel_settings = self.state_service.get_channel_settings(channel_name)
                channel_settings["volume"] = volume_value / 100.0  # Convert to 0.0-1.0 range
                await self.state_service.update_channel_settings(channel_name, {"volume": volume_value / 100.0})
                await ctx.send(f"@{ctx.author.name}, громкость установлена на {volume_value}%.")
            else:
                await ctx.send(f"@{ctx.author.name}, громкость должна быть от 0 до 100.")
        except ValueError:
            await ctx.send(f"@{ctx.author.name}, укажите число от 0 до 100. Пример: !volume 50")

    @commands.command(name='speed')
    async def speed_command(self, ctx: commands.Context, *, speed: Optional[str] = None) -> None:
        """Set TTS speed."""
        channel_name = ctx.channel.name
        author_name = ctx.author.name.lower()
        
        # Check if user is moderator or broadcaster
        if not (ctx.author.is_mod or ctx.author.is_broadcaster):
            await ctx.send(f"@{ctx.author.name}, эта команда доступна только модераторам и стримеру.")
            return
        
        if not speed:
            await ctx.send(f"@{ctx.author.name}, укажите скорость от 0.5 до 2.0. Пример: !speed 1.2")
            return
        
        try:
            speed_value = float(speed)
            if 0.5 <= speed_value <= 2.0:
                await self.state_service.update_channel_settings(channel_name, {"speed": speed_value})
                await ctx.send(f"@{ctx.author.name}, скорость речи установлена на {speed_value}.")
            else:
                await ctx.send(f"@{ctx.author.name}, скорость должна быть от 0.5 до 2.0.")
        except ValueError:
            await ctx.send(f"@{ctx.author.name}, укажите число от 0.5 до 2.0. Пример: !speed 1.2")

    @commands.command(name='sr')
    async def song_request_command(self, ctx: commands.Context, *, url: Optional[str] = None) -> None:
        """Request a YouTube video to be added to the queue."""
        channel_name = ctx.channel.name
        author_name = ctx.author.name
        
        if not url:
            await ctx.send(f"@{author_name}, укажите YouTube URL. Пример: !sr https://youtube.com/watch?v=...")
            return
            
        # Простая проверка что это YouTube URL
        if not ("youtube.com" in url.lower() or "youtu.be" in url.lower()):
            await ctx.send(f"@{author_name}, пожалуйста, укажите корректный YouTube URL.")
            return
        
        # Добавляем видео в очередь (пока что просто сохраняем в state)
        channel_settings = self.state_service.get_channel_settings(channel_name)
        youtube_queue = channel_settings.get("youtube_queue", [])
        
        video_data = {
            "url": url,
            "requested_by": author_name,
            "timestamp": int(__import__("time").time())
        }
        
        youtube_queue.append(video_data)
        await self.state_service.update_channel_settings(channel_name, {"youtube_queue": youtube_queue})
        
        await ctx.send(f"@{author_name}, видео добавлено в очередь! Позиция в очереди: {len(youtube_queue)}")

    @commands.command(name='skip')
    async def skip_video_command(self, ctx: commands.Context) -> None:
        """Skip the current video (mods only)."""
        channel_name = ctx.channel.name
        author_name = ctx.author.name
        
        # Проверяем права доступа (модератор или стример)
        if not (ctx.author.is_mod or ctx.author.name.lower() == channel_name.lower()):
            await ctx.send(f"@{author_name}, только модераторы могут пропускать видео.")
            return
        
        # Логика пропуска видео (пока что заглушка)
        await ctx.send(f"@{author_name}, текущее видео пропущено.")

    @commands.command(name='pause')
    async def pause_video_command(self, ctx: commands.Context) -> None:
        """Pause/resume the current video (mods only)."""
        channel_name = ctx.channel.name
        author_name = ctx.author.name
        
        # Проверяем права доступа (модератор или стример)
        if not (ctx.author.is_mod or ctx.author.name.lower() == channel_name.lower()):
            await ctx.send(f"@{author_name}, только модераторы могут управлять паузой.")
            return
        
        # Логика паузы/возобновления (пока что заглушка)
        channel_settings = self.state_service.get_channel_settings(channel_name)
        is_paused = channel_settings.get("youtube_paused", False)
        
        new_state = not is_paused
        await self.state_service.update_channel_settings(channel_name, {"youtube_paused": new_state})
        
        status = "поставлено на паузу" if new_state else "возобновлено"
        await ctx.send(f"@{author_name}, воспроизведение {status}.")

    @commands.command(name='volume')
    async def volume_command(self, ctx: commands.Context, *, volume: Optional[str] = None) -> None:
        """Change video volume (mods only)."""
        channel_name = ctx.channel.name
        author_name = ctx.author.name
        
        # Проверяем права доступа (модератор или стример)
        if not (ctx.author.is_mod or ctx.author.name.lower() == channel_name.lower()):
            await ctx.send(f"@{author_name}, только модераторы могут изменять громкость.")
            return
        
        if not volume:
            # Показываем текущую громкость
            channel_settings = self.state_service.get_channel_settings(channel_name)
            current_volume = channel_settings.get("youtube_volume", 50)
            await ctx.send(f"@{author_name}, текущая громкость: {current_volume}%. Использование: !volume [0-100]")
            return
        
        try:
            volume_value = int(volume)
            if 0 <= volume_value <= 100:
                await self.state_service.update_channel_settings(channel_name, {"youtube_volume": volume_value})
                await ctx.send(f"@{author_name}, громкость установлена на {volume_value}%.")
            else:
                await ctx.send(f"@{author_name}, громкость должна быть от 0 до 100.")
        except ValueError:
            await ctx.send(f"@{author_name}, укажите число от 0 до 100. Пример: !volume 75")


    async def event_message(self, message: Message) -> None:
        from app.core.config import settings
        
        # Debug logging
        author_name = message.author.name if message.author else "Unknown"
        logger.info(f"Received message from {author_name} in {message.channel.name}: {message.content}")
        
        if message.echo or message.content.startswith(settings.BOT_PREFIX):
            # Let the command handler process the command
            await self.handle_commands(message)
            return

        channel_name = message.channel.name
        author_name = message.author.name.lower()

        # Check if Twitch integration is enabled for the channel
        integrations = self.state_service.get_integrations(channel_name)
        if not integrations.get("twitch_enabled", False):
            logger.info(f"Twitch integration disabled for channel {channel_name}")
            return

        # Check if TTS is enabled for the channel
        if not self.state_service.is_tts_enabled(channel_name):
            logger.info(f"TTS disabled for channel {channel_name}")
            return

        # Check if TTS service is loaded and ready
        if not self.tts_service or not self.tts_service.is_ready():
            logger.info(f"TTS service not ready for channel {channel_name}")
            return

        # Get channel settings
        channel_settings = self.state_service.get_channel_settings(channel_name)
        read_emotes = channel_settings.get("read_emotes", False)

        message_content = message.content
        words = message_content.split()

        # Filter out emotes if read_emotes is False
        if not read_emotes:
            channel_emotes = self.channel_emotes.get(channel_name, [])
            words = [word for word in words if word not in channel_emotes]
            message_content = " ".join(words)

        # Skip single-character messages that are not emotes (or if emotes are disabled)
        if len(message_content.strip()) <= 1:
            logger.info(f"Skipping single-character message from {author_name} in {channel_name}.")
            return

        # Limit character count to prevent crashes on very long messages
        if len(message_content) > 350:
            logger.warning(f"Message from {author_name} exceeds character limit ({len(message.content)} > 350). Skipping TTS.")
            # Optionally send a message back to the channel
            # await message.channel.send(f"@{author_name}, ваше сообщение слишком длинное для TTS.")
            return

        logger.info(f"Received message from {author_name} in {channel_name}: {message.content}")

        # Determine which voice to use
        selected_voice_name = self.state_service.get_user_voice(channel_name, author_name) or "default"
        
        # Verify that the selected voice still exists, otherwise revert to default
        if selected_voice_name != "default" and not self.tts_service.voice_exists(selected_voice_name, channel_name):
            logger.warning(f"Voice file '{selected_voice_name}' for user '{author_name}' not found. Reverting to default.")
            self.state_service.remove_user_voice(channel_name, author_name)
            selected_voice_name = "default"

        try:
            wav_path = await self.tts_service.synthesize_speech(
                text=message_content,
                voice_name=selected_voice_name,
                channel_name=channel_name
            )
            if wav_path:
                self.audio_service.add_to_queue(wav_path)
        except Exception as e:
            logger.error(f"Error synthesizing audio: {e}", exc_info=True)

    def stop(self) -> None:
        self._is_stopped = True

# The singleton instance is no longer created here.
# It will be instantiated in the main application's lifespan.
