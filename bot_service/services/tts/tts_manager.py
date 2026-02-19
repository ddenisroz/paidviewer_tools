#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Manager РґР»СЏ bot_service
Управляет двумя TTS системами:
1. AI TTS (F5-TTS) - через HTTP запросы к tts_service (требует whitelist)
2. Базовая TTS (gTTS) - локальная, fallback система (доступна всем)
"""

import logging
import aiohttp
import asyncio
import re
from typing import Optional, Dict
from pathlib import Path
import time
import random

from core.config import settings
from constants import (
    TTS_DEFAULT_VOLUME,
    TTS_MAX_RETRIES,
    TTS_RETRY_DELAY,
    TTS_HEALTH_CHECK_INTERVAL
)

from services.tts.basic_tts import get_basic_tts
from services.tts.google_cloud_tts import (
    get_google_cloud_tts,
    is_gemini_or_chirp_voice,
    normalize_gcloud_mood,
)

logger = logging.getLogger(__name__)
_GEMINI_SPEAKER_PATTERN = re.compile(r"^[A-Z][A-Za-z0-9_]{1,63}$")


def _gcloud_voice_quality_rank(voice_name: Optional[str]) -> int:
    key = (voice_name or "").lower()
    if _GEMINI_SPEAKER_PATTERN.match(voice_name or ""):
        return 0
    if "gemini" in key:
        return 0
    if "chirp3-hd" in key:
        return 1
    if "neural2" in key:
        return 2
    if "wavenet" in key:
        return 3
    if "studio" in key:
        return 4
    if "journey" in key:
        return 5
    if "standard" in key:
        return 9
    return 6


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
    
    Улучшения (Task 5.3):
    - РСЃРїРѕР»СЊР·СѓРµС‚ settings.tts_service_url РёР· РєРѕРЅС„РёРіСѓСЂР°С†РёРё
    - Health check перед каждым синтезом
    - Exponential backoff для retry логики
    """

    def __init__(self):
        # Use settings from config instead of environment variables directly
        self.tts_service_url = settings.tts_service_url
        self.backend_url = settings.backend_url
        self.basic_tts = get_basic_tts()
        self.google_cloud_tts = get_google_cloud_tts()

        # Кеш состояния TTS сервиса
        self._tts_service_available = True
        self._last_health_check = 0
        self._health_check_interval = TTS_HEALTH_CHECK_INTERVAL

        logger.info(f"[OK] TTS Manager инициализирован. TTS Service URL: {self.tts_service_url}")

    async def get_user_tts_endpoint(self, user_id: int, db_session) -> Optional[str]:
        """
        Получить TTS endpoint пользователя (локальный или централизованный).
        
        Args:
            user_id: ID пользователя
            db_session: Сессия БД
            
        Returns:
            URL endpoint или None (использовать централизованный)
        """
        try:
            from repositories.local_tts_repository import LocalTTSRepository
            repo = LocalTTSRepository(db_session)
            
            # Using get_healthy which checks is_active and is_healthy
            local_config = repo.get_healthy(user_id=user_id)

            if local_config:
                logger.info(f"[LOCAL] РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Р»РѕРєР°Р»СЊРЅС‹Р№ TTS endpoint РґР»СЏ user_id={user_id}: {local_config.endpoint_url}")
                return local_config.endpoint_url

            return None

        except Exception as e:
            logger.exception("Error getting user TTS endpoint")
            return None

    async def check_tts_service_health(self, force_check: bool = False) -> bool:
        """
        Проверка доступности TTS сервиса (F5-TTS) с улучшенной обработкой ошибок.
        
        Args:
            force_check: Принудительная проверка, игнорируя кеш (для админки)
        
        Returns:
            bool: True если сервис доступен
        """
        current_time = time.time()

        # Проверяем кеш только если не форсируем проверку
        if not force_check and current_time - self._last_health_check < self._health_check_interval:
            return self._tts_service_available

        try:
            # РСЃРїРѕР»СЊР·СѓРµРј РєРѕСЂРѕС‚РєРёР№ С‚Р°Р№РјР°СѓС‚ РґР»СЏ health check
            timeout = aiohttp.ClientTimeout(total=5, connect=2)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(
                    f"{self.tts_service_url}/api/health"
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        is_healthy = data.get("tts_engine_loaded", False)

                        # Логируем изменение статуса только если он изменился
                        if is_healthy != self._tts_service_available:
                            if is_healthy:
                                logger.info("[OK] TTS Service (F5-TTS) стал доступен")
                            else:
                                logger.warning("[WARN] TTS Service (F5-TTS) недоступен, fallback на базовую TTS")

                        self._tts_service_available = is_healthy
                        self._last_health_check = current_time
                        return is_healthy
                    else:
                        if not force_check:
                            logger.warning(f"[WARN] TTS Service health check failed with status {response.status}")
                        self._tts_service_available = False
                        self._last_health_check = current_time
                        return False

        except asyncio.TimeoutError:
            if not force_check:
                logger.warning("[WARN] TTS Service health check timed out")
            self._tts_service_available = False
            self._last_health_check = current_time
            return False
        except aiohttp.ClientError as e:
            if not force_check:
                logger.warning(f"[WARN] TTS Service connection error: {e}")
            self._tts_service_available = False
            self._last_health_check = current_time
            return False
        except Exception as e:
            # Не логируем ошибку при принудительной проверке из админки
            if not force_check:
                logger.exception("[ERROR] Ошибка проверки TTS Service")
            self._tts_service_available = False
            self._last_health_check = current_time
            return False

    async def synthesize_tts(
        self,
        channel_name: str,
        text: str,
        author: str,
        user_id: int = None,
        volume_level: float = TTS_DEFAULT_VOLUME,  # РСЃРїРѕР»СЊР·СѓРµРј РєРѕРЅСЃС‚Р°РЅС‚Сѓ РІРјРµСЃС‚Рѕ С…Р°СЂРґРєРѕРґР°
        use_ai_tts: bool = False,
        use_basic_tts: bool = True,
        connection_manager=None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None,
        db_session=None,
        engine: Optional[str] = None
    ) -> Dict:
        """
        Синтезирует речь с автоматическим fallback на базовую TTS.
        
        [OK] РќРћР’РђРЇ Р›РћР“РРљРђ: 
        - Если use_ai_tts=True, пытаемся F5-TTS ДО 3 раз
        - Если F5-TTS падает или недоступен → автоматический fallback на gTTS
        - Базовая TTS ВСЕГДА включена как резервная система
        """
        resolved_engine = engine
        if not resolved_engine:
            resolved_engine = "f5tts" if use_ai_tts else "gtts"

        logger.info(f"[MIC] Engine resolved: {resolved_engine}")
        logger.info(f"[MIC] TTS запрос: канал={channel_name}, текст='{text[:50]}...', AI={use_ai_tts}")

        # [OK] ВСЕГДА включаем базовую TTS как fallback (по умолчанию)
        # Переопределяем: если use_ai_tts=True, пытаемся AI, но fallback=gTTS
        final_use_basic_tts = True  # ВСЕГДА используем gTTS как fallback

        # Приоритет 1: AI TTS (F5-TTS) через HTTP с retry логикой и exponential backoff
        if resolved_engine == "f5tts" and use_ai_tts:
            logger.info("[MIC] [PRIORITY 1] Trying AI TTS (F5-TTS) with fallback support")
            max_retries = TTS_MAX_RETRIES
            base_retry_delay = TTS_RETRY_DELAY
            tts_endpoint = self.tts_service_url

            if user_id and db_session:
                local_endpoint = await self.get_user_tts_endpoint(user_id, db_session)
                if local_endpoint:
                    tts_endpoint = local_endpoint
                    logger.info(f"[LOCAL] Using local TTS endpoint: {local_endpoint}")

            # Health check перед началом синтеза
            is_healthy = await self.check_tts_service_health()
            if not is_healthy:
                logger.warning("[WARN] TTS Service недоступен по health check, пропускаем AI TTS")
            else:
                # Проверяем доступность TTS сервиса с retry и exponential backoff
                for attempt in range(1, max_retries + 1):
                    try:
                        result = await self._synthesize_via_tts_service(
                            channel_name, text, author, user_id, volume_level, connection_manager,
                            tts_settings, word_filter, blocked_users, tts_endpoint=tts_endpoint
                        )
                        if result.get("success"):
                            logger.info(f"[OK] AI TTS (F5-TTS) синтез успешен (попытка {attempt}/{max_retries})")
                            return result
                        else:
                            logger.warning(f"[WARN] AI TTS попытка {attempt}/{max_retries} не удалась: {result.get('error')}")
                            if attempt < max_retries:
                                # Exponential backoff: 1s, 2s, 4s
                                delay = base_retry_delay * (2 ** (attempt - 1))
                                logger.info(f"⏳ Ожидание {delay}s перед следующей попыткой...")
                                await asyncio.sleep(delay)

                    except asyncio.TimeoutError:
                        logger.warning(f"[WARN] AI TTS timeout (попытка {attempt}/{max_retries})")
                        if attempt < max_retries:
                            delay = base_retry_delay * (2 ** (attempt - 1))
                            await asyncio.sleep(delay)
                    except aiohttp.ClientError as e:
                        logger.warning(f"[WARN] AI TTS connection error (попытка {attempt}/{max_retries}): {e}")
                        if attempt < max_retries:
                            delay = base_retry_delay * (2 ** (attempt - 1))
                            await asyncio.sleep(delay)
                    except Exception as e:
                        logger.exception("[ERROR] Ошибка AI TTS (попытка {attempt}/{max_retries})")
                        if attempt < max_retries:
                            delay = base_retry_delay * (2 ** (attempt - 1))
                            await asyncio.sleep(delay)
                        else:
                            logger.error("[ERROR] Все попытки AI TTS исчерпаны, используем fallback на gTTS")

                logger.warning(f"[WARN] AI TTS (F5-TTS) недоступен после {max_retries} попыток, fallback на базовую TTS (gTTS)")

        # Приоритет 2: Базовая TTS (gTTS) - ВСЕГДА доступна как fallback
        if resolved_engine == "gcloud":
            logger.info("[MIC] [PRIORITY 1B] Trying Google Cloud TTS with fallback support")
            try:
                result = await self._synthesize_via_google_cloud_tts(
                    text=text,
                    volume_level=volume_level,
                    tts_settings=tts_settings or {}
                )
                if result.get("success"):
                    logger.info("[OK] Google Cloud TTS synthesis succeeded")
                    self.cleanup_old_files_if_needed()
                    return result
                logger.warning(f"[WARN] Google Cloud TTS failed: {result.get('error')}, fallback to gTTS")
            except Exception as e:
                logger.exception("[ERROR] Google Cloud TTS error")

        if final_use_basic_tts:
            logger.info("[MIC] [PRIORITY 2] Using basic TTS (gTTS) - ALWAYS AVAILABLE AS FALLBACK")
            try:
                result = await self._synthesize_via_basic_tts(text, volume_level)
                if result.get("success"):
                    logger.info("[OK] Базовая TTS (gTTS) синтез успешен")
                    self.cleanup_old_files_if_needed()
                    return result
                else:
                    logger.error(f"[ERROR] Базовая TTS (gTTS) синтез не удался: {result.get('error')}")
                    return {"success": False, "error": "Basic TTS synthesis failed"}
            except Exception as e:
                logger.exception("[ERROR] Ошибка базовой TTS (gTTS)")
                return {"success": False, "error": f"Basic TTS error: {e}"}

        # Если ничего не сработало (почти невозможно)
        logger.error("[ERROR] Ни одна TTS система не смогла выполнить синтез")
        return {"success": False, "error": "No TTS system available"}

    async def _synthesize_via_tts_service(
        self,
        channel_name: str,
        text: str,
        author: str,
        user_id: int = None,
        volume_level: float = TTS_DEFAULT_VOLUME,
        connection_manager=None,
        tts_settings: dict = None,
        word_filter: list = None,
        blocked_users: list = None,
        tts_endpoint: str = None
    ) -> Dict:
        """
        Синтез через удаленный TTS сервис (F5-TTS) с улучшенной обработкой ошибок.
        
        Args:
            tts_endpoint: URL TTS сервиса (локальный или централизованный)
        
        Returns:
            Dict с результатом синтеза или ошибкой
        """
        try:
            # РСЃРїРѕР»СЊР·СѓРµРј РїРµСЂРµРґР°РЅРЅС‹Р№ endpoint РёР»Рё РґРµС„РѕР»С‚РЅС‹Р№
            endpoint = tts_endpoint or self.tts_service_url

            # Настраиваем таймауты: 30s total, 10s connect
            timeout = aiohttp.ClientTimeout(total=30, connect=10)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"{endpoint}/api/tts/synthesize-channel"
                data = {
                    "channel_name": channel_name,
                    "text": text,
                    "author": author,
                    "user_id": user_id,
                    "volume_level": volume_level,
                    "tts_settings": tts_settings or {},
                    "word_filter": word_filter or [],
                    "blocked_users": blocked_users or []
                }

                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        selected_voice = result.get("selected_voice")
                        audio_url_raw = result.get("audio_url")  # Extract audio URL from response

                        # [START] FIX: Преобразуем относительный путь в полный URL для фронтенда
                        if audio_url_raw:
                            if audio_url_raw.startswith('http://') or audio_url_raw.startswith('https://'):
                                # Уже полный URL
                                audio_url = audio_url_raw
                            elif audio_url_raw.startswith('/'):
                                # Относительный путь - добавляем TTS_SERVICE_URL
                                audio_url = f"{endpoint}{audio_url_raw}"
                            else:
                                # Просто имя файла - добавляем путь к audio endpoint
                                audio_url = f"{endpoint}/api/tts/audio/{audio_url_raw}"
                        else:
                            audio_url = None

                        logger.info(f"[MIC] TTS Service response: {result}")
                        logger.info(f"[LINK] Audio URL (raw): {audio_url_raw}, (full): {audio_url}")

                        # Если есть connection_manager и выбран голос, проверяем приоритетную громкость
                        if connection_manager and selected_voice:
                            priority_volume = connection_manager.get_voice_volume(channel_name, selected_voice)
                            if priority_volume != TTS_DEFAULT_VOLUME:  # Если есть кастомная громкость (не дефолтная)
                                logger.info(f"[VOLUME] Приоритетная громкость для голоса {selected_voice}: {priority_volume}% (default: {TTS_DEFAULT_VOLUME}%)")
                                # Пересылаем запрос с приоритетной громкостью
                                data["volume_level"] = priority_volume
                                async with session.post(url, json=data, timeout=timeout) as priority_response:
                                    if priority_response.status == 200:
                                        await priority_response.json()
                                        return {
                                            "success": True,
                                            "voice": selected_voice,
                                            "volume": priority_volume,
                                            "tts_type": "ai_f5",
                                            "audio_url": audio_url  # [OK] Полный URL
                                        }

                        return {
                            "success": True,
                            "voice": selected_voice,
                            "volume": volume_level,
                            "tts_type": "ai_f5",
                            "audio_url": audio_url  # [OK] Полный URL
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"[ERROR] TTS Service вернул ошибку {response.status}: {error_text}")
                        return {"success": False, "error": f"TTS Service error: {response.status}"}

        except asyncio.TimeoutError:
            logger.error("[ERROR] TTS Service request timed out")
            return {"success": False, "error": "Request timeout"}
        except aiohttp.ClientError as e:
            logger.exception("[ERROR] TTS Service connection error")
            return {"success": False, "error": f"Connection error: {str(e)}"}
        except Exception as e:
            logger.exception("[ERROR] Ошибка при запросе к TTS Service")
            return {"success": False, "error": "Internal server error"}

    async def _synthesize_via_basic_tts(
        self,
        text: str,
        volume_level: float
    ) -> Dict:
        """
        Синтез через локальную базовую TTS (gTTS).
        Работает ПОЛНОСТЬЮ локально без зависимости от tts_service.
        """
        try:
            # gTTS синхронный, но быстрый, можно вызвать напрямую
            audio_path = self.basic_tts.synthesize_speech(
                text=text,
                volume_level=volume_level,
                speed=1.0
            )

            if audio_path:
                # [OK] РРЎРџРћР›Р¬Р—РЈР•Рњ Р›РћРљРђР›Р¬РќРћР• РћР‘РЎР›РЈР–РР’РђРќРР• Р‘Р•Р— Р—РђР“Р РЈР—РљР РќРђ TTS_SERVICE
                # Р‘Р°Р·РѕРІР°СЏ TTS СЂР°Р±РѕС‚Р°РµС‚ РќР•Р—РђР’РРЎРРњРћ РѕС‚ tts_service
                filename = Path(audio_path).name
                # Use backend_url from settings
                audio_url = f"{self.backend_url}/api/tts/audio/{filename}"

                logger.info(f"[OK] [BASIC TTS] Audio synthesized: {filename}")
                logger.info(f"[OK] [BASIC TTS] Audio URL: {audio_url}")

                return {
                    "success": True,
                    "voice": "basic_gtts",
                    "volume": volume_level,
                    "tts_type": "basic_gtts",
                    "audio_url": audio_url,
                    "audio_path": audio_path  # Оставляем для внутреннего использования
                }
            else:
                logger.error("[ERROR] [BASIC TTS] synthesis_speech returned None")
                return {"success": False, "error": "Basic TTS synthesis failed"}

        except Exception as e:
            logger.exception("[ERROR] [BASIC TTS] Error")
            return {"success": False, "error": "Internal server error"}

    async def _synthesize_via_google_cloud_tts(
        self,
        text: str,
        volume_level: float,
        tts_settings: dict
    ) -> Dict:
        """
        Synthesize via Google Cloud TTS.
        """
        try:
            voice_pool = []
            if tts_settings:
                voice_pool = tts_settings.get("gcloud_voices") or tts_settings.get("gcloudVoices") or []
            cleaned_voice_pool = [
                str(voice).strip()
                for voice in voice_pool
                if isinstance(voice, str) and str(voice).strip()
            ]
            filtered_voice_pool = [
                voice
                for voice in cleaned_voice_pool
                if is_gemini_or_chirp_voice(voice)
            ]

            if cleaned_voice_pool and not filtered_voice_pool:
                logger.warning(
                    "[WARN] All saved Google voices are legacy/non-premium. Keeping only Gemini/Chirp is now required."
                )

            gemini_voice_pool = [
                voice for voice in filtered_voice_pool if _gcloud_voice_quality_rank(voice) == 0
            ]
            # Prefer pure Gemini output whenever at least one Gemini voice is selected.
            random_pool = gemini_voice_pool or filtered_voice_pool
            fallback_voice = (tts_settings.get("voice") if tts_settings else None)
            if fallback_voice and not is_gemini_or_chirp_voice(fallback_voice):
                fallback_voice = None

            voice_name = random.choice(random_pool) if random_pool else fallback_voice
            gcloud_mood = normalize_gcloud_mood(
                (tts_settings or {}).get("gcloud_mood")
                or (tts_settings or {}).get("gcloudMood")
            )

            result = await self.google_cloud_tts.synthesize_speech(
                text=text,
                volume_level=volume_level,
                speed=1.0,
                voice_name=voice_name,
                mood=gcloud_mood,
            )

            if not result.get("success"):
                return result

            if result.get("fallback_used"):
                logger.warning(
                    "[WARN] Google Cloud runtime fallback: requested_model=%s resolved_voice=%s",
                    result.get("requested_model") or "-",
                    result.get("voice") or "-",
                )

            audio_path = result.get("audio_path")
            if not audio_path:
                return {"success": False, "error": "No audio_path returned"}

            filename = Path(audio_path).name
            audio_url = f"{self.backend_url}/api/tts/audio/{filename}"

            return {
                "success": True,
                "voice": result.get("voice") or "google_cloud",
                "volume": volume_level,
                "tts_type": "google_cloud",
                "audio_url": audio_url,
                "audio_path": audio_path,
                "auth_mode": result.get("auth_mode"),
                "requested_model": result.get("requested_model"),
                "fallback_used": bool(result.get("fallback_used")),
            }

        except Exception as e:
            logger.exception("[ERROR] Google Cloud TTS error")
            return {"success": False, "error": "Internal server error"}

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
                        await response.json()
                        audio_url = f"{self.tts_service_url}/api/audio/{filename}"
                        logger.info(f"[OK] Аудио файл загружен в TTS сервис: {audio_url}")
                        return audio_url
                    else:
                        logger.warning(f"[WARN] Не удалось загрузить в TTS сервис: {response.status}")
                        return None

        except Exception as e:
            logger.exception("[ERROR] Ошибка загрузки в TTS сервис")
            return None

    def cleanup_old_files(self):
        """Очистка старых временных файлов базовой TTS"""
        try:
            self.basic_tts.cleanup_old_files()
        except Exception as e:
            logger.exception("[ERROR] Ошибка при очистке файлов")

    def cleanup_old_files_if_needed(self):
        """Очистка старых файлов при необходимости (каждые 10 синтезов)"""
        if not hasattr(self, '_synthesis_count'):
            self._synthesis_count = 0

        self._synthesis_count += 1

        # Очищаем каждые 10 синтезов
        if self._synthesis_count % 10 == 0:
            try:
                self.cleanup_old_files()
                logger.info(f"[CLEAN] Периодическая очистка TTS файлов (синтез #{self._synthesis_count})")
            except Exception as e:
                logger.exception("[ERROR] Ошибка при периодической очистке")


# Глобальный экземпляр TTS Manager
_tts_manager_instance = None

def get_tts_manager() -> TTSManager:
    """Получить глобальный экземпляр TTS Manager (singleton)"""
    global _tts_manager_instance
    if _tts_manager_instance is None:
        _tts_manager_instance = TTSManager()
    return _tts_manager_instance


