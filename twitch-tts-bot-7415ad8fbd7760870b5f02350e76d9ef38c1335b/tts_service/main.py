# tts_service/main.py
"""Главный файл TTS Service"""
import os
import sys
import logging
import uvicorn
from pathlib import Path

# Добавляем tts_service в sys.path
TTS_SERVICE_ROOT = Path(__file__).parent
if str(TTS_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(TTS_SERVICE_ROOT))

from app_factory import create_app

# Настройка логирования
from logging_config import LoggingConfig

# Создаем конфигурацию логирования
logging_config = LoggingConfig("tts_service")
app_log_level = os.getenv("LOG_LEVEL", "INFO")
logger = logging_config.setup_logging(app_log_level)

def main():
    """Главная функция запуска TTS Service"""
    try:
        # Создаем приложение
        app = create_app()
        
        # Получаем настройки из переменных окружения
        host = os.getenv("TTS_HOST", "0.0.0.0")
        port = int(os.getenv("TTS_PORT", "8001"))
        # Uvicorn требует log_level в НИЖНЕМ регистре (info, debug, warning, error)
        uvicorn_log_level = os.getenv("TTS_LOG_LEVEL", "info").lower()
        
        logger.info(f"🚀 Starting TTS Service on {host}:{port}")
        
        # Запускаем сервер
        uvicorn.run(
            app,
            host=host,
            port=port,
            log_level=uvicorn_log_level,
            access_log=True,
            use_colors=False,
            log_config=None  # Отключаем стандартную конфигурацию логирования uvicorn
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to start TTS Service: {e}")
        raise

if __name__ == "__main__":
    import os
    main()