# bot_service/features/tts/__init__.py
"""
TTS (Text-to-Speech) Feature Module

This module contains all TTS-related functionality:
- TTS service implementations (Google TTS, F5-TTS)
- TTS API endpoints
- TTS queue management
- Voice management
"""

from features.tts.basic_tts import BasicTTS, get_basic_tts
from features.tts.tts_manager import TTSManager, get_tts_manager
from features.tts.tts_service import TTSService
from features.tts.memory_tts_queue import MemoryTTSQueue, memory_tts_queue
from features.tts.tts_api import tts_router, voices_router, user_voices_router, local_tts_router

__all__ = [
    'BasicTTS',
    'get_basic_tts',
    'TTSManager',
    'get_tts_manager',
    'TTSService',
    'MemoryTTSQueue',
    'memory_tts_queue',
    'tts_router',
    'voices_router',
    'user_voices_router',
    'local_tts_router',
]
