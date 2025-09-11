import logging
from pathlib import Path
from dotenv import load_dotenv
from twitchio.ext import commands
from app.core.config import settings
from app.services.state_service import StateService
from app.services.tts_service import TTSService
from app.services.audio_service import AudioService

load_dotenv()

logger = logging.getLogger(__name__)

class Bot(commands.Bot):
    def __init__(self, tts_service: TTSService, audio_service: AudioService, state_service: StateService):
        super().__init__(token=settings.TWITCH_BOT_TOKEN, prefix='!', initial_channels=[])
        self.tts_service = tts_service
        self.audio_service = audio_service
        self.state_service = state_service
        self.user_voices = {} # Словарь для хранения выбранных голосов {user_login: voice_name}
        logger.info("Bot initialized and waiting for channels...")

    async def event_ready(self):
        logger.info(f'Logged in as | {self.nick}')
        logger.info(f'User id is | {self.user_id}')

    async def add_channel(self, channel_name: str):
        """Joins a channel if not already in it."""
        channel_name_lower = channel_name.lower()
        if channel_name_lower not in [ch.name for ch in self.connected_channels]:
            await self.join_channels([channel_name_lower])
            logger.info(f"Successfully joined channel: {channel_name_lower}")
            self.state_service.register_channel(channel_name_lower)
        else:
            logger.info(f"Bot is already in channel: {channel_name_lower}")

    async def remove_channel(self, channel_name: str):
        """Leaves a channel if in it."""
        channel_name_lower = channel_name.lower()
        if channel_name_lower in [ch.name for ch in self.connected_channels]:
            await self.part_channels([channel_name_lower])
            logger.info(f"Successfully left channel: {channel_name_lower}")
            self.state_service.unregister_channel(channel_name_lower)
        else:
            logger.warning(f"Attempted to leave channel '{channel_name_lower}' but bot was not in it.")


    async def event_message(self, message):
        if message.echo:
            return

        channel_name = message.channel.name
        author_name = message.author.name.lower()

        # Обработка команды !voice
        if message.content.lower().startswith('!voice '):
            parts = message.content.split(' ', 1)
            if len(parts) > 1 and parts[1].strip():
                voice_name = parts[1].strip().lower()
                voice_path = Path(f"voices/{channel_name}/{voice_name}.wav")

                if voice_path.exists():
                    self.user_voices[author_name] = voice_name
                    await message.channel.send(f"@{message.author.name}, ваш голос изменен на '{voice_name}'.")
                else:
                    await message.channel.send(f"@{message.author.name}, голос '{voice_name}' не найден.")
            return # Прекращаем обработку, т.к. это была команда

        # Проверяем, включен ли TTS для канала
        if not self.state_service.is_tts_enabled(channel_name):
            return

        logger.info(f"Received message from {author_name} in {channel_name}: {message.content}")

        # Определяем, какой голос использовать
        selected_voice_name = self.user_voices.get(author_name)
        voice_path = None
        if selected_voice_name:
            path_to_check = Path(f"voices/{channel_name}/{selected_voice_name}.wav")
            if path_to_check.exists():
                voice_path = str(path_to_check)
                logger.info(f"Using custom voice '{selected_voice_name}' for user '{author_name}'.")
            else:
                # Голос был выбран, но файл удалили
                logger.warning(f"Voice file '{selected_voice_name}' for user '{author_name}' not found. Using default voice.")
                del self.user_voices[author_name]

        try:
            # Corrected the method name from synthesize_audio to synthesize_speech
            wav_path = self.tts_service.synthesize_speech(
                text=message.content, 
                voice_name=selected_voice_name if selected_voice_name else "default",
                channel_name=channel_name
            )
            if wav_path:
                self.audio_service.add_to_queue(wav_path)
        except Exception as e:
            logger.error(f"Error synthesizing audio: {e}", exc_info=True)
            # Avoid spamming chat with error messages
            # await message.channel.send(f"@{message.author.name}, произошла ошибка при синтезе речи.")
