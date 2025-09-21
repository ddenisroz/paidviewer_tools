# bot_service/tts_api.py
import os
import aiohttp
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class TTSAPI:
    def __init__(self):
        self.tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")

    async def send_tts_request(self, channel_name: str, text: str, author: str) -> bool:
        """Отправить запрос на озвучку в TTS сервис"""
        if not self.tts_service_url:
            logger.warning("TTS_SERVICE_URL not configured")
            return False

        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/synthesize"
                data = {
                    "channel_name": channel_name,
                    "text": text,
                    "author": author
                }
                
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        logger.info(f"TTS request sent for channel {channel_name}: {text[:50]}...")
                        return True
                    else:
                        logger.error(f"TTS request failed: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error sending TTS request: {e}")
            return False

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
