# bot_service/tts_api.py
import os
import aiohttp
import logging
from typing import Optional

from bot_service.services.tts_manager import get_tts_manager

logger = logging.getLogger(__name__)

class TTSAPI:
    def __init__(self):
        self.tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        self.tts_manager = get_tts_manager()

    async def send_tts_request(
        self, 
        channel_name: str, 
        text: str, 
        author: str, 
        volume_level: float = 50.0, 
        connection_manager=None,
        use_ai_tts: bool = False,
        use_basic_tts: bool = True,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None
    ) -> dict:
        """
        Отправить запрос на озвучку через TTS Manager.
        Поддерживает как AI TTS (F5-TTS), так и базовую TTS (gTTS).
        
        Args:
            channel_name: Имя канала
            text: Текст для озвучки
            author: Автор сообщения
            volume_level: Уровень громкости (0-100)
            connection_manager: ConnectionManager для проверки приоритетных голосов
            use_ai_tts: Использовать AI TTS (F5-TTS) через удаленный сервис
            use_basic_tts: Использовать базовую TTS (gTTS) локально
            tts_settings: Настройки TTS (enable7TV, enableTwitch, enableProfanity, profanityLevel)
            word_filter: Список заблокированных слов
            blocked_users: Список заблокированных пользователей
        
        Returns:
            Dict с результатом: {"success": bool, "voice": str, "volume": float, "tts_type": str}
        """
        try:
            result = await self.tts_manager.synthesize_tts(
                channel_name=channel_name,
                text=text,
                author=author,
                volume_level=volume_level,
                use_ai_tts=use_ai_tts,
                use_basic_tts=use_basic_tts,
                connection_manager=connection_manager,
                tts_settings=tts_settings,
                word_filter=word_filter,
                blocked_users=blocked_users
            )
            
            if result.get("success"):
                tts_type = result.get("tts_type", "unknown")
                voice = result.get("voice", "unknown")
                logger.info(f"✅ TTS синтез успешен: type={tts_type}, voice={voice}, channel={channel_name}")
            else:
                logger.error(f"❌ TTS синтез не удался: {result.get('error')}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке TTS запроса: {e}")
            return {"success": False, "error": str(e)}

    async def enable_tts(self, channel_name: str) -> bool:
        """Включить TTS для канала"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/enable"
                data = {"channel_name": channel_name}
                
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        logger.info(f"TTS enabled for channel {channel_name}")
                        return True
                    else:
                        logger.error(f"Failed to enable TTS for {channel_name}: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error enabling TTS: {e}")
            return False

    async def disable_tts(self, channel_name: str) -> bool:
        """Выключить TTS для канала"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/disable"
                data = {"channel_name": channel_name}
                
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        logger.info(f"TTS disabled for channel {channel_name}")
                        return True
                    else:
                        logger.error(f"Failed to disable TTS for {channel_name}: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error disabling TTS: {e}")
            return False

    async def get_tts_status(self, channel_name: str) -> Optional[bool]:
        """Получить статус TTS для канала"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/status"
                params = {"channel_name": channel_name}
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("is_enabled", False)
                    else:
                        logger.error(f"Failed to get TTS status for {channel_name}: {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error getting TTS status: {e}")
            return None

    async def set_voice(self, channel_name: str, voice_number: int, user_name: str) -> dict:
        """Установить голос для TTS"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/set-voice"
                data = {
                    "channel_name": channel_name,
                    "voice_number": voice_number,
                    "user_name": user_name
                }
                
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Voice set for {user_name} in channel {channel_name}: {voice_number}")
                        return {"success": True, "voice_number": voice_number}
                    else:
                        error_data = await response.json()
                        logger.error(f"Failed to set voice: {response.status} - {error_data}")
                        return {"success": False, "error": error_data.get("detail", "Unknown error")}
                        
        except Exception as e:
            logger.error(f"Error setting voice: {e}")
            return {"success": False, "error": str(e)}

    async def get_random_voice(self, channel_name: str) -> dict:
        """Получить случайный голос для канала"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/random-voice"
                data = {"channel_name": channel_name}
                
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Random voice selected for channel {channel_name}: {result.get('voice_number')}")
                        return {"success": True, "voice_number": result.get("voice_number")}
                    else:
                        error_data = await response.json()
                        logger.error(f"Failed to get random voice: {response.status} - {error_data}")
                        return {"success": False, "error": error_data.get("detail", "Unknown error")}
                        
        except Exception as e:
            logger.error(f"Error getting random voice: {e}")
            return {"success": False, "error": str(e)}