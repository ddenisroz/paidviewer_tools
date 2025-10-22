#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Manager для bot_service
Управляет двумя TTS системами:
1. AI TTS (F5-TTS) - через HTTP запросы к tts_service (требует whitelist)
2. Базовая TTS (gTTS) - локальная, fallback система (доступна всем)
"""

import logging
import aiohttp
import os
from typing import Optional, Dict, Tuple
from pathlib import Path
import time

from bot_service.services.basic_tts import get_basic_tts

logger = logging.getLogger(__name__)


class TTSManager:
    """
    Менеджер TTS систем для bot_service.
    
    Архитектура:
    - AI TTS (F5-TTS) находится на отдельной машине (tts_service)
    - Базовая TTS (gTTS) работает локально в bot_service как fallback
    
    Логика работы:
    1. Если AI TTS включена и доступна -> используем F5-TTS через HTTP
    2. Если AI TTS недоступна или не включена -> fallback на базовую TTS (gTTS)
    3. Базовая TTS всегда доступна как резервная система
    """
    
    def __init__(self):
        self.tts_service_url = os.getenv("TTS_SERVICE_URL", "http://localhost:8001")
        self.basic_tts = get_basic_tts()
        
        # Кеш состояния TTS сервиса
        self._tts_service_available = True
        self._last_health_check = 0
        self._health_check_interval = 30  # Проверять каждые 30 секунд
        
        logger.info(f"✅ TTS Manager инициализирован. TTS Service URL: {self.tts_service_url}")
    
    async def check_tts_service_health(self) -> bool:
        """
        Проверка доступности TTS сервиса (F5-TTS).
        Кеширует результат на 30 секунд для оптимизации.
        """
        current_time = time.time()
        
        # Проверяем кеш
        if current_time - self._last_health_check < self._health_check_interval:
            return self._tts_service_available
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.tts_service_url}/api/health", 
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        is_healthy = data.get("tts_engine_loaded", False)
                        
                        # Логируем изменение статуса
                        if is_healthy != self._tts_service_available:
                            if is_healthy:
                                logger.info("✅ TTS Service (F5-TTS) стал доступен")
                            else:
                                logger.warning("⚠️ TTS Service (F5-TTS) недоступен, fallback на базовую TTS")
                        
                        self._tts_service_available = is_healthy
                        self._last_health_check = current_time
                        return is_healthy
                    else:
                        self._tts_service_available = False
                        self._last_health_check = current_time
                        return False
                        
        except Exception as e:
            logger.error(f"❌ Ошибка проверки TTS Service: {e}")
            self._tts_service_available = False
            self._last_health_check = current_time
            return False
    
    async def synthesize_tts(
        self,
        channel_name: str,
        text: str,
        author: str,
        volume_level: float = 50.0,
        use_ai_tts: bool = False,
        use_basic_tts: bool = True,
        connection_manager=None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None
    ) -> Dict:
        """
        Синтезирует речь с автоматическим выбором TTS системы.
        
        Args:
            channel_name: Имя канала
            text: Текст для озвучки
            author: Автор сообщения
            volume_level: Уровень громкости (0-100)
            use_ai_tts: Использовать AI TTS (F5-TTS)
            use_basic_tts: Использовать базовую TTS (gTTS)
            connection_manager: ConnectionManager для проверки приоритетных голосов
            tts_settings: Настройки TTS (enable7TV, enableTwitch, enableProfanity, profanityLevel)
            word_filter: Список заблокированных слов
            blocked_users: Список заблокированных пользователей
        
        Returns:
            Dict с результатом: {"success": bool, "voice": str, "volume": float, "tts_type": str}
        """
        logger.info(f"🎙️ TTS запрос: канал={channel_name}, автор={author}, текст='{text[:50]}...', volume={volume_level}%, AI={use_ai_tts}, Basic={use_basic_tts}")
        
        # Приоритет 1: AI TTS (F5-TTS) через HTTP
        if use_ai_tts:
            # Проверяем доступность TTS сервиса
            is_tts_service_healthy = await self.check_tts_service_health()
            
            if is_tts_service_healthy:
                try:
                    result = await self._synthesize_via_tts_service(
                        channel_name, text, author, volume_level, connection_manager,
                        tts_settings, word_filter, blocked_users
                    )
                    if result["success"]:
                        logger.info(f"✅ AI TTS (F5-TTS) синтез успешен: voice={result.get('voice')}")
                        return result
                    else:
                        logger.warning(f"⚠️ AI TTS (F5-TTS) синтез не удался, fallback на базовую TTS")
                except Exception as e:
                    logger.error(f"❌ Ошибка AI TTS (F5-TTS): {e}, fallback на базовую TTS")
            else:
                logger.warning("⚠️ TTS Service недоступен, используем fallback базовую TTS")
        
        # Приоритет 2: Базовая TTS (gTTS) - локальная fallback система
        if use_basic_tts:
            try:
                result = await self._synthesize_via_basic_tts(
                    text, volume_level
                )
                if result["success"]:
                    logger.info(f"✅ Базовая TTS (gTTS) синтез успешен")
                    # Периодическая очистка старых файлов
                    self.cleanup_old_files_if_needed()
                    return result
                else:
                    logger.error("❌ Базовая TTS (gTTS) синтез не удался")
                    return {"success": False, "error": "Basic TTS synthesis failed"}
            except Exception as e:
                logger.error(f"❌ Ошибка базовой TTS (gTTS): {e}")
                return {"success": False, "error": f"Basic TTS error: {e}"}
        
        # Если ничего не сработало
        logger.error("❌ Ни одна TTS система не смогла выполнить синтез")
        return {"success": False, "error": "No TTS system available"}
    
    async def _synthesize_via_tts_service(
        self,
        channel_name: str,
        text: str,
        author: str,
        volume_level: float,
        connection_manager=None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None
    ) -> Dict:
        """
        Синтез через удаленный TTS сервис (F5-TTS).
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.tts_service_url}/api/tts/synthesize-channel"
                data = {
                    "channel_name": channel_name,
                    "text": text,
                    "author": author,
                    "volume_level": volume_level,
                    "tts_settings": tts_settings or {},
                    "word_filter": word_filter or [],
                    "blocked_users": blocked_users or []
                }
                
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        result = await response.json()
                        selected_voice = result.get("selected_voice")
                        
                        # Если есть connection_manager и выбран голос, проверяем приоритетную громкость
                        if connection_manager and selected_voice:
                            priority_volume = connection_manager.get_voice_volume(channel_name, selected_voice)
                            if priority_volume != 50.0:  # Если есть кастомная громкость
                                logger.info(f"🔊 Приоритетная громкость для голоса {selected_voice}: {priority_volume}%")
                                # Пересылаем запрос с приоритетной громкостью
                                data["volume_level"] = priority_volume
                                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=30)) as priority_response:
                                    if priority_response.status == 200:
                                        priority_result = await priority_response.json()
                                        return {
                                            "success": True,
                                            "voice": selected_voice,
                                            "volume": priority_volume,
                                            "tts_type": "ai_f5"
                                        }
                        
                        return {
                            "success": True,
                            "voice": selected_voice,
                            "volume": volume_level,
                            "tts_type": "ai_f5"
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ TTS Service вернул ошибку {response.status}: {error_text}")
                        return {"success": False, "error": f"TTS Service error: {response.status}"}
                        
        except Exception as e:
            logger.error(f"❌ Ошибка при запросе к TTS Service: {e}")
            return {"success": False, "error": str(e)}
    
    async def _synthesize_via_basic_tts(
        self,
        text: str,
        volume_level: float
    ) -> Dict:
        """
        Синтез через локальную базовую TTS (gTTS) с сохранением в TTS сервисе.
        """
        try:
            # gTTS синхронный, но быстрый, можно вызвать напрямую
            audio_path = self.basic_tts.synthesize_speech(
                text=text,
                volume_level=volume_level,
                speed=1.0
            )
            
            if audio_path:
                # Отправляем файл в TTS сервис для обслуживания
                audio_url = await self._upload_to_tts_service(audio_path)
                
                if audio_url:
                    return {
                        "success": True,
                        "voice": "basic_gtts",
                        "volume": volume_level,
                        "tts_type": "basic_gtts",
                        "audio_url": audio_url,
                        "audio_path": audio_path  # Оставляем для внутреннего использования
                    }
                else:
                    # Fallback на локальное обслуживание
                    filename = Path(audio_path).name
                    audio_url = f"http://localhost:8000/audio/{filename}"
                    return {
                        "success": True,
                        "voice": "basic_gtts",
                        "volume": volume_level,
                        "tts_type": "basic_gtts",
                        "audio_url": audio_url,
                        "audio_path": audio_path
                    }
            else:
                return {"success": False, "error": "Basic TTS returned no audio"}
                
        except Exception as e:
            logger.error(f"❌ Ошибка базовой TTS: {e}")
            return {"success": False, "error": str(e)}
    
    async def _upload_to_tts_service(self, audio_path: str) -> Optional[str]:
        """
        Загружает аудио файл в TTS сервис для обслуживания.
        """
        try:
            import aiohttp
            import aiofiles
            
            filename = Path(audio_path).name
            
            async with aiofiles.open(audio_path, 'rb') as f:
                audio_data = await f.read()
            
            async with aiohttp.ClientSession() as session:
                # Отправляем файл в TTS сервис
                data = aiohttp.FormData()
                data.add_field('file', audio_data, filename=filename, content_type='audio/wav')
                
                async with session.post(f"{self.tts_service_url}/api/upload-audio", data=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        audio_url = f"{self.tts_service_url}/api/audio/{filename}"
                        logger.info(f"✅ Аудио файл загружен в TTS сервис: {audio_url}")
                        return audio_url
                    else:
                        logger.warning(f"⚠️ Не удалось загрузить в TTS сервис: {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки в TTS сервис: {e}")
            return None
    
    def cleanup_old_files(self):
        """Очистка старых временных файлов базовой TTS"""
        try:
            self.basic_tts.cleanup_old_files()
        except Exception as e:
            logger.error(f"❌ Ошибка при очистке файлов: {e}")
    
    def cleanup_old_files_if_needed(self):
        """Очистка старых файлов при необходимости (каждые 10 синтезов)"""
        if not hasattr(self, '_synthesis_count'):
            self._synthesis_count = 0
        
        self._synthesis_count += 1
        
        # Очищаем каждые 10 синтезов
        if self._synthesis_count % 10 == 0:
            try:
                self.cleanup_old_files()
                logger.info(f"🧹 Периодическая очистка TTS файлов (синтез #{self._synthesis_count})")
            except Exception as e:
                logger.error(f"❌ Ошибка при периодической очистке: {e}")


# Глобальный экземпляр TTS Manager
_tts_manager_instance = None

def get_tts_manager() -> TTSManager:
    """Получить глобальный экземпляр TTS Manager (singleton)"""
    global _tts_manager_instance
    if _tts_manager_instance is None:
        _tts_manager_instance = TTSManager()
    return _tts_manager_instance

