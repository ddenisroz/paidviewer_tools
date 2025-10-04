# bot_service/logging_config.py
import os
import logging
import logging.handlers
from pathlib import Path
from datetime import datetime
import sys

class LoggingConfig:
    """Централизованная конфигурация логирования"""
    
    def __init__(self, service_name: str = "bot_service"):
        self.service_name = service_name
        self.logs_dir = Path("logs")
        self.logs_dir.mkdir(exist_ok=True)
        
        # Создаем подпапки для разных типов логов
        self.app_logs_dir = self.logs_dir / "app"
        self.error_logs_dir = self.logs_dir / "errors"
        self.access_logs_dir = self.logs_dir / "access"
        self.audit_logs_dir = self.logs_dir / "audit"
        
        for dir_path in [self.app_logs_dir, self.error_logs_dir, self.access_logs_dir, self.audit_logs_dir]:
            dir_path.mkdir(exist_ok=True)
    
    def setup_logging(self, log_level: str = "INFO"):
        """Настройка логирования для сервиса"""
        
        # Получаем уровень логирования
        level = getattr(logging, log_level.upper(), logging.INFO)
        
        # Создаем форматтеры
        detailed_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        simple_formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Основной логгер приложения
        app_logger = logging.getLogger(self.service_name)
        app_logger.setLevel(level)
        
        # Очищаем существующие обработчики
        app_logger.handlers.clear()
        
        # 1. Ротация логов по дням (максимум 30 дней)
        daily_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.app_logs_dir / f"{self.service_name}.log",
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        daily_handler.setFormatter(detailed_formatter)
        daily_handler.setLevel(level)
        app_logger.addHandler(daily_handler)
        
        # 2. Отдельный файл для ошибок
        error_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.error_logs_dir / f"{self.service_name}_errors.log",
            when='midnight',
            interval=1,
            backupCount=90,  # Ошибки храним дольше
            encoding='utf-8'
        )
        error_handler.setFormatter(detailed_formatter)
        error_handler.setLevel(logging.ERROR)
        app_logger.addHandler(error_handler)
        
        # 3. Консольный вывод
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(simple_formatter)
        console_handler.setLevel(logging.INFO)
        app_logger.addHandler(console_handler)
        
        # 4. Логгер для аудита (критические действия)
        audit_logger = logging.getLogger(f"{self.service_name}.audit")
        audit_logger.setLevel(logging.INFO)
        
        audit_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.audit_logs_dir / f"{self.service_name}_audit.log",
            when='midnight',
            interval=1,
            backupCount=365,  # Аудит храним год
            encoding='utf-8'
        )
        audit_handler.setFormatter(detailed_formatter)
        audit_logger.addHandler(audit_handler)
        
        # 5. Логгер для доступа (HTTP запросы)
        access_logger = logging.getLogger(f"{self.service_name}.access")
        access_logger.setLevel(logging.INFO)
        
        access_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.access_logs_dir / f"{self.service_name}_access.log",
            when='midnight',
            interval=1,
            backupCount=7,  # Доступ храним неделю
            encoding='utf-8'
        )
        access_handler.setFormatter(simple_formatter)
        access_logger.addHandler(access_handler)
        
        # Настройка внешних библиотек
        logging.getLogger("uvicorn").setLevel(logging.WARNING)
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("fastapi").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("httpx").setLevel(logging.WARNING)
        
        return app_logger
    
    def get_audit_logger(self):
        """Получить логгер для аудита"""
        return logging.getLogger(f"{self.service_name}.audit")
    
    def get_access_logger(self):
        """Получить логгер для доступа"""
        return logging.getLogger(f"{self.service_name}.access")

# Глобальные экземпляры
bot_logging_config = LoggingConfig("bot_service")
tts_logging_config = LoggingConfig("tts_service")
