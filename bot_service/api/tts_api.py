# bot_service/tts_api.py
import os
import aiohttp
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class TTSAPI:
    def __init__(self):
        self.tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")

    async def send_tts_request(self, channel_name: str, text: str, author: str, volume_level: float = 50.0, connection_manager=None) -> dict:
        """Отправить запрос на озвучку в TTS сервис с автоматическим выбором голоса и приоритетной громкостью"""
        if not self.tts_service_url:
            logger.warning("TTS_SERVICE_URL not configured")
            return {"success": False, "error": "TTS service not configured"}

        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/synthesize-channel"
                data = {
                    "channel_name": channel_name,
                    "text": text,
                    "author": author,
                    "volume_level": volume_level
                }
                
                async with session.post(url, data=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        selected_voice = result.get("selected_voice")
                        
                        # Если есть connection_manager и выбран голос, проверяем приоритетную громкость
                        if connection_manager and selected_voice:
                            priority_volume = connection_manager.get_voice_volume(channel_name, selected_voice)
                            if priority_volume != 50.0:  # Если есть кастомная громкость
                                logger.info(f"🔊 Custom voice volume detected for {selected_voice}: {priority_volume}%")
                                # Пересылаем запрос с приоритетной громкостью
                                data["volume_level"] = priority_volume
                                async with session.post(url, data=data) as priority_response:
                                    if priority_response.status == 200:
                                        priority_result = await priority_response.json()
                                        logger.info(f"TTS request sent for channel {channel_name}: {text[:50]}... (voice: {selected_voice}, priority volume: {priority_volume}%)")
                                        return {"success": True, "voice": selected_voice, "volume": priority_volume}
                        
                        logger.info(f"TTS request sent for channel {channel_name}: {text[:50]}... (voice: {selected_voice or 'random'}, volume: {volume_level}%)")
                        return {"success": True, "voice": selected_voice, "volume": volume_level}
                    else:
                        logger.error(f"TTS request failed: {response.status}")
                        return {"success": False, "error": f"HTTP {response.status}"}
                        
        except Exception as e:
            logger.error(f"Error sending TTS request: {e}")
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