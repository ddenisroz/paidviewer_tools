#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РњСѓР»СЊС‚РёСЏР·С‹С‡РЅР°СЏ СЂРµР°Р»РёР·Р°С†РёСЏ F5-TTS СЃ РїРѕРґРґРµСЂР¶РєРѕР№ СЂСѓСЃСЃРєРѕРіРѕ Рё Р°РЅРіР»РёР№СЃРєРѕРіРѕ СЏР·С‹РєРѕРІ
"""

import logging
import os
import re
from pathlib import Path
from typing import Optional
import tempfile

import numpy as np
import soundfile as sf
import torch
from f5_tts.api import F5TTS
from huggingface_hub import hf_hub_download
from ruaccent import RUAccent
from .yoficator_module import yoficate_text
from .number_converter import convert_numbers_in_text
from .time_converter import convert_all_time_in_text
from .date_converter import convert_all_dates_in_text
from .money_converter import convert_all_money_in_text
try:
    from ..config import config
except ImportError:
    from config import config

# РќР°СЃС‚СЂРѕР№РєР° Р»РѕРіРёСЂРѕРІР°РЅРёСЏ (basicConfig СѓР¶Рµ РЅР°СЃС‚СЂРѕРµРЅ РІ app_factory РёР»Рё main)
logger = logging.getLogger(__name__)

# РљРѕРЅСЃС‚Р°РЅС‚С‹ РґР»СЏ РјРѕРґРµР»Рё F5-TTS (РїРѕРґРґРµСЂР¶РёРІР°РµС‚ СЂСѓСЃСЃРєРёР№ Рё Р°РЅРіР»РёР№СЃРєРёР№)
MODEL_ID = "Misha24-10/F5-TTS_RUSSIAN"
CHECKPOINT = "F5TTS_v1_Base_v2/model_last_inference.safetensors"
VOCAB = "F5TTS_v1_Base/vocab.txt"

# РўСЂР°РЅСЃРєСЂРёРїС†РёСЏ РґР»СЏ СЂРµС„РµСЂРµРЅСЃРЅРѕРіРѕ РіРѕР»РѕСЃР° (РёР· speaker1.txt)  
DEFAULT_VOICE_TRANSCRIPTION = "РЎРѕР·РґР°РІР°СЏ СѓРЅРёРєР°Р»СЊРЅС‹Рµ С†РёС„СЂРѕРІС‹Рµ РѕР±СЉРµРєС‚С‹, РІС‹ СЂР°Р·РјС‹С€Р»СЏРµС‚Рµ Рѕ С‚РѕРј РЅР°СЃРєРѕР»СЊРєРѕ РёРЅС‚РµСЂРµСЃРЅС‹ РІР°С€Рё РёРґРµРё РјРёСЂСѓ, РЅРѕ Р·Р°РґСѓРјС‹РІР°РµС‚РµР»СЊ Р»Рё РІС‹, РєР°Рє Р·Р°С‰РёС‚РёС‚СЊ РїСЂР°РІР° РЅР° СЃРІРѕРё РїСЂРѕРёР·РІРµРґРµРЅРёСЏ."


class RussianTTS:
    def __init__(self, enable_accent=True, 
                 accent_model_size="turbo", ode_method="euler", use_ema=True):
        
        # Р‘РµР·РѕРїР°СЃРЅР°СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ CUDA
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # РџСЂРѕРІРµСЂСЏРµРј CUDA РЅР° СЂР°Р±РѕС‚РѕСЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ
        if self.device == "cuda":
            try:
                # РўРµСЃС‚РѕРІР°СЏ РѕРїРµСЂР°С†РёСЏ РґР»СЏ РїСЂРѕРІРµСЂРєРё CUDA
                test_tensor = torch.zeros(1, device="cuda")
                del test_tensor
                torch.cuda.empty_cache()
                logger.info(f"CUDA РїСЂРѕРІРµСЂРєР° РїСЂРѕС€Р»Р° СѓСЃРїРµС€РЅРѕ")
            except Exception:
                logger.warning("CUDA тест не прошел, переключаемся на CPU", exc_info=True)
                self.device = "cpu"
        self.enable_accent = enable_accent
        self.accent_model_size = accent_model_size
        self.ode_method = ode_method
        self.use_ema = use_ema
        logger.info(f"F5-TTS РёСЃРїРѕР»СЊР·СѓРµС‚ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ: {self.device}")

        # F5-TTS РјРѕРґРµР»СЊ (РїРѕРґРґРµСЂР¶РёРІР°РµС‚ СЂСѓСЃСЃРєРёР№ Рё Р°РЅРіР»РёР№СЃРєРёР№)
        self.tts_model = None
        self.accentizer = None
        
        # Р—Р°РіСЂСѓР¶Р°РµРј РјРѕРґРµР»Рё
        try:
            self._load_models()
        except Exception:
            logger.exception("РќРµ СѓРґР°Р»РѕСЃСЊ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ TTS")
            # РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј None, С‡С‚РѕР±С‹ is_ready() РІРѕР·РІСЂР°С‰Р°Р» False
            self.tts_model = None

    def is_ready(self):
        """РџСЂРѕРІРµСЂСЏРµС‚, РіРѕС‚РѕРІ Р»Рё TTS РґРІРёР¶РѕРє Рє СЂР°Р±РѕС‚Рµ."""
        return self.tts_model is not None

    def _load_models(self):
        """Р—Р°РіСЂСѓР¶Р°РµС‚ F5-TTS РјРѕРґРµР»Рё Рё RUAccent."""
        try:
            # Р—Р°РіСЂСѓР¶Р°РµРј RUAccent РґР»СЏ СѓРґР°СЂРµРЅРёР№
            if self.enable_accent:
                logger.info(f"Р—Р°РіСЂСѓР¶Р°РµРј RUAccent РґР»СЏ СЂР°СЃСЃС‚Р°РЅРѕРІРєРё СѓРґР°СЂРµРЅРёР№ (РјРѕРґРµР»СЊ: {self.accent_model_size})...")
                try:
                    self.accentizer = RUAccent()
                    # РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј РјРѕРґРµР»СЊ СЃ РІС‹Р±СЂР°РЅРЅС‹Рј СЂР°Р·РјРµСЂРѕРј
                    self.accentizer.load(omograph_model_size=self.accent_model_size, use_dictionary=True)
                    logger.info(f"RUAccent Р·Р°РіСЂСѓР¶РµРЅ СѓСЃРїРµС€РЅРѕ (РјРѕРґРµР»СЊ: {self.accent_model_size})")
                except Exception:
                    logger.warning("Не удалось загрузить RUAccent", exc_info=True)
                    self.accentizer = None
            
            # Р—Р°РіСЂСѓР¶Р°РµРј РµРґРёРЅСѓСЋ РјРѕРґРµР»СЊ F5-TTS
            self._load_tts_model()
            
            # РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РјРѕРґРµР»СЊ Р·Р°РіСЂСѓР¶РµРЅР°
            if self.tts_model is None:
                raise RuntimeError("TTS РјРѕРґРµР»СЊ РЅРµ Р·Р°РіСЂСѓР¶РµРЅР°")

        except Exception:
            logger.exception("РљР РРўРР§Р•РЎРљРђРЇ РћРЁРР‘РљРђ: РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РјРѕРґРµР»Рё. РћС€РёР±РєР°")
            raise  # РџСЂРѕР±СЂР°СЃС‹РІР°РµРј РѕС€РёР±РєСѓ РґР°Р»СЊС€Рµ


    def _load_tts_model(self):
        """Р—Р°РіСЂСѓР¶Р°РµС‚ F5-TTS РјРѕРґРµР»СЊ (РїРѕРґРґРµСЂР¶РёРІР°РµС‚ СЂСѓСЃСЃРєРёР№ Рё Р°РЅРіР»РёР№СЃРєРёР№)."""
        try:
            logger.info("Р—Р°РіСЂСѓР¶Р°РµРј F5-TTS РјРѕРґРµР»СЊ...")
            
            cache_dir = Path("f5_tts_cache")
            cache_dir.mkdir(exist_ok=True)

            # РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё СѓР¶Рµ СЃРєР°С‡Р°РЅРЅР°СЏ РјРѕРґРµР»СЊ
            # РС‰РµРј РІ СЂР°Р·РЅС‹С… РІРѕР·РјРѕР¶РЅС‹С… РїСѓС‚СЏС…
            possible_paths = [
                cache_dir / "models--Misha24-10--F5-TTS_RUSSIAN" / "snapshots" / "main" / "F5TTS_v1_Base_v2" / "model_last_inference.safetensors",
                cache_dir / "models--Misha24-10--F5-TTS_RUSSIAN" / "snapshots" / "4f5ee5def0435265fe6ecf2143df2ef26d926b62" / "F5TTS_v1_Base_v2" / "model_last_inference.safetensors"
            ]
            
            local_ckpt_path = None
            for path in possible_paths:
                if path.exists():
                    local_ckpt_path = path
                    break
            if local_ckpt_path and local_ckpt_path.exists():
                logger.info(f"РСЃРїРѕР»СЊР·СѓРµРј Р»РѕРєР°Р»СЊРЅСѓСЋ РјРѕРґРµР»СЊ: {local_ckpt_path}")
                ckpt_path = str(local_ckpt_path)
            else:
                try:
                    # РЎРєР°С‡РёРІР°РµРј РјРѕРґРµР»СЊ checkpoint
                    ckpt_path = hf_hub_download(
                        repo_id=MODEL_ID,
                        filename=CHECKPOINT,
                        cache_dir=cache_dir
                    )
                    logger.info(f"Checkpoint СЃРєР°С‡Р°РЅ РІ: {ckpt_path}")
                except Exception as download_error:
                    logger.error(f"РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РјРѕРґРµР»Рё: {download_error}")
                    logger.info("РџРѕРїСЂРѕР±СѓР№С‚Рµ СЃРєР°С‡Р°С‚СЊ РјРѕРґРµР»СЊ РІСЂСѓС‡РЅСѓСЋ РёР»Рё РїСЂРѕРІРµСЂСЊС‚Рµ РёРЅС‚РµСЂРЅРµС‚-СЃРѕРµРґРёРЅРµРЅРёРµ")
                    raise RuntimeError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ TTS РјРѕРґРµР»СЊ")

            # РџСЂРѕРІРµСЂСЏРµРј vocab.txt
            # РС‰РµРј РІ СЂР°Р·РЅС‹С… РІРѕР·РјРѕР¶РЅС‹С… РїСѓС‚СЏС…
            vocab_possible_paths = [
                cache_dir / "models--Misha24-10--F5-TTS_RUSSIAN" / "snapshots" / "main" / "vocab.txt",
                cache_dir / "models--Misha24-10--F5-TTS_RUSSIAN" / "snapshots" / "4f5ee5def0435265fe6ecf2143df2ef26d926b62" / "F5TTS_v1_Base" / "vocab.txt"
            ]
            
            local_vocab_path = None
            for path in vocab_possible_paths:
                if path.exists():
                    local_vocab_path = path
                    break
            if local_vocab_path and local_vocab_path.exists():
                logger.info(f"РСЃРїРѕР»СЊР·СѓРµРј Р»РѕРєР°Р»СЊРЅС‹Р№ vocab: {local_vocab_path}")
                vocab_path = str(local_vocab_path)
            else:
                try:
                    vocab_path = hf_hub_download(
                        repo_id=MODEL_ID,
                        filename=VOCAB,
                        cache_dir=cache_dir
                    )
                except Exception as vocab_error:
                    logger.error(f"РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё vocab: {vocab_error}")
                    logger.info("РџРѕРїСЂРѕР±СѓР№С‚Рµ СЃРєР°С‡Р°С‚СЊ vocab.txt РІСЂСѓС‡РЅСѓСЋ")
                    raise RuntimeError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ vocab С„Р°Р№Р»")
            logger.info(f"Vocab.txt СЃРєР°С‡Р°РЅ РІ: {vocab_path}")

            # РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј F5TTS СЃ Р±РµР·РѕРїР°СЃРЅС‹РјРё РїР°СЂР°РјРµС‚СЂР°РјРё РґР»СЏ CUDA
            try:
                # РћС‡РёС‰Р°РµРј CUDA РєРµС€ РїРµСЂРµРґ РёРЅРёС†РёР°Р»РёР·Р°С†РёРµР№
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
                
                # РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ РґР»СЏ HuggingFace РєРµС€Р°
                import os
                os.environ['HF_HOME'] = str(cache_dir.absolute())
                os.environ['HUGGINGFACE_HUB_CACHE'] = str(cache_dir.absolute())
                # РћС‚РєР»СЋС‡Р°РµРј РїСЂРѕРєСЃРё РґР»СЏ HuggingFace
                os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
                os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
                # РћС‚РєР»СЋС‡Р°РµРј РїСЂРѕРєСЃРё РїРѕР»РЅРѕСЃС‚СЊСЋ
                os.environ['NO_PROXY'] = 'huggingface.co'
                os.environ['http_proxy'] = ''
                os.environ['https_proxy'] = ''
                os.environ['HTTP_PROXY'] = ''
                os.environ['HTTPS_PROXY'] = ''
                
                self.tts_model = F5TTS(
                    model="F5TTS_v1_Base",
                    ckpt_file=ckpt_path,
                    vocab_file=vocab_path,
                    ode_method=self.ode_method,
                    use_ema=self.use_ema,
                    device=self.device,
                    hf_cache_dir=str(cache_dir)
                )
                
                # РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РјРѕРґРµР»СЊ РІ СЂРµР¶РёРј eval РґР»СЏ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё
                if hasattr(self.tts_model, 'model'):
                    self.tts_model.model.eval()
                    
            except Exception as e:
                logger.exception("РћС€РёР±РєР° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё F5TTS")
                # РџРѕРІС‚РѕСЂРЅР°СЏ РїРѕРїС‹С‚РєР° СЃ РѕС‡РёСЃС‚РєРѕР№ РєРµС€Р°
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.reset_peak_memory_stats()
                
                # Р•СЃР»Рё СЌС‚Рѕ РѕС€РёР±РєР° РїСЂРѕРєСЃРё, РїСЂРѕР±СѓРµРј Р·Р°РіСЂСѓР·РёС‚СЊ Р±РµР· РІРѕРєРѕРґРµСЂР°
                if "proxy" in str(e).lower() or "ssl" in str(e).lower():
                    logger.warning("РџСЂРѕР±Р»РµРјР° СЃ РїСЂРѕРєСЃРё, РїСЂРѕР±СѓРµРј Р·Р°РіСЂСѓР·РёС‚СЊ F5-TTS Р±РµР· РІРѕРєРѕРґРµСЂР°...")
                    try:
                        # РџСЂРѕР±СѓРµРј Р·Р°РіСЂСѓР·РёС‚СЊ С‚РѕР»СЊРєРѕ РѕСЃРЅРѕРІРЅСѓСЋ РјРѕРґРµР»СЊ Р±РµР· РІРѕРєРѕРґРµСЂР°
                        self.tts_model = F5TTS(
                            model="F5TTS_v1_Base",
                            ckpt_file=ckpt_path,
                            vocab_file=vocab_path,
                            ode_method=self.ode_method,
                            use_ema=self.use_ema,
                            device=self.device,
                            hf_cache_dir=str(cache_dir),
                            vocoder=None  # РћС‚РєР»СЋС‡Р°РµРј РІРѕРєРѕРґРµСЂ
                        )
                        logger.info("F5-TTS Р·Р°РіСЂСѓР¶РµРЅ Р±РµР· РІРѕРєРѕРґРµСЂР° (fallback СЂРµР¶РёРј)")
                    except Exception:
                        logger.exception("Не удалось загрузить F5-TTS даже без вокодера")
                        raise
                else:
                    raise
            
            logger.info("F5-TTS РјРѕРґРµР»СЊ Р·Р°РіСЂСѓР¶РµРЅР° СѓСЃРїРµС€РЅРѕ.")

        except Exception:
            logger.exception("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РјРѕРґРµР»Рё")
            self.tts_model = None


    def detect_language(self, text: str) -> str:
        """РћРїСЂРµРґРµР»СЏРµС‚ СЏР·С‹Рє С‚РµРєСЃС‚Р°."""
        # РџРѕРґСЃС‡РёС‚С‹РІР°РµРј РєРѕР»РёС‡РµСЃС‚РІРѕ РєРёСЂРёР»Р»РёС‡РµСЃРєРёС… Рё Р»Р°С‚РёРЅСЃРєРёС… СЃРёРјРІРѕР»РѕРІ
        cyrillic_pattern = re.compile(r'[Р°-СЏС‘]', re.IGNORECASE)
        latin_pattern = re.compile(r'[a-z]', re.IGNORECASE)
        
        cyrillic_count = len(cyrillic_pattern.findall(text))
        latin_count = len(latin_pattern.findall(text))
        
        logger.info(f"РђРЅР°Р»РёР· СЏР·С‹РєР°: РєРёСЂРёР»Р»РёС†Р°={cyrillic_count}, Р»Р°С‚РёРЅРёС†Р°={latin_count}")
        
        # Р•СЃР»Рё Р±РѕР»СЊС€Рµ РєРёСЂРёР»Р»РёС‡РµСЃРєРёС… СЃРёРјРІРѕР»РѕРІ - СЂСѓСЃСЃРєРёР№
        if cyrillic_count > latin_count:
            logger.info(f"Р’С‹Р±СЂР°РЅ СЂСѓСЃСЃРєРёР№ СЏР·С‹Рє (РєРёСЂРёР»Р»РёС†Р° > Р»Р°С‚РёРЅРёС†С‹)")
            return "russian"
        # Р•СЃР»Рё Р±РѕР»СЊС€Рµ Р»Р°С‚РёРЅСЃРєРёС… СЃРёРјРІРѕР»РѕРІ - Р°РЅРіР»РёР№СЃРєРёР№
        elif latin_count > cyrillic_count:
            logger.info(f"Р’С‹Р±СЂР°РЅ Р°РЅРіР»РёР№СЃРєРёР№ СЏР·С‹Рє (Р»Р°С‚РёРЅРёС†Р° > РєРёСЂРёР»Р»РёС†С‹)")
            return "english"
        # Р•СЃР»Рё СЂР°РІРЅРѕРµ РєРѕР»РёС‡РµСЃС‚РІРѕ - РїСЂРѕРІРµСЂСЏРµРј РЅР°Р»РёС‡РёРµ РєРёСЂРёР»Р»РёС†С‹
        elif cyrillic_count > 0:
            logger.info(f"Р’С‹Р±СЂР°РЅ СЂСѓСЃСЃРєРёР№ СЏР·С‹Рє (РµСЃС‚СЊ РєРёСЂРёР»Р»РёС†Р° РїСЂРё СЂР°РІРЅРѕРј РєРѕР»РёС‡РµСЃС‚РІРµ)")
            return "russian"
        else:
            # Р•СЃР»Рё РЅРµС‚ Р±СѓРєРІ РІРѕРѕР±С‰Рµ (С‚РѕР»СЊРєРѕ С‡РёСЃР»Р° Рё СЃРёРјРІРѕР»С‹) - РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ СЂСѓСЃСЃРєРёР№
            logger.info(f"Р’С‹Р±СЂР°РЅ СЂСѓСЃСЃРєРёР№ СЏР·С‹Рє (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РґР»СЏ С‡РёСЃРµР» Рё СЃРёРјРІРѕР»РѕРІ)")
            return "russian"

    


    def _is_only_symbols(self, text: str) -> bool:
        """РџСЂРѕРІРµСЂСЏРµС‚, СЃРѕСЃС‚РѕРёС‚ Р»Рё С‚РµРєСЃС‚ С‚РѕР»СЊРєРѕ РёР· Р·РЅР°РєРѕРІ РїСЂРµРїРёРЅР°РЅРёСЏ Рё СЃРёРјРІРѕР»РѕРІ."""
        # РЈР±РёСЂР°РµРј РїСЂРѕР±РµР»С‹ Рё РїСЂРѕРІРµСЂСЏРµРј, РѕСЃС‚Р°Р»РёСЃСЊ Р»Рё С‚РѕР»СЊРєРѕ СЃРёРјРІРѕР»С‹
        text_no_spaces = text.replace(" ", "")
        if not text_no_spaces:
            return True
        
        # РџСЂРѕРІРµСЂСЏРµРј, РµСЃС‚СЊ Р»Рё С…РѕС‚СЏ Р±С‹ РѕРґРЅР° Р±СѓРєРІР° РёР»Рё С†РёС„СЂР° (РІРєР»СЋС‡Р°СЏ РєРёСЂРёР»Р»РёС†Сѓ)
        has_letter_or_digit = any(
            c.isalnum() or  # ASCII Р±СѓРєРІС‹ Рё С†РёС„СЂС‹
            c.isalpha() or  # Р›СЋР±С‹Рµ Р±СѓРєРІС‹ (РІРєР»СЋС‡Р°СЏ РєРёСЂРёР»Р»РёС†Сѓ)
            c.isdigit()     # Р›СЋР±С‹Рµ С†РёС„СЂС‹
            for c in text_no_spaces
        )
        return not has_letter_or_digit

    def _remove_long_symbol_sequences(self, text: str) -> str:
        """РЈРґР°Р»СЏРµС‚ РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚Рё РёР· Р±РѕР»РµРµ С‡РµРј 3 Р·РЅР°РєРѕРІ РїРѕРґСЂСЏРґ."""
        import re
        # Р—Р°РјРµРЅСЏРµРј РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚Рё РёР· 4+ РѕРґРёРЅР°РєРѕРІС‹С… СЃРёРјРІРѕР»РѕРІ РЅР° 3
        pattern = r'(.)\1{3,}'
        return re.sub(pattern, r'\1\1\1', text)

    def add_accents(self, text: str) -> str:
        """Р”РѕР±Р°РІР»СЏРµС‚ СѓРґР°СЂРµРЅРёСЏ Рє СЂСѓСЃСЃРєРѕРјСѓ С‚РµРєСЃС‚Сѓ."""
        if not self.accentizer or not text.strip():
            return text
        
        # РћС‡РёС‰Р°РµРј РїСЂРѕР±РµР»С‹ РїРµСЂРµРґ РѕР±СЂР°Р±РѕС‚РєРѕР№
        import re
        text = re.sub(r'\s+', ' ', text.strip())
        
        try:
            # РџСЂРѕР±СѓРµРј СЂР°Р·РЅС‹Рµ РјРµС‚РѕРґС‹ RUAccent
            if hasattr(self.accentizer, 'process_all'):
                accented_text = self.accentizer.process_all(text)
            elif hasattr(self.accentizer, 'process'):
                accented_text = self.accentizer.process(text)
            else:
                # Р•СЃР»Рё РЅРёС‡РµРіРѕ РЅРµ СЂР°Р±РѕС‚Р°РµС‚, РІРѕР·РІСЂР°С‰Р°РµРј РёСЃС…РѕРґРЅС‹Р№ С‚РµРєСЃС‚
                logger.warning("RUAccent РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ РґРѕСЃС‚СѓРїРЅС‹Рµ РјРµС‚РѕРґС‹")
                return text
                
            logger.info(f"Р”РѕР±Р°РІР»РµРЅС‹ СѓРґР°СЂРµРЅРёСЏ: '{text[:50]}...' -> '{accented_text[:50]}...'")
            # РћС‡РёС‰Р°РµРј РїСЂРѕР±РµР»С‹ РІ СЂРµР·СѓР»СЊС‚Р°С‚Рµ
            return re.sub(r'\s+', ' ', accented_text).strip()
        except Exception:
            logger.warning("Ошибка добавления ударений", exc_info=True)
            return text

    def preprocess_text_for_tts(self, text: str) -> str:
        """РџСЂРµРґРѕР±СЂР°Р±РѕС‚РєР° С‚РµРєСЃС‚Р° СЃ СѓС‡РµС‚РѕРј СЏР·С‹РєР° Рё РєРѕРЅРІРµСЂС‚Р°С†РёРµР№ С‡РёСЃРµР»."""
        # РЎРЅР°С‡Р°Р»Р° СѓР±РёСЂР°РµРј РІСЃРµ Р»РёС€РЅРёРµ РїСЂРѕР±РµР»С‹
        import re
        processed_text = re.sub(r'\s+', ' ', text.strip())
        if not processed_text:
            return ""
        
        logger.info(f"РСЃС…РѕРґРЅС‹Р№ С‚РµРєСЃС‚: '{processed_text}'")
        
        # РџСЂРѕРІРµСЂСЏРµРј, СЃРѕСЃС‚РѕРёС‚ Р»Рё СЃРѕРѕР±С‰РµРЅРёРµ С‚РѕР»СЊРєРѕ РёР· Р·РЅР°РєРѕРІ РїСЂРµРїРёРЅР°РЅРёСЏ/СЃРёРјРІРѕР»РѕРІ
        if self._is_only_symbols(processed_text):
            logger.warning("РЎРѕРѕР±С‰РµРЅРёРµ СЃРѕСЃС‚РѕРёС‚ С‚РѕР»СЊРєРѕ РёР· Р·РЅР°РєРѕРІ - РёРіРЅРѕСЂРёСЂСѓРµРј")
            return ""
        
        # РЈР±РёСЂР°РµРј РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚Рё РёР· Р±РѕР»РµРµ С‡РµРј 3 Р·РЅР°РєРѕРІ РїРѕРґСЂСЏРґ
        processed_text = self._remove_long_symbol_sequences(processed_text)
        if not processed_text.strip():
            logger.warning("РџРѕСЃР»Рµ СѓРґР°Р»РµРЅРёСЏ РґР»РёРЅРЅС‹С… РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚РµР№ СЃРёРјРІРѕР»РѕРІ С‚РµРєСЃС‚ СЃС‚Р°Р» РїСѓСЃС‚С‹Рј")
            return ""
        
        # РћРїСЂРµРґРµР»СЏРµРј СЏР·С‹Рє
        language = self.detect_language(processed_text)
        logger.info(f"РћРїСЂРµРґРµР»РµРЅРЅС‹Р№ СЏР·С‹Рє: {language}")
        
        # РЈР±РёСЂР°РµРј Р»РёС€РЅРёРµ РїСЂРѕР±РµР»С‹
        processed_text = ' '.join(processed_text.split())
        
        # РџСЂРёРјРµРЅСЏРµРј С‘С„РёРєР°С‚РѕСЂ РґР»СЏ СЂСѓСЃСЃРєРѕРіРѕ С‚РµРєСЃС‚Р°
        if language == "russian":
            try:
                processed_text = yoficate_text(processed_text)
                logger.info(f"РџРѕСЃР»Рµ С‘С„РёРєР°С†РёРё: '{processed_text}'")
            except Exception:
                logger.warning("Ошибка ёфикации", exc_info=True)
        
        # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј РґР°С‚С‹ РІ СЃР»РѕРІР° РґР»СЏ СЂСѓСЃСЃРєРѕРіРѕ С‚РµРєСЃС‚Р° (РџР•Р Р’Р«Рњ, С‡С‚РѕР±С‹ РёР·Р±РµР¶Р°С‚СЊ РєРѕРЅС„Р»РёРєС‚РѕРІ СЃ РІСЂРµРјРµРЅРµРј)
        if language == "russian":
            try:
                processed_text = convert_all_dates_in_text(processed_text)
                logger.info(f"РџРѕСЃР»Рµ РєРѕРЅРІРµСЂС‚Р°С†РёРё РґР°С‚: '{processed_text}'")
            except Exception:
                logger.warning("Ошибка конвертации дат", exc_info=True)
        
        # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј РІСЂРµРјСЏ РІ СЃР»РѕРІР° РґР»СЏ СЂСѓСЃСЃРєРѕРіРѕ С‚РµРєСЃС‚Р°
        if language == "russian":
            try:
                processed_text = convert_all_time_in_text(processed_text)
                logger.info(f"РџРѕСЃР»Рµ РєРѕРЅРІРµСЂС‚Р°С†РёРё РІСЂРµРјРµРЅРё: '{processed_text}'")
            except Exception:
                logger.warning("Ошибка конвертации времени", exc_info=True)
        
        # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј РґРµРЅРµР¶РЅС‹Рµ СЃСѓРјРјС‹ РІ СЃР»РѕРІР° РґР»СЏ СЂСѓСЃСЃРєРѕРіРѕ С‚РµРєСЃС‚Р°
        if language == "russian":
            try:
                processed_text = convert_all_money_in_text(processed_text)
                logger.info(f"РџРѕСЃР»Рµ РєРѕРЅРІРµСЂС‚Р°С†РёРё РґРµРЅРµР¶РЅС‹С… СЃСѓРјРј: '{processed_text}'")
            except Exception:
                logger.warning("Ошибка конвертации денежных сумм", exc_info=True)
        
        # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј С‡РёСЃР»Р° РІ СЃР»РѕРІР° РґР»СЏ СЂСѓСЃСЃРєРѕРіРѕ С‚РµРєСЃС‚Р° (РџРћРЎР›Р•Р”РќРРњ, С‡С‚РѕР±С‹ РЅРµ РєРѕРЅС„Р»РёРєС‚РѕРІР°С‚СЊ СЃ РґР°С‚Р°РјРё/РІСЂРµРјРµРЅРµРј/РґРµРЅСЊРіР°РјРё)
        if language == "russian":
            try:
                processed_text = convert_numbers_in_text(processed_text)
                logger.info(f"РџРѕСЃР»Рµ РєРѕРЅРІРµСЂС‚Р°С†РёРё С‡РёСЃРµР»: '{processed_text}'")
            except Exception:
                logger.warning("Ошибка конвертации чисел", exc_info=True)
        
        # Р”Р»СЏ СЂСѓСЃСЃРєРѕРіРѕ С‚РµРєСЃС‚Р° РґРѕР±Р°РІР»СЏРµРј СѓРґР°СЂРµРЅРёСЏ
        if language == "russian" and self.enable_accent:
            processed_text = self.add_accents(processed_text)
        
        # Р”Р»СЏ Р°РЅРіР»РёР№СЃРєРѕРіРѕ С‚РµРєСЃС‚Р° РїСЂРёРјРµРЅСЏРµРј СЃРїРµС†РёР°Р»СЊРЅСѓСЋ РѕР±СЂР°Р±РѕС‚РєСѓ
        elif language == "english":
            # РђРЅРіР»РёР№СЃРєРёР№ С‚РµРєСЃС‚ РЅРµ С‚СЂРµР±СѓРµС‚ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕР№ РѕР±СЂР°Р±РѕС‚РєРё
            # РЅРѕ СѓР±РµР¶РґР°РµРјСЃСЏ, С‡С‚Рѕ РѕРЅ РїСЂР°РІРёР»СЊРЅРѕ РѕС‚С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅ
            processed_text = processed_text.strip()
            logger.info(f"РђРЅРіР»РёР№СЃРєРёР№ С‚РµРєСЃС‚ РіРѕС‚РѕРІ Рє СЃРёРЅС‚РµР·Сѓ: '{processed_text}'")
        
        # РћР±СЂР°Р±РѕС‚РєР° РѕРєРѕРЅС‡Р°РЅРёР№ - РґРѕР±Р°РІР»СЏРµРј С‚РѕР»СЊРєРѕ С‚РѕС‡РєСѓ РµСЃР»Рё РµРµ РЅРµ Р±С‹Р»Рѕ
        if processed_text:
            # РЈР±РёСЂР°РµРј Р»РёС€РЅРёРµ РїСЂРѕР±РµР»С‹ РІ РєРѕРЅС†Рµ
            processed_text = processed_text.rstrip()
            
            # Р”РѕР±Р°РІР»СЏРµРј С‚РѕС‡РєСѓ РІ РєРѕРЅС†Рµ РµСЃР»Рё РЅРµС‚ Р·РЅР°РєРѕРІ РїСЂРµРїРёРЅР°РЅРёСЏ
            if not processed_text.endswith(('.', '!', '?')):
                processed_text += '.'
        
        # Р¤РёРЅР°Р»СЊРЅР°СЏ РѕС‡РёСЃС‚РєР° РїСЂРѕР±РµР»РѕРІ
        processed_text = re.sub(r'\s+', ' ', processed_text).strip()
        
        logger.info(f"РћР±СЂР°Р±РѕС‚Р°РЅРЅС‹Р№ С‚РµРєСЃС‚: '{processed_text}'")
        
        return processed_text

    # РџСЂРµСЃРµС‚С‹ СЃРєРѕСЂРѕСЃС‚Рё РґР»СЏ СЂР°Р·РЅС‹С… СЂРµР¶РёРјРѕРІ
    SPEED_PRESETS = {
        'very_slow': {
            'name': 'РћС‡РµРЅСЊ РјРµРґР»РµРЅРЅС‹Р№',
            'description': 'РњР°РєСЃРёРјР°Р»СЊРЅРѕ РјРµРґР»РµРЅРЅР°СЏ СЂРµС‡СЊ',
            'settings': {
                'russian': [0.1, 0.3, 0.6, 0.8, 0.9, 1.0],
                'english': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
            }
        },
        'slow': {
            'name': 'РњРµРґР»РµРЅРЅС‹Р№', 
            'description': 'Р—Р°РјРµРґР»РµРЅРЅР°СЏ СЂРµС‡СЊ',
            'settings': {
                'russian': [0.3, 0.6, 0.8, 0.9, 0.9, 1.0],
                'english': [0.2, 0.4, 0.5, 0.7, 0.7, 0.8]
            }
        },
        'normal': {
            'name': 'РќРѕСЂРјР°Р»СЊРЅС‹Р№',
            'description': 'РћР±С‹С‡РЅР°СЏ СЃРєРѕСЂРѕСЃС‚СЊ СЂРµС‡Рё',
            'settings': {
                'russian': [0.5, 0.8, 1.0, 1.0, 1.0, 1.0],
                'english': [0.3, 0.7, 0.8, 0.9, 1.0, 1.0]
            }
        },
        'fast': {
            'name': 'Р‘С‹СЃС‚СЂС‹Р№',
            'description': 'РЈСЃРєРѕСЂРµРЅРЅР°СЏ СЂРµС‡СЊ',
            'settings': {
                'russian': [0.8, 1.0, 1.2, 1.3, 1.4, 1.5],
                'english': [0.7, 1.0, 1.1, 1.2, 1.3, 1.3]
            }
        },
        'very_fast': {
            'name': 'РћС‡РµРЅСЊ Р±С‹СЃС‚СЂС‹Р№',
            'description': 'РњР°РєСЃРёРјР°Р»СЊРЅРѕ СѓСЃРєРѕСЂРµРЅРЅР°СЏ СЂРµС‡СЊ',
            'settings': {
                'russian': [0.8, 1.1, 1.4, 1.5, 1.6, 1.8],
                'english': [0.7, 1.0, 1.3, 1.5, 1.6, 1.7]
            }
        }
    }

    def synthesize_speech(self, text: str, ref_audio_path: str, ref_text: str = "", 
                         speed: float = None, nfe_step: int = None, 
                         fix_duration: Optional[float] = None, remove_silence: bool = False, 
                         seed: Optional[int] = None, cfg_strength: float = None, 
                         target_rms: float = None, speed_preset: str = 'normal') -> Optional[str]:
        """РЎРёРЅС‚РµР·РёСЂСѓРµС‚ СЂРµС‡СЊ СЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёРј РІС‹Р±РѕСЂРѕРј РјРѕРґРµР»Рё РїРѕ СЏР·С‹РєСѓ."""
        
        # РџСЂРµРґРѕР±СЂР°Р±РѕС‚РєР° С‚РµРєСЃС‚Р°
        processed_text = self.preprocess_text_for_tts(text)
        if not processed_text:
            logger.warning("РўРµРєСЃС‚ РїСѓСЃС‚РѕР№ РїРѕСЃР»Рµ РїСЂРµРґРѕР±СЂР°Р±РѕС‚РєРё")
            return None

        # РћРїСЂРµРґРµР»СЏРµРј СЏР·С‹Рє Рё РІС‹Р±РёСЂР°РµРј РјРѕРґРµР»СЊ (СЏР·С‹Рє СѓР¶Рµ РѕРїСЂРµРґРµР»РµРЅ РІ preprocess_text_for_tts)
        language = self.detect_language(processed_text)
        
        # РСЃРїРѕР»СЊР·СѓРµРј РЅР°СЃС‚СЂРѕР№РєРё РёР· РєРѕРЅС„РёРіСѓСЂР°С†РёРё
        if cfg_strength is None:
            cfg_strength = config.cfg_strength
        if target_rms is None:
            target_rms = config.target_rms
            
        # Р¤РёРєСЃРёСЂРѕРІР°РЅРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ РёР· РєРѕРЅС„РёРіСѓСЂР°С†РёРё
        cross_fade_duration = config.cross_fade_duration
        silence_duration_ms = config.silence_duration_ms
        sway_sampling_coef = config.sway_sampling_coef
        
        # РћРїСЂРµРґРµР»РµРЅРёРµ СЃРєРѕСЂРѕСЃС‚Рё РЅР° РѕСЃРЅРѕРІРµ РґР»РёРЅС‹ С‚РµРєСЃС‚Р° Рё РїСЂРµСЃРµС‚Р°
        if speed is None:
            length_without_spaces = len(processed_text.replace(" ", ""))
            
            # РџРѕР»СѓС‡Р°РµРј РЅР°СЃС‚СЂРѕР№РєРё РїСЂРµСЃРµС‚Р°
            if speed_preset in self.SPEED_PRESETS:
                preset_settings = self.SPEED_PRESETS[speed_preset]['settings']
                language_key = language if language in preset_settings else 'russian'
                speed_values = preset_settings[language_key]
                
                # РћРїСЂРµРґРµР»СЏРµРј СЃРєРѕСЂРѕСЃС‚СЊ РїРѕ РґР»РёРЅРµ С‚РµРєСЃС‚Р°
                if length_without_spaces <= 3:
                    speed = speed_values[0]
                elif length_without_spaces <= 8:
                    speed = speed_values[1]
                elif length_without_spaces <= 18:
                    speed = speed_values[2]
                elif length_without_spaces <= 35:
                    speed = speed_values[3]
                elif length_without_spaces <= 45:
                    speed = speed_values[4]
                else:
                    speed = speed_values[5]
                
                logger.info(f"РџСЂРёРјРµРЅРµРЅ РїСЂРµСЃРµС‚ СЃРєРѕСЂРѕСЃС‚Рё '{speed_preset}': {self.SPEED_PRESETS[speed_preset]['name']}")
                logger.info(f"РЎРєРѕСЂРѕСЃС‚СЊ РґР»СЏ {language} (РґР»РёРЅР°: {length_without_spaces}): {speed}")
            else:
                # Fallback РЅР° СЃС‚Р°СЂСѓСЋ Р»РѕРіРёРєСѓ, РµСЃР»Рё РїСЂРµСЃРµС‚ РЅРµ РЅР°Р№РґРµРЅ
                if language == "english":
                    if length_without_spaces <= 3:
                        speed = 0.1
                    elif length_without_spaces <= 8:
                        speed = 0.2
                    elif length_without_spaces <= 18:
                        speed = 0.3
                    elif length_without_spaces <= 35:
                        speed = 0.4
                    elif length_without_spaces <= 45:
                        speed = 0.5
                    else:
                        speed = 0.6
                else:
                    if length_without_spaces <= 3:
                        speed = 0.1
                    elif length_without_spaces <= 8:
                        speed = 0.3
                    elif length_without_spaces <= 18:
                        speed = 0.6
                    elif length_without_spaces <= 35:
                        speed = 0.8
                    elif length_without_spaces <= 45:
                        speed = 0.9
                    else:
                        speed = 1.0
                logger.info(f"РСЃРїРѕР»СЊР·РѕРІР°РЅР° СЃС‚Р°РЅРґР°СЂС‚РЅР°СЏ СЃРєРѕСЂРѕСЃС‚СЊ РґР»СЏ {language}: {speed} (РґР»РёРЅР°: {length_without_spaces})")
        
        # РЈР±РµР¶РґР°РµРјСЃСЏ, С‡С‚Рѕ СЃРєРѕСЂРѕСЃС‚СЊ РІ РїСЂР°РІРёР»СЊРЅРѕРј РґРёР°РїР°Р·РѕРЅРµ
        if speed is not None:
            speed = max(0.1, min(2.0, speed))
        
        # РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ NFE steps РЅР° РѕСЃРЅРѕРІРµ РґР»РёРЅС‹ РѕР±СЂР°Р±РѕС‚Р°РЅРЅРѕРіРѕ С‚РµРєСЃС‚Р°
        if nfe_step is None:
            length_without_spaces = len(processed_text.replace(" ", ""))
            if length_without_spaces > 120:
                nfe_step = 18
            else:
                nfe_step = 26
            logger.info(f"РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕРїСЂРµРґРµР»РµРЅ NFE steps: {nfe_step} (РґР»РёРЅР° РѕР±СЂР°Р±РѕС‚Р°РЅРЅРѕРіРѕ С‚РµРєСЃС‚Р°: {length_without_spaces})")
        
        # РСЃРїРѕР»СЊР·СѓРµРј РµРґРёРЅСѓСЋ РјРѕРґРµР»СЊ РґР»СЏ РІСЃРµС… СЏР·С‹РєРѕРІ
        tts_model = self.tts_model
        model_name = "F5-TTS (Russian/English)"
        
        if not tts_model:
            logger.error(f"РњРѕРґРµР»СЊ {model_name} РЅРµ Р·Р°РіСЂСѓР¶РµРЅР°")
            return None
        
        # Р”РРђР“РќРћРЎРўРРљРђ: РџСЂРѕРІРµСЂСЏРµРј СЃС‚Р°С‚СѓСЃ РјРѕРґРµР»Рё
        logger.info(f"Р”РРђР“РќРћРЎРўРРљРђ РјРѕРґРµР»Рё: {model_name} Р·Р°РіСЂСѓР¶РµРЅР°, device: {tts_model.device if hasattr(tts_model, 'device') else 'РЅРµРёР·РІРµСЃС‚РЅРѕ'}")
        if hasattr(tts_model, 'model') and hasattr(tts_model.model, 'training'):
            logger.info(f"Р”РРђР“РќРћРЎРўРРљРђ: РњРѕРґРµР»СЊ РІ СЂРµР¶РёРјРµ training: {tts_model.model.training}")

        # РСЃРїРѕР»СЊР·СѓРµРј РїРµСЂРµРґР°РЅРЅС‹Р№ ref_text
        ref_text_to_use = ref_text

        logger.info(f"РЎРёРЅС‚РµР·РёСЂСѓРµРј Р°СѓРґРёРѕ ({model_name}): '{processed_text}' РёСЃРїРѕР»СЊР·СѓСЏ РіРѕР»РѕСЃ '{ref_audio_path}'")

        try:
            # РЎРѕР·РґР°РµРј РІС‹С…РѕРґРЅСѓСЋ РґРёСЂРµРєС‚РѕСЂРёСЋ РґР»СЏ РІСЂРµРјРµРЅРЅС‹С… С„Р°Р№Р»РѕРІ
            output_dir = config.temp_audio_path
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # РЎРѕР·РґР°РµРј СѓРЅРёРєР°Р»СЊРЅРѕРµ РёРјСЏ С„Р°Р№Р»Р° СЃ РІСЂРµРјРµРЅРЅРѕР№ РјРµС‚РєРѕР№
            import time
            timestamp = int(time.time() * 1000)
            output_filename = f"{language}_{timestamp}.wav"
            output_path = output_dir / output_filename

            # РџР°СЂР°РјРµС‚СЂС‹ РґР»СЏ F5-TTS
            infer_params = {
                "ref_file": ref_audio_path,
                "ref_text": ref_text_to_use,
                "gen_text": processed_text,
                "cross_fade_duration": cross_fade_duration,
                "speed": speed,
                "target_rms": target_rms,
                "sway_sampling_coef": sway_sampling_coef,
                "cfg_strength": cfg_strength,
                "nfe_step": nfe_step,
                "remove_silence": remove_silence,
                "seed": int(time.time() * 1000) % 2**32  # Р”РѕР±Р°РІР»СЏРµРј seed РґР»СЏ СЂР°Р·РЅРѕРѕР±СЂР°Р·РёСЏ
            }
            
            # РЈР±РµР¶РґР°РµРјСЃСЏ, С‡С‚Рѕ СЃРєРѕСЂРѕСЃС‚СЊ РїРµСЂРµРґР°РµС‚СЃСЏ РєР°Рє float
            if speed is not None:
                infer_params["speed"] = float(speed)
            
            # Р”РѕР±Р°РІР»СЏРµРј РѕРїС†РёРѕРЅР°Р»СЊРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹
            if fix_duration is not None:
                infer_params["fix_duration"] = fix_duration
            if seed is not None:
                infer_params["seed"] = seed

            logger.info(f"[SETTINGS] Р¤РёРЅР°Р»СЊРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ СЃРёРЅС‚РµР·Р°:")
            logger.info(f"  - cross_fade={cross_fade_duration}, speed={speed}, silence={silence_duration_ms}ms")
            logger.info(f"  - target_rms={target_rms}, sway={sway_sampling_coef}, cfg={cfg_strength}, nfe={nfe_step}")

            # Р”РРђР“РќРћРЎРўРРљРђ: РџСЂРѕРІРµСЂСЏРµРј РїР°СЂР°РјРµС‚СЂС‹ РїРµСЂРµРґ СЃРёРЅС‚РµР·РѕРј
            logger.info(f"Р”РРђР“РќРћРЎРўРРљРђ F5-TTS РїР°СЂР°РјРµС‚СЂРѕРІ:")
            logger.info(f"  - Р РµС„РµСЂРµРЅСЃРЅС‹Р№ С„Р°Р№Р»: {ref_audio_path}")
            logger.info(f"  - Р РµС„РµСЂРµРЅСЃРЅС‹Р№ С‚РµРєСЃС‚: '{ref_text_to_use}'")
            logger.info(f"  - Р“РµРЅРµСЂРёСЂСѓРµРјС‹Р№ С‚РµРєСЃС‚: '{processed_text}'")
            logger.info(f"  - target_rms: {target_rms}")
            logger.info(f"  - cfg_strength: {cfg_strength}")
            logger.info(f"  - sway_sampling_coef: {sway_sampling_coef}")
            logger.info(f"  - speed: {speed} (С‚РёРї: {type(speed)})")
            logger.info(f"  - nfe_step: {nfe_step} (С‚РёРї: {type(nfe_step)})")

            # Р‘РµР·РѕРїР°СЃРЅС‹Р№ СЃРёРЅС‚РµР· СЃ РѕР±СЂР°Р±РѕС‚РєРѕР№ CUDA РѕС€РёР±РѕРє
            try:
                # РРЎРџР РђР’Р›Р•РќРР•: РЈР±РёСЂР°РµРј seed РїР°СЂР°РјРµС‚СЂ РєРѕС‚РѕСЂС‹Р№ РІС‹Р·С‹РІР°РµС‚ CUDA РѕС€РёР±РєРё
                infer_params_safe = infer_params.copy()
                if "seed" in infer_params_safe:
                    del infer_params_safe["seed"]
                    logger.info("РРЎРџР РђР’Р›Р•РќРР•: РЈР±СЂР°Р»Рё seed РїР°СЂР°РјРµС‚СЂ РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ CUDA РѕС€РёР±РѕРє")
                
                # РћС‡РёС‰Р°РµРј CUDA РєРµС€ РїРµСЂРµРґ СЃРёРЅС‚РµР·РѕРј
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                # РЎРёРЅС‚РµР·РёСЂСѓРµРј Р°СѓРґРёРѕ Р±РµР· seed
                wav, sr, spect = tts_model.infer(**infer_params_safe)
                
                # Р”РРђР“РќРћРЎРўРРљРђ: РџСЂРѕРІРµСЂСЏРµРј СЂРµР·СѓР»СЊС‚Р°С‚ СЃРёРЅС‚РµР·Р°
                duration_seconds = len(wav) / sr
                expected_duration = len(processed_text.split()) * 0.5  # РџСЂРёРјРµСЂРЅРѕ 0.5 СЃРµРє РЅР° СЃР»РѕРІРѕ
                if speed and speed != 1.0:
                    expected_duration = expected_duration / speed
                
                logger.info(f"Р”РРђР“РќРћРЎРўРРљРђ СЂРµР·СѓР»СЊС‚Р°С‚Р° СЃРёРЅС‚РµР·Р°:")
                logger.info(f"  - Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ Р°СѓРґРёРѕ: {duration_seconds:.2f} СЃРµРє")
                logger.info(f"  - РћР¶РёРґР°РµРјР°СЏ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ (speed={speed}): {expected_duration:.2f} СЃРµРє")
                logger.info(f"  - РЎРѕРѕС‚РЅРѕС€РµРЅРёРµ: {duration_seconds/expected_duration:.2f}x")
                
            except RuntimeError as cuda_error:
                if "CUDA error" in str(cuda_error):
                    logger.error(f"CUDA РѕС€РёР±РєР° РїСЂРё СЃРёРЅС‚РµР·Рµ: {cuda_error}")
                    # РџРѕРїС‹С‚РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                        torch.cuda.synchronize()
                    # РџРѕРІС‚РѕСЂРЅР°СЏ РїРѕРїС‹С‚РєР° СЃ РјРёРЅРёРјР°Р»СЊРЅС‹РјРё РїР°СЂР°РјРµС‚СЂР°РјРё
                    logger.info("РџРѕРїС‹С‚РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РїРѕСЃР»Рµ CUDA РѕС€РёР±РєРё...")
                    minimal_params = {
                        "ref_file": ref_audio_path,
                        "ref_text": ref_text_to_use,
                        "gen_text": processed_text,
                        "speed": 1.0,
                        "nfe_step": 16  # РЈРјРµРЅСЊС€Р°РµРј РґР»СЏ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚Рё
                    }
                    wav, sr, spect = tts_model.infer(**minimal_params)
                else:
                    raise
            
            # Р”РРђР“РќРћРЎРўРРљРђ: РџСЂРѕРІРµСЂСЏРµРј СЂРµР·СѓР»СЊС‚Р°С‚ СЃРёРЅС‚РµР·Р°
            wav_rms = np.sqrt(np.mean(wav**2)) if len(wav) > 0 else 0
            wav_max = np.max(np.abs(wav)) if len(wav) > 0 else 0
            logger.info(f"Р”РРђР“РќРћРЎРўРРљРђ СЂРµР·СѓР»СЊС‚Р°С‚Р° F5-TTS: RMS={wav_rms:.10f}, Max={wav_max:.10f}, Р”Р»РёРЅР°={len(wav)} СЃСЌРјРїР»РѕРІ")

            # РЈР»СѓС‡С€РµРЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ РѕР±СЂС‹РІРѕРІ РѕРєРѕРЅС‡Р°РЅРёР№
            
            # 1. Р”РѕР±Р°РІР»СЏРµРј Р±РѕР»СЊС€Рµ С‚РёС€РёРЅС‹ РІ РєРѕРЅРµС† (СѓРІРµР»РёС‡РёРІР°РµРј СЃ 200ms РґРѕ 800ms)
            extended_silence_ms = max(silence_duration_ms, 800)  # РњРёРЅРёРјСѓРј 800ms
            silence_samples = int(sr * (extended_silence_ms / 1000.0))
            silence = np.zeros(silence_samples, dtype=np.float32)
            wav_padded = np.concatenate([wav, silence])
            
            # 2. Р”РѕР±Р°РІР»СЏРµРј Р±РѕР»РµРµ РґР»РёРЅРЅС‹Р№ fade-out (СѓРІРµР»РёС‡РёРІР°РµРј СЃ 100ms РґРѕ 300ms)
            fade_samples = int(sr * 0.3)  # 300ms fade-out РґР»СЏ Р±РѕР»РµРµ РїР»Р°РІРЅРѕРіРѕ Р·Р°С‚СѓС…Р°РЅРёСЏ
            if len(wav_padded) > fade_samples:
                # РСЃРїРѕР»СЊР·СѓРµРј РєРѕСЃРёРЅСѓСЃРѕРёРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ РґР»СЏ Р±РѕР»РµРµ РµСЃС‚РµСЃС‚РІРµРЅРЅРѕРіРѕ Р·Р°С‚СѓС…Р°РЅРёСЏ
                fade = np.cos(np.linspace(0, np.pi/2, fade_samples))
                wav_padded[-fade_samples:] *= fade
            
            # 3. Р”РѕР±Р°РІР»СЏРµРј РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅСѓСЋ С‚РёС€РёРЅСѓ РїРѕСЃР»Рµ fade-out
            post_fade_silence = int(sr * 0.1)  # 100ms С‚РёС€РёРЅС‹ РїРѕСЃР»Рµ fade-out
            post_silence = np.zeros(post_fade_silence, dtype=np.float32)
            wav_padded = np.concatenate([wav_padded, post_silence])

            # РџСЂРѕРІРµСЂСЏРµРј РєР°С‡РµСЃС‚РІРѕ Р°СѓРґРёРѕ Р±РµР· СѓСЃРёР»РµРЅРёСЏ
            current_rms = np.sqrt(np.mean(wav_padded**2))
            logger.info(f"Р”РРђР“РќРћРЎРўРРљРђ: RMS: {current_rms:.10f}, Max Р°РјРїР»РёС‚СѓРґР°: {np.max(np.abs(wav_padded)):.10f}")
            
            if current_rms == 0:
                logger.error("РљР РРўРР§Р•РЎРљРђРЇ РћРЁРР‘РљРђ: РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРµ Р°СѓРґРёРѕ РїРѕР»РЅРѕСЃС‚СЊСЋ РїСѓСЃС‚РѕРµ (RMS=0)!")
            
            # РЎРѕС…СЂР°РЅСЏРµРј Р°СѓРґРёРѕ
            sf.write(str(output_path), wav_padded, sr)
            
            logger.info(f"РђСѓРґРёРѕ СЃРёРЅС‚РµР·РёСЂРѕРІР°РЅРѕ Рё СЃРѕС…СЂР°РЅРµРЅРѕ РІ {output_path} (РјРѕРґРµР»СЊ: {model_name})")
            return str(output_path.resolve())

        except Exception:
            logger.exception("РћС€РёР±РєР° РїСЂРё СЃРёРЅС‚РµР·Рµ")
            return None

    def apply_volume_to_audio(self, audio_path: str, volume_level: float) -> bool:
        """
        РџСЂРёРјРµРЅСЏРµС‚ РіСЂРѕРјРєРѕСЃС‚СЊ Рє СѓР¶Рµ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРјСѓ Р°СѓРґРёРѕ С„Р°Р№Р»Сѓ.
        
        Args:
            audio_path: РџСѓС‚СЊ Рє Р°СѓРґРёРѕ С„Р°Р№Р»Сѓ
            volume_level: РЈСЂРѕРІРµРЅСЊ РіСЂРѕРјРєРѕСЃС‚Рё (0.0 - 1.0, РіРґРµ 0.5 = 50%)
        
        Returns:
            bool: True РµСЃР»Рё СѓСЃРїРµС€РЅРѕ, False РµСЃР»Рё РѕС€РёР±РєР°
        """
        try:
            if not os.path.exists(audio_path):
                logger.error(f"Audio file not found: {audio_path}")
                return False
            
            # Р§РёС‚Р°РµРј Р°СѓРґРёРѕ С„Р°Р№Р»
            audio_data, sample_rate = sf.read(audio_path)
            
            # РџСЂРёРјРµРЅСЏРµРј РіСЂРѕРјРєРѕСЃС‚СЊ (СѓРјРЅРѕР¶Р°РµРј РЅР° РєРѕСЌС„С„РёС†РёРµРЅС‚)
            # volume_level РѕС‚ 0 РґРѕ 100, РїСЂРµРѕР±СЂР°Р·СѓРµРј РІ РєРѕСЌС„С„РёС†РёРµРЅС‚ РѕС‚ 0.0 РґРѕ 2.0
            volume_multiplier = volume_level / 50.0  # 50% = 1.0x, 100% = 2.0x
            audio_data_modified = audio_data * volume_multiplier
            
            # РџСЂРµРґРѕС‚РІСЂР°С‰Р°РµРј РєР»РёРїРїРёРЅРі (РѕРіСЂР°РЅРёС‡РёРІР°РµРј Р·РЅР°С‡РµРЅРёСЏ РѕС‚ -1.0 РґРѕ 1.0)
            audio_data_modified = np.clip(audio_data_modified, -1.0, 1.0)
            
            # РџРµСЂРµР·Р°РїРёСЃС‹РІР°РµРј С„Р°Р№Р» СЃ РЅРѕРІРѕР№ РіСЂРѕРјРєРѕСЃС‚СЊСЋ
            sf.write(audio_path, audio_data_modified, sample_rate)
            
            logger.info(f"Volume applied to audio: {audio_path}, level: {volume_level}%, multiplier: {volume_multiplier:.2f}x")
            return True
            
        except Exception:
            logger.exception("Error applying volume to audio {audio_path}")
            return False

    async def synthesize(self, text: str, voice_name: str, output_path: str, volume_level: float = 50.0, **kwargs) -> bool:
        """
        РЎРёРЅС‚РµР· СЂРµС‡Рё СЃ РїСЂРёРјРµРЅРµРЅРёРµРј РіСЂРѕРјРєРѕСЃС‚Рё Рє РІС‹С…РѕРґРЅРѕРјСѓ С„Р°Р№Р»Сѓ.
        Р­С‚РѕС‚ РјРµС‚РѕРґ СЃРѕРІРјРµСЃС‚РёРј СЃ tts_engine.py.
        
        Args:
            text: РўРµРєСЃС‚ РґР»СЏ СЃРёРЅС‚РµР·Р°
            voice_name: РРјСЏ РіРѕР»РѕСЃР°
            output_path: РџСѓС‚СЊ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ Р°СѓРґРёРѕ С„Р°Р№Р»Р°
            volume_level: РЈСЂРѕРІРµРЅСЊ РіСЂРѕРјРєРѕСЃС‚Рё (0-100)
            **kwargs: Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ РґР»СЏ synthesize_speech
        
        Returns:
            bool: True РµСЃР»Рё СЃРёРЅС‚РµР· СѓСЃРїРµС€РµРЅ, False РµСЃР»Рё РѕС€РёР±РєР°
        """
        try:
            # РџРѕР»СѓС‡Р°РµРј РїСѓС‚СЊ Рє СЂРµС„РµСЂРµРЅСЃРЅРѕРјСѓ Р°СѓРґРёРѕ РґР»СЏ РіРѕР»РѕСЃР°
            voice_audio_path = self._get_voice_audio_path(voice_name)
            if not voice_audio_path:
                logger.error(f"Voice audio not found for voice: {voice_name}")
                return False
            
            # Р›РѕРіРёСЂСѓРµРј РїР°СЂР°РјРµС‚СЂС‹ РґР»СЏ РґРёР°РіРЅРѕСЃС‚РёРєРё
            logger.info(f"[FIX] Synthesize called with kwargs: {kwargs}")
            
            # Р’С‹РїРѕР»РЅСЏРµРј СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ СЃРёРЅС‚РµР·
            result_path = self.synthesize_speech(
                text=text,
                ref_audio_path=voice_audio_path,
                ref_text=""
                **kwargs
            )
            
            if not result_path or not os.path.exists(result_path):
                logger.error(f"Synthesis failed or output file not created: {result_path}")
                return False
            
            # Р•СЃР»Рё СЂРµР·СѓР»СЊС‚Р°С‚ РЅРµ РІ РЅСѓР¶РЅРѕРј РјРµСЃС‚Рµ, РєРѕРїРёСЂСѓРµРј РµРіРѕ
            if result_path != output_path:
                import shutil
                shutil.copy2(result_path, output_path)
                # РЈРґР°Р»СЏРµРј РІСЂРµРјРµРЅРЅС‹Р№ С„Р°Р№Р»
                try:
                    os.remove(result_path)
                except OSError:
                    pass
            
            # РџСЂРёРјРµРЅСЏРµРј РіСЂРѕРјРєРѕСЃС‚СЊ Рє РІС‹С…РѕРґРЅРѕРјСѓ С„Р°Р№Р»Сѓ
            if volume_level != 50.0:  # 50% = СЃС‚Р°РЅРґР°СЂС‚РЅР°СЏ РіСЂРѕРјРєРѕСЃС‚СЊ, РЅРµ РЅСѓР¶РЅРѕ РёР·РјРµРЅСЏС‚СЊ
                volume_applied = self.apply_volume_to_audio(output_path, volume_level)
                if not volume_applied:
                    logger.warning(f"Failed to apply volume to {output_path}, but synthesis succeeded")
            
            return True
            
        except Exception:
            logger.exception("Error in synthesize method")
            return False

    def _get_voice_audio_path(self, voice_name: str) -> str:
        """
        РџРѕР»СѓС‡Р°РµС‚ РїСѓС‚СЊ Рє СЂРµС„РµСЂРµРЅСЃРЅРѕРјСѓ Р°СѓРґРёРѕ С„Р°Р№Р»Сѓ РґР»СЏ РіРѕР»РѕСЃР°.
        
        Args:
            voice_name: РРјСЏ РіРѕР»РѕСЃР°
            
        Returns:
            str: РџСѓС‚СЊ Рє Р°СѓРґРёРѕ С„Р°Р№Р»Сѓ РіРѕР»РѕСЃР° РёР»Рё None РµСЃР»Рё РЅРµ РЅР°Р№РґРµРЅ
        """
        try:
            # РРЅС‚РµРіСЂР°С†РёСЏ СЃ Р±Р°Р·РѕР№ РґР°РЅРЅС‹С… РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РїСѓС‚Рё Рє РіРѕР»РѕСЃСѓ
            from tts_service.database import get_db, Voice as VoiceModel
            
            db = next(get_db())
            try:
                voice = db.query(VoiceModel).filter(VoiceModel.name == voice_name).first()
                if voice and voice.file_path:
                    voice_path = Path(voice.file_path)
                    if voice_path.exists():
                        return str(voice_path)
                    else:
                        logger.warning(f"Voice file path exists in DB but file not found: {voice.file_path}")
                        
            finally:
                db.close()
                
            # Fallback: РїРѕРёСЃРє РІ СЃС‚Р°РЅРґР°СЂС‚РЅРѕР№ РґРёСЂРµРєС‚РѕСЂРёРё voices
            from tts_service.config import config
            voices_dir = config.voices_path
            voice_file = voices_dir / f"{voice_name}.wav"
            
            if voice_file.exists():
                return str(voice_file)
            
            # РџРѕРїСЂРѕР±СѓРµРј РЅР°Р№С‚Рё Р»СЋР±РѕР№ Р°СѓРґРёРѕ С„Р°Р№Р» СЃ РёРјРµРЅРµРј РіРѕР»РѕСЃР°
            for ext in ['.wav', '.mp3', '.flac']:
                voice_file = voices_dir / f"{voice_name}{ext}"
                if voice_file.exists():
                    return str(voice_file)
            
            logger.warning(f"Voice audio file not found for: {voice_name}")
            return None
            
        except Exception:
            logger.exception("Error getting voice audio path for {voice_name}")
            return None


if __name__ == "__main__":
    # РўРµСЃС‚РёСЂРѕРІР°РЅРёРµ
    tts = RussianTTS()
    
    if tts.russian_tts:
        logger.info("Russian TTS model loaded successfully")
    else:
        logger.error("Failed to load TTS models")


