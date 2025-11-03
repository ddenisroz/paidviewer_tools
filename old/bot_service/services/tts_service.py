# bot_service/services/tts_service.py
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
import logging
from datetime import datetime

from core.database import FilteredWord, AudioSettings, TTSUserSettings, TTSBlockedUser

logger = logging.getLogger(__name__)

class TTSService:
    def __init__(self, db: Session):
        self.db = db

    async def get_filtered_words(self, user_id: int) -> List[dict]:
        """Получить список отфильтрованных слов для пользователя"""
        try:
            words = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.user_id == user_id,
                    FilteredWord.is_active == True
                )
            ).all()
            
            return [
                {
                    'id': word.id,
                    'word': word.word,
                    'platform': word.platform,
                    'created_at': word.created_at.isoformat() if word.created_at else None
                }
                for word in words
            ]
        except Exception as e:
            logger.error(f"Error getting filtered words: {e}")
            return []

    async def add_filtered_word(self, user_id: int, word: str, platform: str = 'all') -> bool:
        """Добавить слово в фильтр"""
        try:
            # Проверяем, не существует ли уже такое слово
            existing = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.user_id == user_id,
                    FilteredWord.word == word.lower(),
                    FilteredWord.platform == platform
                )
            ).first()
            
            if existing:
                logger.warning(f"Word '{word}' already exists in filter for user {user_id}")
                return False
            
            filtered_word = FilteredWord(
                user_id=user_id,
                word=word.lower(),
                platform=platform
            )
            
            self.db.add(filtered_word)
            self.db.commit()
            
            logger.info(f"Added word '{word}' to filter for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding filtered word: {e}")
            self.db.rollback()
            return False

    async def remove_filtered_word(self, user_id: int, word_id: int) -> bool:
        """Удалить слово из фильтра"""
        try:
            word = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.id == word_id,
                    FilteredWord.user_id == user_id
                )
            ).first()
            
            if not word:
                logger.warning(f"Word with ID {word_id} not found for user {user_id}")
                return False
            
            self.db.delete(word)
            self.db.commit()
            
            logger.info(f"Removed word '{word.word}' from filter for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error removing filtered word: {e}")
            self.db.rollback()
            return False

    async def check_text_filter(self, text: str, user_id: int, platform: str = "all") -> bool:
        """Проверить, содержит ли текст отфильтрованные слова"""
        try:
            text_lower = text.lower()
            
            # Получаем все активные фильтры для пользователя
            filters = self.db.query(FilteredWord).filter(
                and_(
                    FilteredWord.user_id == user_id,
                    FilteredWord.is_active == True,
                    FilteredWord.platform.in_(['all', platform])
                )
            ).all()
            
            # Проверяем каждое слово
            for filter_word in filters:
                if filter_word.word.lower() in text_lower:
                    logger.info(f"Text filtered: '{text}' contains blocked word '{filter_word.word}'")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking text filter: {e}")
            return False

    async def get_audio_settings(self, user_id: int) -> dict:
        """Получить настройки звука пользователя"""
        try:
            settings = self.db.query(AudioSettings).filter(
                AudioSettings.user_id == user_id
            ).first()
            
            if settings:
                return {
                    "websiteVolume": settings.website_volume
                }
            else:
                # Создаем настройки по умолчанию для любого пользователя (включая гостей)
                default_settings = AudioSettings(
                    user_id=user_id,
                    website_volume=50
                )
                self.db.add(default_settings)
                self.db.commit()
                return {
                    "websiteVolume": 50
                }
        except Exception as e:
            logger.error(f"Error getting audio settings: {e}")
            return {"websiteVolume": 50}

    async def save_audio_settings(self, user_id: int, website_volume: int) -> bool:
        """Сохранить настройки звука пользователя"""
        try:
            settings = self.db.query(AudioSettings).filter(
                AudioSettings.user_id == user_id
            ).first()
            
            if settings:
                # Обновляем существующие настройки
                settings.website_volume = website_volume
                settings.updated_at = datetime.utcnow()
            else:
                # Создаем новые настройки для любого пользователя (включая гостей)
                settings = AudioSettings(
                    user_id=user_id,
                    website_volume=website_volume
                )
                self.db.add(settings)
            
            self.db.commit()
            logger.info(f"Audio settings saved for user {user_id}: website={website_volume}")
            return True
        except Exception as e:
            logger.error(f"Error saving audio settings: {e}")
            self.db.rollback()
            return False

    async def get_tts_settings(self, user_id: int = None, session_id: str = None) -> dict:
        """Получить базовые настройки TTS пользователя"""
        try:
            # Ищем настройки по user_id или session_id
            if user_id is not None:
                settings = self.db.query(TTSUserSettings).filter(
                    TTSUserSettings.user_id == user_id
                ).first()
            elif session_id is not None:
                settings = self.db.query(TTSUserSettings).filter(
                    TTSUserSettings.session_id == session_id
                ).first()
            else:
                raise ValueError("Either user_id or session_id must be provided")
            
            if settings:
                return {
                    "engine": settings.engine,
                    "voice": settings.voice,
                    "listeningMode": settings.listening_mode,
                    "enable7TV": settings.enable_7tv,
                    "enableTwitch": settings.enable_twitch,
                    "enableLexiconFilter": settings.enable_lexicon_filter,
                    "enableCustomLexicon": settings.enable_custom_lexicon,
                    "maxMessageLength": settings.max_message_length,
                    "skipCommands": settings.skip_commands,
                    "useLocalTTS": settings.use_local_tts
                }
            else:
                # Создаем настройки по умолчанию для любого пользователя (включая гостей)
                default_settings = TTSUserSettings(
                    user_id=user_id,
                    session_id=session_id,
                    engine='gtts',
                    voice='female_1',
                    listening_mode='website',
                    enable_7tv=False,
                    enable_twitch=False,
                    enable_lexicon_filter=True,
                    enable_custom_lexicon=False,
                    max_message_length=500,
                    skip_commands=True
                )
                self.db.add(default_settings)
                self.db.commit()
                return {
                    "engine": 'gtts',
                    "voice": 'female_1',
                    "listeningMode": 'website',
                    "enable7TV": False,
                    "enableTwitch": False,
                    "enableLexiconFilter": True,
                    "enableCustomLexicon": False,
                    "maxMessageLength": 500,
                    "skipCommands": True,
                    "useLocalTTS": False
                }
        except Exception as e:
            logger.error(f"Error getting TTS settings: {e}")
            return {
                "enable7TV": False,
                "enableTwitch": False,
                "enableLexiconFilter": True,
                "enableCustomLexicon": False
            }

    async def save_tts_settings(self, enable_7tv: bool, enable_twitch: bool, 
                               enable_lexicon_filter: bool, enable_custom_lexicon: bool, 
                               user_id: int = None, session_id: str = None,
                               engine: str = None, voice: str = None, listening_mode: str = None,
                               max_message_length: int = None, skip_commands: bool = None,
                               use_local_tts: bool = None,
                               filter_replies: bool = None, filter_mentions: bool = None) -> bool:
        """Сохранить базовые настройки TTS пользователя"""
        try:
            # Ищем настройки по user_id или session_id
            if user_id is not None:
                settings = self.db.query(TTSUserSettings).filter(
                    TTSUserSettings.user_id == user_id
                ).first()
            elif session_id is not None:
                settings = self.db.query(TTSUserSettings).filter(
                    TTSUserSettings.session_id == session_id
                ).first()
            else:
                raise ValueError("Either user_id or session_id must be provided")
            
            if settings:
                # Обновляем существующие настройки
                settings.enable_7tv = enable_7tv
                settings.enable_twitch = enable_twitch
                settings.enable_lexicon_filter = enable_lexicon_filter
                settings.enable_custom_lexicon = enable_custom_lexicon
                settings.updated_at = datetime.utcnow()
                
                # Обновляем дополнительные поля если они переданы
                if engine is not None:
                    settings.engine = engine
                if voice is not None:
                    settings.voice = voice
                if listening_mode is not None:
                    settings.listening_mode = listening_mode
                if max_message_length is not None:
                    settings.max_message_length = max_message_length
                if skip_commands is not None:
                    settings.skip_commands = skip_commands
                if use_local_tts is not None:
                    settings.use_local_tts = use_local_tts
                if filter_replies is not None:
                    settings.filter_replies = filter_replies
                if filter_mentions is not None:
                    settings.filter_mentions = filter_mentions
            else:
                # Создаем новые настройки для любого пользователя (включая гостей)
                settings = TTSUserSettings(
                    user_id=user_id,
                    session_id=session_id,
                    engine=engine or 'gtts',
                    voice=voice or 'female_1',
                    listening_mode=listening_mode or 'website',
                    enable_7tv=enable_7tv,
                    enable_twitch=enable_twitch,
                    enable_lexicon_filter=enable_lexicon_filter,
                    enable_custom_lexicon=enable_custom_lexicon,
                    max_message_length=max_message_length or 500,
                    skip_commands=skip_commands if skip_commands is not None else True,
                    filter_replies=filter_replies if filter_replies is not None else False,
                    filter_mentions=filter_mentions if filter_mentions is not None else False
                )
                self.db.add(settings)
            
            self.db.commit()
            logger.info(f"TTS settings saved for user {user_id}: engine={settings.engine}, voice={settings.voice}, "
                       f"mode={settings.listening_mode}, 7TV={enable_7tv}, Twitch={enable_twitch}")
            return True
        except Exception as e:
            logger.error(f"Error saving TTS settings: {e}")
            self.db.rollback()
            return False

    async def get_blocked_users(self, user_id: int) -> List[dict]:
        """Получить список заблокированных пользователей"""
        try:
            blocked_users = self.db.query(TTSBlockedUser).filter(
                TTSBlockedUser.user_id == user_id
            ).all()
            
            return [
                {
                    'id': blocked.id,
                    'username': blocked.username,
                    'channel_name': blocked.channel_name,
                    'platform': blocked.platform,
                    'blocked_at': blocked.blocked_at.isoformat() if blocked.blocked_at else None
                }
                for blocked in blocked_users
            ]
        except Exception as e:
            logger.error(f"Error getting blocked users: {e}")
            return []

    async def block_user(self, user_id: int, channel_name: str, platform: str, username: str) -> bool:
        """Заблокировать пользователя"""
        try:
            # Проверяем, не заблокирован ли уже пользователь
            existing = self.db.query(TTSBlockedUser).filter(
                and_(
                    TTSBlockedUser.user_id == user_id,
                    TTSBlockedUser.channel_name == channel_name,
                    TTSBlockedUser.platform == platform,
                    TTSBlockedUser.username == username.lower()
                )
            ).first()
            
            if existing:
                logger.warning(f"User '{username}' already blocked for user {user_id}")
                return False
            
            blocked_user = TTSBlockedUser(
                user_id=user_id,
                channel_name=channel_name,
                platform=platform,
                username=username.lower()
            )
            
            self.db.add(blocked_user)
            self.db.commit()
            
            logger.info(f"Blocked user '{username}' for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error blocking user: {e}")
            self.db.rollback()
            return False

    async def unblock_user(self, user_id: int, channel_name: str, platform: str, username: str) -> bool:
        """Разблокировать пользователя"""
        try:
            blocked_user = self.db.query(TTSBlockedUser).filter(
                and_(
                    TTSBlockedUser.user_id == user_id,
                    TTSBlockedUser.channel_name == channel_name,
                    TTSBlockedUser.platform == platform,
                    TTSBlockedUser.username == username.lower()
                )
            ).first()
            
            if not blocked_user:
                logger.warning(f"User '{username}' not found in blacklist for user {user_id}")
                return False
            
            self.db.delete(blocked_user)
            self.db.commit()
            
            logger.info(f"Unblocked user '{username}' for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error unblocking user: {e}")
            self.db.rollback()
            return False

    async def enable_tts(self, user_id: int = None, session_id: str = None) -> bool:
        """Включить TTS для пользователя (включая гостей)"""
        try:
            logger.info(f"🎙️ [TTS Service] enable_tts called with user_id={user_id}, session_id={session_id}")
            
            # Для гостей TTS всегда доступен
            if session_id is not None:
                logger.info(f"TTS enabled for guest user")
                return True
            
            # Для обычных пользователей сохраняем в БД
            if user_id is None:
                logger.error(f"❌ [TTS Service] user_id is None for authenticated user")
                return False
            
            from core.database import User
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"❌ [TTS Service] User {user_id} not found in database")
                return False
            
            # Сохраняем состояние TTS в БД
            user.tts_enabled = True
            self.db.commit()
            
            # Добавляем канал в connection manager
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            if user.twitch_username:
                connection_manager.enable_tts_for_channel(user.twitch_username.lower())
                logger.info(f"✅ TTS enabled for Twitch channel: {user.twitch_username}")
            
            # Для VK используем platform_user_id из токена
            from core.database import UserToken
            vk_token = self.db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == 'vk'
            ).first()
            if vk_token and vk_token.platform_user_id:
                connection_manager.enable_tts_for_channel(vk_token.platform_user_id)
                logger.info(f"✅ TTS enabled for VK channel: {vk_token.platform_user_id}")
            
            logger.info(f"✅ TTS enabled for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"❌ [TTS Service] Error enabling TTS: {e}")
            logger.error(f"❌ [TTS Service] Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ [TTS Service] Traceback: {traceback.format_exc()}")
            self.db.rollback()
            return False

    async def disable_tts(self, user_id: int = None, session_id: str = None) -> bool:
        """Отключить TTS для пользователя (включая гостей)"""
        try:
            logger.info(f"🎙️ [TTS Service] disable_tts called with user_id={user_id}, session_id={session_id}")
            
            # Для гостей TTS всегда доступен, но можно "отключить"
            if session_id is not None:
                logger.info(f"TTS disabled for guest user")
                return True
            
            # Для обычных пользователей сохраняем в БД
            if user_id is None:
                logger.error(f"❌ [TTS Service] user_id is None for authenticated user")
                return False
            
            from core.database import User
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"❌ [TTS Service] User {user_id} not found in database")
                return False
            
            # Сохраняем состояние TTS в БД
            user.tts_enabled = False
            self.db.commit()
            
            # Удаляем канал из connection manager
            from core.connection_manager import get_connection_manager
            connection_manager = get_connection_manager()
            if user.twitch_username:
                connection_manager.disable_tts_for_channel(user.twitch_username.lower())
                logger.info(f"⏸️ TTS disabled for Twitch channel: {user.twitch_username}")
            
            # Для VK используем platform_user_id из токена
            from core.database import UserToken
            vk_token = self.db.query(UserToken).filter(
                UserToken.user_id == user_id,
                UserToken.platform == 'vk'
            ).first()
            if vk_token and vk_token.platform_user_id:
                connection_manager.disable_tts_for_channel(vk_token.platform_user_id)
                logger.info(f"⏸️ TTS disabled for VK channel: {vk_token.platform_user_id}")
            
            logger.info(f"⏸️ TTS disabled for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"❌ [TTS Service] Error disabling TTS: {e}")
            logger.error(f"❌ [TTS Service] Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ [TTS Service] Traceback: {traceback.format_exc()}")
            self.db.rollback()
            return False

    async def save_listening_mode(self, user_id: int, listening_mode: str) -> bool:
        """Сохранить режим прослушивания пользователя"""
        try:
            from core.database import User
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found")
                return False
            
            user.tts_listening_mode = listening_mode
            self.db.commit()
            
            logger.info(f"Listening mode saved for user {user_id}: {listening_mode}")
            return True
        except Exception as e:
            logger.error(f"Error saving listening mode: {e}")
            self.db.rollback()
            return False

    async def generate_obs_token(self, user_id: int) -> str:
        """Сгенерировать токен для OBS"""
        try:
            from core.database import User
            import secrets
            import string
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found")
                return None
            
            # Проверяем, есть ли уже токен у пользователя
            if hasattr(user, 'obs_token') and user.obs_token:
                logger.info(f"User {user_id} already has OBS token: {user.obs_token}")
                return user.obs_token
            
            # Генерируем новый токен
            token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
            
            # Сохраняем токен в базе данных
            user.obs_token = token
            self.db.commit()
            
            logger.info(f"Generated OBS token for user {user_id}: {token}")
            return token
        except Exception as e:
            logger.error(f"Error generating OBS token: {e}")
            return None

    async def regenerate_obs_token(self, user_id: int) -> str:
        """Перегенерировать токен для OBS"""
        try:
            from core.database import User
            import secrets
            import string
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found")
                return None
            
            # Генерируем новый токен
            token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
            
            # Сохраняем новый токен в базе данных
            user.obs_token = token
            self.db.commit()
            
            logger.info(f"Regenerated OBS token for user {user_id}: {token}")
            return token
        except Exception as e:
            logger.error(f"Error regenerating OBS token: {e}")
            return None

    async def save_platform_settings(self, user_id: int, enabled_platforms: List[str]) -> bool:
        """Сохранить настройки платформ"""
        try:
            # Здесь можно добавить логику сохранения настроек платформ
            # Пока просто возвращаем True
            logger.info(f"Platform settings saved for user {user_id}: {enabled_platforms}")
            return True
        except Exception as e:
            logger.error(f"Error saving platform settings: {e}")
            return False

    async def set_voice(self, user_id: int, voice_name: str, db: Session) -> bool:
        """Установить голос для пользователя (вызывается из команды !voice)"""
        try:
            # Проверяем существование голоса в TTS Service
            import httpx
            import os
            from constants import DEFAULT_TTS_SERVICE_URL
            
            tts_service_url = os.getenv('TTS_SERVICE_URL', DEFAULT_TTS_SERVICE_URL)
            
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    # Проверяем глобальные голоса
                    response = await client.get(f"{tts_service_url}/api/tts/voices/global")
                    if response.status_code == 200:
                        global_voices = response.json().get('voices', [])
                        voice_exists_global = any(v.get('name') == voice_name.lower() for v in global_voices)
                        
                        # Проверяем пользовательские голоса
                        response_user = await client.get(f"{tts_service_url}/api/tts/user/voices/{user_id}")
                        user_voices = []
                        if response_user.status_code == 200:
                            user_voices = response_user.json().get('voices', [])
                        
                        voice_exists_user = any(v.get('name') == voice_name.lower() for v in user_voices)
                        
                        if not (voice_exists_global or voice_exists_user):
                            logger.warning(f"Voice '{voice_name}' not found in TTS Service")
                            return False
            except Exception as e:
                logger.error(f"Error checking voice in TTS Service: {e}")
                # Не блокируем, если TTS Service недоступен - просто продолжаем
            
            # Сохраняем голос в TTSUserSettings
            settings = db.query(TTSUserSettings).filter(
                TTSUserSettings.user_id == user_id
            ).first()
            
            if settings:
                settings.voice = voice_name.lower()
                settings.updated_at = datetime.utcnow()
                logger.info(f"✅ Voice updated to '{voice_name}' for user {user_id}")
            else:
                # Создаем новые настройки если их нет
                settings = TTSUserSettings(
                    user_id=user_id,
                    voice=voice_name.lower(),
                    engine='f5',  # По умолчанию F5-TTS
                    listening_mode='website',
                    enable_7tv=False,
                    enable_twitch=False,
                    enable_lexicon_filter=True,
                    enable_custom_lexicon=False,
                    max_message_length=500,
                    skip_commands=True
                )
                db.add(settings)
                logger.info(f"✅ Created TTS settings with voice '{voice_name}' for user {user_id}")
            
            db.commit()
            return True
            
        except Exception as e:
            logger.error(f"❌ Error setting voice: {e}", exc_info=True)
            db.rollback()
            return False
