"""
Конфигурация логирования для TTS_TTV системы
"""
import logging
import logging.handlers
import os
from datetime import datetime
from pathlib import Path

def setup_logging(service_name: str, log_level: str = "INFO") -> logging.Logger:
    """
    Настройка логирования для сервиса
    
    Args:
        service_name: Имя сервиса (bot_service, tts_service, frontend)
        log_level: Уровень логирования (DEBUG, INFO, WARNING, ERROR)
    
    Returns:
        Настроенный логгер
    """
    # Создаем папку для логов
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Создаем логгер
    logger = logging.getLogger(service_name)
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Очищаем существующие обработчики
    logger.handlers.clear()
    
    # Создаем форматтер
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Обработчик для файла (с ротацией)
    log_file = logs_dir / f"{service_name}.log"
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(getattr(logging, log_level.upper()))
    file_handler.setFormatter(formatter)
    
    # Обработчик для консоли
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    
    # Добавляем обработчики
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    # Предотвращаем дублирование логов
    logger.propagate = False
    
    return logger

def get_logger(service_name: str) -> logging.Logger:
    """
    Получить логгер для сервиса
    
    Args:
        service_name: Имя сервиса
    
    Returns:
        Логгер
    """
    return logging.getLogger(service_name)

def log_system_info(logger: logging.Logger):
    """
    Логирование системной информации
    
    Args:
        logger: Логгер для записи
    """
    import platform
    import sys
    
    logger.info("=" * 50)
    logger.info(f"СИСТЕМА ЗАПУЩЕНА - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 50)
    logger.info(f"Python версия: {sys.version}")
    logger.info(f"Платформа: {platform.platform()}")
    logger.info(f"Архитектура: {platform.architecture()}")
    logger.info(f"Процессор: {platform.processor()}")
    logger.info(f"Рабочая директория: {os.getcwd()}")
    logger.info("=" * 50)

def log_service_start(logger: logging.Logger, service_name: str, port: int = None):
    """
    Логирование запуска сервиса
    
    Args:
        logger: Логгер для записи
        service_name: Имя сервиса
        port: Порт сервиса (опционально)
    """
    logger.info(f"🚀 {service_name.upper()} ЗАПУЩЕН")
    if port:
        logger.info(f"🌐 Порт: {port}")
    logger.info(f"📁 Логи: logs/{service_name}.log")
    logger.info(f"⏰ Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

def log_service_stop(logger: logging.Logger, service_name: str):
    """
    Логирование остановки сервиса
    
    Args:
        logger: Логгер для записи
        service_name: Имя сервиса
    """
    logger.info(f"🛑 {service_name.upper()} ОСТАНОВЛЕН")
    logger.info(f"⏰ Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

def log_error(logger: logging.Logger, error: Exception, context: str = ""):
    """
    Логирование ошибки с контекстом
    
    Args:
        logger: Логгер для записи
        error: Исключение
        context: Контекст ошибки
    """
    logger.error(f"❌ ОШИБКА {context}: {type(error).__name__}: {str(error)}")
    logger.error(f"📍 Контекст: {context}")
    logger.error(f"⏰ Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

def log_api_call(logger: logging.Logger, method: str, endpoint: str, status_code: int = None, user: str = None):
    """
    Логирование API вызовов
    
    Args:
        logger: Логгер для записи
        method: HTTP метод
        endpoint: Эндпоинт
        status_code: Код ответа
        user: Пользователь (опционально)
    """
    user_info = f" | Пользователь: {user}" if user else ""
    status_info = f" | Статус: {status_code}" if status_code else ""
    logger.info(f"🌐 API: {method} {endpoint}{user_info}{status_info}")

def log_websocket_event(logger: logging.Logger, event: str, user: str = None, channel: str = None):
    """
    Логирование WebSocket событий
    
    Args:
        logger: Логгер для записи
        event: Событие
        user: Пользователь
        channel: Канал
    """
    user_info = f" | Пользователь: {user}" if user else ""
    channel_info = f" | Канал: {channel}" if channel else ""
    logger.info(f"🔌 WebSocket: {event}{user_info}{channel_info}")

def log_tts_event(logger: logging.Logger, event: str, voice_name: str = None, text: str = None, user: str = None):
    """
    Логирование TTS событий
    
    Args:
        logger: Логгер для записи
        event: Событие
        voice_name: Имя голоса
        text: Текст для озвучки
        user: Пользователь
    """
    voice_info = f" | Голос: {voice_name}" if voice_name else ""
    text_info = f" | Текст: {text[:50]}..." if text and len(text) > 50 else f" | Текст: {text}" if text else ""
    user_info = f" | Пользователь: {user}" if user else ""
    logger.info(f"🎤 TTS: {event}{voice_info}{text_info}{user_info}")

def log_bot_event(logger: logging.Logger, event: str, channel: str = None, user: str = None, message: str = None):
    """
    Логирование событий бота
    
    Args:
        logger: Логгер для записи
        event: Событие
        channel: Канал
        user: Пользователь
        message: Сообщение
    """
    channel_info = f" | Канал: {channel}" if channel else ""
    user_info = f" | Пользователь: {user}" if user else ""
    message_info = f" | Сообщение: {message[:100]}..." if message and len(message) > 100 else f" | Сообщение: {message}" if message else ""
    logger.info(f"🤖 BOT: {event}{channel_info}{user_info}{message_info}")

# Глобальные логгеры для быстрого доступа
bot_logger = None
tts_logger = None

def init_global_loggers():
    """Инициализация глобальных логгеров"""
    global bot_logger, tts_logger
    
    bot_logger = setup_logging("bot_service", "INFO")
    tts_logger = setup_logging("tts_service", "INFO")
    
    return bot_logger, tts_logger

def get_bot_logger():
    """Получить логгер бота"""
    global bot_logger
    if bot_logger is None:
        bot_logger = setup_logging("bot_service", "INFO")
    return bot_logger

def get_tts_logger():
    """Получить логгер TTS"""
    global tts_logger
    if tts_logger is None:
        tts_logger = setup_logging("tts_service", "INFO")
    return tts_logger
