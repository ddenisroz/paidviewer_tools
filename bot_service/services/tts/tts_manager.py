#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Manager РґР»СЏ bot_service
РЈРїСЂР°РІР»СЏРµС‚ РґРІСѓРјСЏ TTS СЃРёСЃС‚РµРјР°РјРё:
1. AI TTS (F5-TTS) - С‡РµСЂРµР· HTTP Р·Р°РїСЂРѕСЃС‹ Рє tts_service (С‚СЂРµР±СѓРµС‚ whitelist)
2. Р‘Р°Р·РѕРІР°СЏ TTS (gTTS) - Р»РѕРєР°Р»СЊРЅР°СЏ, fallback СЃРёСЃС‚РµРјР° (РґРѕСЃС‚СѓРїРЅР° РІСЃРµРј)
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
    РњРµРЅРµРґР¶РµСЂ TTS СЃРёСЃС‚РµРј РґР»СЏ bot_service.
    
    РђСЂС…РёС‚РµРєС‚СѓСЂР°:
    - AI TTS (F5-TTS) РЅР°С…РѕРґРёС‚СЃСЏ РЅР° РѕС‚РґРµР»СЊРЅРѕР№ РјР°С€РёРЅРµ (tts_service)
    - Р‘Р°Р·РѕРІР°СЏ TTS (gTTS) СЂР°Р±РѕС‚Р°РµС‚ Р»РѕРєР°Р»СЊРЅРѕ РІ bot_service РєР°Рє fallback
    
    Р›РѕРіРёРєР° СЂР°Р±РѕС‚С‹:
    1. Р•СЃР»Рё AI TTS РІРєР»СЋС‡РµРЅР° Рё РґРѕСЃС‚СѓРїРЅР° -> РёСЃРїРѕР»СЊР·СѓРµРј F5-TTS С‡РµСЂРµР· HTTP
    2. Р•СЃР»Рё AI TTS РЅРµРґРѕСЃС‚СѓРїРЅР° РёР»Рё РЅРµ РІРєР»СЋС‡РµРЅР° -> fallback РЅР° Р±Р°Р·РѕРІСѓСЋ TTS (gTTS)
    3. Р‘Р°Р·РѕРІР°СЏ TTS РІСЃРµРіРґР° РґРѕСЃС‚СѓРїРЅР° РєР°Рє СЂРµР·РµСЂРІРЅР°СЏ СЃРёСЃС‚РµРјР°
    
    РЈР»СѓС‡С€РµРЅРёСЏ (Task 5.3):
    - РСЃРїРѕР»СЊР·СѓРµС‚ settings.tts_service_url РёР· РєРѕРЅС„РёРіСѓСЂР°С†РёРё
    - Health check РїРµСЂРµРґ РєР°Р¶РґС‹Рј СЃРёРЅС‚РµР·РѕРј
    - Exponential backoff РґР»СЏ retry Р»РѕРіРёРєРё
    """

    def __init__(self):
        # Use settings from config instead of environment variables directly
        self.tts_service_url = settings.tts_service_url
        self.backend_url = settings.backend_url
        self.basic_tts = get_basic_tts()
        self.google_cloud_tts = get_google_cloud_tts()

        # РљРµС€ СЃРѕСЃС‚РѕСЏРЅРёСЏ TTS СЃРµСЂРІРёСЃР°
        self._tts_service_available = True
        self._last_health_check = 0
        self._health_check_interval = TTS_HEALTH_CHECK_INTERVAL

        logger.info(f"[OK] TTS Manager РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅ. TTS Service URL: {self.tts_service_url}")

    async def get_user_tts_endpoint(self, user_id: int, db_session) -> Optional[str]:
        """
        РџРѕР»СѓС‡РёС‚СЊ TTS endpoint РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (Р»РѕРєР°Р»СЊРЅС‹Р№ РёР»Рё С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№).
        
        Args:
            user_id: ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            db_session: РЎРµСЃСЃРёСЏ Р‘Р”
            
        Returns:
            URL endpoint РёР»Рё None (РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№)
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
            logger.error(f"Error getting user TTS endpoint: {e}")
            return None

    async def check_tts_service_health(self, force_check: bool = False) -> bool:
        """
        РџСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё TTS СЃРµСЂРІРёСЃР° (F5-TTS) СЃ СѓР»СѓС‡С€РµРЅРЅРѕР№ РѕР±СЂР°Р±РѕС‚РєРѕР№ РѕС€РёР±РѕРє.
        
        Args:
            force_check: РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅР°СЏ РїСЂРѕРІРµСЂРєР°, РёРіРЅРѕСЂРёСЂСѓСЏ РєРµС€ (РґР»СЏ Р°РґРјРёРЅРєРё)
        
        Returns:
            bool: True РµСЃР»Рё СЃРµСЂРІРёСЃ РґРѕСЃС‚СѓРїРµРЅ
        """
        current_time = time.time()

        # РџСЂРѕРІРµСЂСЏРµРј РєРµС€ С‚РѕР»СЊРєРѕ РµСЃР»Рё РЅРµ С„РѕСЂСЃРёСЂСѓРµРј РїСЂРѕРІРµСЂРєСѓ
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

                        # Р›РѕРіРёСЂСѓРµРј РёР·РјРµРЅРµРЅРёРµ СЃС‚Р°С‚СѓСЃР° С‚РѕР»СЊРєРѕ РµСЃР»Рё РѕРЅ РёР·РјРµРЅРёР»СЃСЏ
                        if is_healthy != self._tts_service_available:
                            if is_healthy:
                                logger.info("[OK] TTS Service (F5-TTS) СЃС‚Р°Р» РґРѕСЃС‚СѓРїРµРЅ")
                            else:
                                logger.warning("[WARN] TTS Service (F5-TTS) РЅРµРґРѕСЃС‚СѓРїРµРЅ, fallback РЅР° Р±Р°Р·РѕРІСѓСЋ TTS")

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
            # РќРµ Р»РѕРіРёСЂСѓРµРј РѕС€РёР±РєСѓ РїСЂРё РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕР№ РїСЂРѕРІРµСЂРєРµ РёР· Р°РґРјРёРЅРєРё
            if not force_check:
                logger.error(f"[ERROR] РћС€РёР±РєР° РїСЂРѕРІРµСЂРєРё TTS Service: {e}")
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
        РЎРёРЅС‚РµР·РёСЂСѓРµС‚ СЂРµС‡СЊ СЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёРј fallback РЅР° Р±Р°Р·РѕРІСѓСЋ TTS.
        
        [OK] РќРћР’РђРЇ Р›РћР“РРљРђ: 
        - Р•СЃР»Рё use_ai_tts=True, РїС‹С‚Р°РµРјСЃСЏ F5-TTS Р”Рћ 3 СЂР°Р·
        - Р•СЃР»Рё F5-TTS РїР°РґР°РµС‚ РёР»Рё РЅРµРґРѕСЃС‚СѓРїРµРЅ в†’ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ fallback РЅР° gTTS
        - Р‘Р°Р·РѕРІР°СЏ TTS Р’РЎР•Р“Р”Рђ РІРєР»СЋС‡РµРЅР° РєР°Рє СЂРµР·РµСЂРІРЅР°СЏ СЃРёСЃС‚РµРјР°
        """
        resolved_engine = engine
        if not resolved_engine:
            resolved_engine = "f5tts" if use_ai_tts else "gtts"

        logger.info(f"[MIC] Engine resolved: {resolved_engine}")
        logger.info(f"[MIC] TTS Р·Р°РїСЂРѕСЃ: РєР°РЅР°Р»={channel_name}, С‚РµРєСЃС‚='{text[:50]}...', AI={use_ai_tts}")

        # [OK] Р’РЎР•Р“Р”Рђ РІРєР»СЋС‡Р°РµРј Р±Р°Р·РѕРІСѓСЋ TTS РєР°Рє fallback (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ)
        # РџРµСЂРµРѕРїСЂРµРґРµР»СЏРµРј: РµСЃР»Рё use_ai_tts=True, РїС‹С‚Р°РµРјСЃСЏ AI, РЅРѕ fallback=gTTS
        final_use_basic_tts = True  # Р’РЎР•Р“Р”Рђ РёСЃРїРѕР»СЊР·СѓРµРј gTTS РєР°Рє fallback

        # РџСЂРёРѕСЂРёС‚РµС‚ 1: AI TTS (F5-TTS) С‡РµСЂРµР· HTTP СЃ retry Р»РѕРіРёРєРѕР№ Рё exponential backoff
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

            # Health check РїРµСЂРµРґ РЅР°С‡Р°Р»РѕРј СЃРёРЅС‚РµР·Р°
            is_healthy = await self.check_tts_service_health()
            if not is_healthy:
                logger.warning("[WARN] TTS Service РЅРµРґРѕСЃС‚СѓРїРµРЅ РїРѕ health check, РїСЂРѕРїСѓСЃРєР°РµРј AI TTS")
            else:
                # РџСЂРѕРІРµСЂСЏРµРј РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ TTS СЃРµСЂРІРёСЃР° СЃ retry Рё exponential backoff
                for attempt in range(1, max_retries + 1):
                    try:
                        result = await self._synthesize_via_tts_service(
                            channel_name, text, author, user_id, volume_level, connection_manager,
                            tts_settings, word_filter, blocked_users, tts_endpoint=tts_endpoint
                        )
                        if result.get("success"):
                            logger.info(f"[OK] AI TTS (F5-TTS) СЃРёРЅС‚РµР· СѓСЃРїРµС€РµРЅ (РїРѕРїС‹С‚РєР° {attempt}/{max_retries})")
                            return result
                        else:
                            logger.warning(f"[WARN] AI TTS РїРѕРїС‹С‚РєР° {attempt}/{max_retries} РЅРµ СѓРґР°Р»Р°СЃСЊ: {result.get('error')}")
                            if attempt < max_retries:
                                # Exponential backoff: 1s, 2s, 4s
                                delay = base_retry_delay * (2 ** (attempt - 1))
                                logger.info(f"вЏі РћР¶РёРґР°РЅРёРµ {delay}s РїРµСЂРµРґ СЃР»РµРґСѓСЋС‰РµР№ РїРѕРїС‹С‚РєРѕР№...")
                                await asyncio.sleep(delay)

                    except asyncio.TimeoutError:
                        logger.warning(f"[WARN] AI TTS timeout (РїРѕРїС‹С‚РєР° {attempt}/{max_retries})")
                        if attempt < max_retries:
                            delay = base_retry_delay * (2 ** (attempt - 1))
                            await asyncio.sleep(delay)
                    except aiohttp.ClientError as e:
                        logger.warning(f"[WARN] AI TTS connection error (РїРѕРїС‹С‚РєР° {attempt}/{max_retries}): {e}")
                        if attempt < max_retries:
                            delay = base_retry_delay * (2 ** (attempt - 1))
                            await asyncio.sleep(delay)
                    except Exception as e:
                        logger.error(f"[ERROR] РћС€РёР±РєР° AI TTS (РїРѕРїС‹С‚РєР° {attempt}/{max_retries}): {e}")
                        if attempt < max_retries:
                            delay = base_retry_delay * (2 ** (attempt - 1))
                            await asyncio.sleep(delay)
                        else:
                            logger.error("[ERROR] Р’СЃРµ РїРѕРїС‹С‚РєРё AI TTS РёСЃС‡РµСЂРїР°РЅС‹, РёСЃРїРѕР»СЊР·СѓРµРј fallback РЅР° gTTS")

                logger.warning(f"[WARN] AI TTS (F5-TTS) РЅРµРґРѕСЃС‚СѓРїРµРЅ РїРѕСЃР»Рµ {max_retries} РїРѕРїС‹С‚РѕРє, fallback РЅР° Р±Р°Р·РѕРІСѓСЋ TTS (gTTS)")

        # РџСЂРёРѕСЂРёС‚РµС‚ 2: Р‘Р°Р·РѕРІР°СЏ TTS (gTTS) - Р’РЎР•Р“Р”Рђ РґРѕСЃС‚СѓРїРЅР° РєР°Рє fallback
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
                logger.error(f"[ERROR] Google Cloud TTS error: {e}")

        if final_use_basic_tts:
            logger.info("[MIC] [PRIORITY 2] Using basic TTS (gTTS) - ALWAYS AVAILABLE AS FALLBACK")
            try:
                result = await self._synthesize_via_basic_tts(text, volume_level)
                if result.get("success"):
                    logger.info("[OK] Р‘Р°Р·РѕРІР°СЏ TTS (gTTS) СЃРёРЅС‚РµР· СѓСЃРїРµС€РµРЅ")
                    self.cleanup_old_files_if_needed()
                    return result
                else:
                    logger.error(f"[ERROR] Р‘Р°Р·РѕРІР°СЏ TTS (gTTS) СЃРёРЅС‚РµР· РЅРµ СѓРґР°Р»СЃСЏ: {result.get('error')}")
                    return {"success": False, "error": "Basic TTS synthesis failed"}
            except Exception as e:
                logger.error(f"[ERROR] РћС€РёР±РєР° Р±Р°Р·РѕРІРѕР№ TTS (gTTS): {e}")
                return {"success": False, "error": f"Basic TTS error: {e}"}

        # Р•СЃР»Рё РЅРёС‡РµРіРѕ РЅРµ СЃСЂР°Р±РѕС‚Р°Р»Рѕ (РїРѕС‡С‚Рё РЅРµРІРѕР·РјРѕР¶РЅРѕ)
        logger.error("[ERROR] РќРё РѕРґРЅР° TTS СЃРёСЃС‚РµРјР° РЅРµ СЃРјРѕРіР»Р° РІС‹РїРѕР»РЅРёС‚СЊ СЃРёРЅС‚РµР·")
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
        РЎРёРЅС‚РµР· С‡РµСЂРµР· СѓРґР°Р»РµРЅРЅС‹Р№ TTS СЃРµСЂРІРёСЃ (F5-TTS) СЃ СѓР»СѓС‡С€РµРЅРЅРѕР№ РѕР±СЂР°Р±РѕС‚РєРѕР№ РѕС€РёР±РѕРє.
        
        Args:
            tts_endpoint: URL TTS СЃРµСЂРІРёСЃР° (Р»РѕРєР°Р»СЊРЅС‹Р№ РёР»Рё С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№)
        
        Returns:
            Dict СЃ СЂРµР·СѓР»СЊС‚Р°С‚РѕРј СЃРёРЅС‚РµР·Р° РёР»Рё РѕС€РёР±РєРѕР№
        """
        try:
            # РСЃРїРѕР»СЊР·СѓРµРј РїРµСЂРµРґР°РЅРЅС‹Р№ endpoint РёР»Рё РґРµС„РѕР»С‚РЅС‹Р№
            endpoint = tts_endpoint or self.tts_service_url

            # РќР°СЃС‚СЂР°РёРІР°РµРј С‚Р°Р№РјР°СѓС‚С‹: 30s total, 10s connect
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

                        # [START] FIX: РџСЂРµРѕР±СЂР°Р·СѓРµРј РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РїСѓС‚СЊ РІ РїРѕР»РЅС‹Р№ URL РґР»СЏ С„СЂРѕРЅС‚РµРЅРґР°
                        if audio_url_raw:
                            if audio_url_raw.startswith('http://') or audio_url_raw.startswith('https://'):
                                # РЈР¶Рµ РїРѕР»РЅС‹Р№ URL
                                audio_url = audio_url_raw
                            elif audio_url_raw.startswith('/'):
                                # РћС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РїСѓС‚СЊ - РґРѕР±Р°РІР»СЏРµРј TTS_SERVICE_URL
                                audio_url = f"{endpoint}{audio_url_raw}"
                            else:
                                # РџСЂРѕСЃС‚Рѕ РёРјСЏ С„Р°Р№Р»Р° - РґРѕР±Р°РІР»СЏРµРј РїСѓС‚СЊ Рє audio endpoint
                                audio_url = f"{endpoint}/api/tts/audio/{audio_url_raw}"
                        else:
                            audio_url = None

                        logger.info(f"[MIC] TTS Service response: {result}")
                        logger.info(f"[LINK] Audio URL (raw): {audio_url_raw}, (full): {audio_url}")

                        # Р•СЃР»Рё РµСЃС‚СЊ connection_manager Рё РІС‹Р±СЂР°РЅ РіРѕР»РѕСЃ, РїСЂРѕРІРµСЂСЏРµРј РїСЂРёРѕСЂРёС‚РµС‚РЅСѓСЋ РіСЂРѕРјРєРѕСЃС‚СЊ
                        if connection_manager and selected_voice:
                            priority_volume = connection_manager.get_voice_volume(channel_name, selected_voice)
                            if priority_volume != TTS_DEFAULT_VOLUME:  # Р•СЃР»Рё РµСЃС‚СЊ РєР°СЃС‚РѕРјРЅР°СЏ РіСЂРѕРјРєРѕСЃС‚СЊ (РЅРµ РґРµС„РѕР»С‚РЅР°СЏ)
                                logger.info(f"[VOLUME] РџСЂРёРѕСЂРёС‚РµС‚РЅР°СЏ РіСЂРѕРјРєРѕСЃС‚СЊ РґР»СЏ РіРѕР»РѕСЃР° {selected_voice}: {priority_volume}% (default: {TTS_DEFAULT_VOLUME}%)")
                                # РџРµСЂРµСЃС‹Р»Р°РµРј Р·Р°РїСЂРѕСЃ СЃ РїСЂРёРѕСЂРёС‚РµС‚РЅРѕР№ РіСЂРѕРјРєРѕСЃС‚СЊСЋ
                                data["volume_level"] = priority_volume
                                async with session.post(url, json=data, timeout=timeout) as priority_response:
                                    if priority_response.status == 200:
                                        await priority_response.json()
                                        return {
                                            "success": True,
                                            "voice": selected_voice,
                                            "volume": priority_volume,
                                            "tts_type": "ai_f5",
                                            "audio_url": audio_url  # [OK] РџРѕР»РЅС‹Р№ URL
                                        }

                        return {
                            "success": True,
                            "voice": selected_voice,
                            "volume": volume_level,
                            "tts_type": "ai_f5",
                            "audio_url": audio_url  # [OK] РџРѕР»РЅС‹Р№ URL
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"[ERROR] TTS Service РІРµСЂРЅСѓР» РѕС€РёР±РєСѓ {response.status}: {error_text}")
                        return {"success": False, "error": f"TTS Service error: {response.status}"}

        except asyncio.TimeoutError:
            logger.error("[ERROR] TTS Service request timed out")
            return {"success": False, "error": "Request timeout"}
        except aiohttp.ClientError as e:
            logger.error(f"[ERROR] TTS Service connection error: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}
        except Exception as e:
            logger.error(f"[ERROR] РћС€РёР±РєР° РїСЂРё Р·Р°РїСЂРѕСЃРµ Рє TTS Service: {e}")
            return {"success": False, "error": "Internal server error"}

    async def _synthesize_via_basic_tts(
        self,
        text: str,
        volume_level: float
    ) -> Dict:
        """
        РЎРёРЅС‚РµР· С‡РµСЂРµР· Р»РѕРєР°Р»СЊРЅСѓСЋ Р±Р°Р·РѕРІСѓСЋ TTS (gTTS).
        Р Р°Р±РѕС‚Р°РµС‚ РџРћР›РќРћРЎРўР¬Р® Р»РѕРєР°Р»СЊРЅРѕ Р±РµР· Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ tts_service.
        """
        try:
            # gTTS СЃРёРЅС…СЂРѕРЅРЅС‹Р№, РЅРѕ Р±С‹СЃС‚СЂС‹Р№, РјРѕР¶РЅРѕ РІС‹Р·РІР°С‚СЊ РЅР°РїСЂСЏРјСѓСЋ
            audio_path = self.basic_tts.synthesize_speech(
                text=text,
                volume_level=volume_level,
                speed=1.0
            )

            if audio_path:
                # [OK] РРЎРџРћР›Р¬Р—РЈР•Рњ Р›РћРљРђР›Р¬РќРћР• РћР‘РЎР›РЈР–РР’РђРќРР• Р‘Р•Р— Р—РђР“Р РЈР—РљР РќРђ TTS_SERVICE
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
                    "audio_path": audio_path  # РћСЃС‚Р°РІР»СЏРµРј РґР»СЏ РІРЅСѓС‚СЂРµРЅРЅРµРіРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ
                }
            else:
                logger.error("[ERROR] [BASIC TTS] synthesis_speech returned None")
                return {"success": False, "error": "Basic TTS synthesis failed"}

        except Exception as e:
            logger.error(f"[ERROR] [BASIC TTS] Error: {e}")
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
            logger.error(f"[ERROR] Google Cloud TTS error: {e}")
            return {"success": False, "error": "Internal server error"}

    async def _upload_to_tts_service(self, audio_path: str) -> Optional[str]:
        """
        Р—Р°РіСЂСѓР¶Р°РµС‚ Р°СѓРґРёРѕ С„Р°Р№Р» РІ TTS СЃРµСЂРІРёСЃ РґР»СЏ РѕР±СЃР»СѓР¶РёРІР°РЅРёСЏ.
        """
        try:
            import aiohttp
            import aiofiles

            filename = Path(audio_path).name

            async with aiofiles.open(audio_path, 'rb') as f:
                audio_data = await f.read()

            async with aiohttp.ClientSession() as session:
                # РћС‚РїСЂР°РІР»СЏРµРј С„Р°Р№Р» РІ TTS СЃРµСЂРІРёСЃ
                data = aiohttp.FormData()
                data.add_field('file', audio_data, filename=filename, content_type='audio/wav')

                async with session.post(f"{self.tts_service_url}/api/upload-audio", data=data) as response:
                    if response.status == 200:
                        await response.json()
                        audio_url = f"{self.tts_service_url}/api/audio/{filename}"
                        logger.info(f"[OK] РђСѓРґРёРѕ С„Р°Р№Р» Р·Р°РіСЂСѓР¶РµРЅ РІ TTS СЃРµСЂРІРёСЃ: {audio_url}")
                        return audio_url
                    else:
                        logger.warning(f"[WARN] РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІ TTS СЃРµСЂРІРёСЃ: {response.status}")
                        return None

        except Exception as e:
            logger.error(f"[ERROR] РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РІ TTS СЃРµСЂРІРёСЃ: {e}")
            return None

    def cleanup_old_files(self):
        """РћС‡РёСЃС‚РєР° СЃС‚Р°СЂС‹С… РІСЂРµРјРµРЅРЅС‹С… С„Р°Р№Р»РѕРІ Р±Р°Р·РѕРІРѕР№ TTS"""
        try:
            self.basic_tts.cleanup_old_files()
        except Exception as e:
            logger.error(f"[ERROR] РћС€РёР±РєР° РїСЂРё РѕС‡РёСЃС‚РєРµ С„Р°Р№Р»РѕРІ: {e}")

    def cleanup_old_files_if_needed(self):
        """РћС‡РёСЃС‚РєР° СЃС‚Р°СЂС‹С… С„Р°Р№Р»РѕРІ РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё (РєР°Р¶РґС‹Рµ 10 СЃРёРЅС‚РµР·РѕРІ)"""
        if not hasattr(self, '_synthesis_count'):
            self._synthesis_count = 0

        self._synthesis_count += 1

        # РћС‡РёС‰Р°РµРј РєР°Р¶РґС‹Рµ 10 СЃРёРЅС‚РµР·РѕРІ
        if self._synthesis_count % 10 == 0:
            try:
                self.cleanup_old_files()
                logger.info(f"[CLEAN] РџРµСЂРёРѕРґРёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР° TTS С„Р°Р№Р»РѕРІ (СЃРёРЅС‚РµР· #{self._synthesis_count})")
            except Exception as e:
                logger.error(f"[ERROR] РћС€РёР±РєР° РїСЂРё РїРµСЂРёРѕРґРёС‡РµСЃРєРѕР№ РѕС‡РёСЃС‚РєРµ: {e}")


# Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ СЌРєР·РµРјРїР»СЏСЂ TTS Manager
_tts_manager_instance = None

def get_tts_manager() -> TTSManager:
    """РџРѕР»СѓС‡РёС‚СЊ РіР»РѕР±Р°Р»СЊРЅС‹Р№ СЌРєР·РµРјРїР»СЏСЂ TTS Manager (singleton)"""
    global _tts_manager_instance
    if _tts_manager_instance is None:
        _tts_manager_instance = TTSManager()
    return _tts_manager_instance

