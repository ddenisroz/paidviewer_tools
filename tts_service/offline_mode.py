"""
Offline mode для TTS сервиса
Обходит проблемы с сетью и прокси
"""

import os
import sys
from pathlib import Path

def setup_offline_mode():
    """Настраивает офлайн режим для HuggingFace"""
    
    # Отключаем все сетевые запросы
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['HF_DATASETS_OFFLINE'] = '1'
    
    # Отключаем телеметрию
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
    
    # Устанавливаем локальный кеш
    cache_dir = Path("f5_tts_cache").absolute()
    os.environ['HF_HOME'] = str(cache_dir)
    os.environ['HUGGINGFACE_HUB_CACHE'] = str(cache_dir)
    os.environ['TRANSFORMERS_CACHE'] = str(cache_dir)
    
    print(f"Offline mode enabled. Cache directory: {cache_dir}")
    
    # Проверяем наличие моделей
    vocos_path = cache_dir / "models--charactr--vocos-mel-24khz"
    f5tts_path = cache_dir / "models--Misha24-10--F5-TTS_RUSSIAN"
    
    if vocos_path.exists() and f5tts_path.exists():
        print("✅ Все модели найдены в кеше")
        return True
    else:
        print("❌ Не все модели найдены в кеше")
        return False

if __name__ == "__main__":
    setup_offline_mode()
