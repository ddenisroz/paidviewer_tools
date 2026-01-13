# bot_service/logging_config_quiet.py
import logging
import logging.handlers
from pathlib import Path
import sys

class QuietLoggingConfig:
    """
    Тихая конфигурация логирования для production.

    DEPRECATED: Use core/structured_logging.py instead.
    """

    def __init__(self, service_name: str = "bot_service"):
        import warnings
        warnings.warn("logging_config is deprecated, use core.structured_logging", DeprecationWarning, stacklevel=2)
        
        self.service_name = service_name
        self.logs_dir = Path("logs")
        self.logs_dir.mkdir(exist_ok=True)

        # Создаем подпапки для разных типов логов
        self.app_logs_dir = self.logs_dir / "app"
        self.error_logs_dir = self.logs_dir / "errors"
        self.access_logs_dir = self.logs_dir / "access"
        self.audit_logs_dir = self.logs_dir / "audit"
        self.monitoring_logs_dir = self.logs_dir / "monitoring"

        for dir_path in [self.app_logs_dir, self.error_logs_dir, self.access_logs_dir,
                        self.audit_logs_dir, self.monitoring_logs_dir]:
            dir_path.mkdir(exist_ok=True)

    def setup_logging(self, log_level: str = "DEBUG"):
        """Настройка логирования для сервиса"""

        # Получаем уровень логирования
        level = getattr(logging, log_level.upper(), logging.DEBUG)

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

        # 1. Ротация логов по дням (INFO и выше)
        daily_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.app_logs_dir / f"{self.service_name}.log",
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        daily_handler.setFormatter(detailed_formatter)
        daily_handler.setLevel(logging.INFO)  # Записываем INFO и выше в файлы
        app_logger.addHandler(daily_handler)

        # 2. Отдельный файл для ошибок
        error_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.error_logs_dir / f"{self.service_name}_errors.log",
            when='midnight',
            interval=1,
            backupCount=90,
            encoding='utf-8'
        )
        error_handler.setFormatter(detailed_formatter)
        error_handler.setLevel(logging.ERROR)
        app_logger.addHandler(error_handler)

        # 3. Консольный вывод для DEBUG и выше
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(simple_formatter)
        console_handler.setLevel(logging.INFO)
        # Устанавливаем кодировку UTF-8 для консоли
        if hasattr(console_handler.stream, 'reconfigure'):
            console_handler.stream.reconfigure(encoding='utf-8')
        app_logger.addHandler(console_handler)

        # 4. Логгер для аудита (критические действия)
        audit_logger = logging.getLogger(f"{self.service_name}.audit")
        audit_logger.setLevel(logging.INFO)

        audit_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.audit_logs_dir / f"{self.service_name}_audit.log",
            when='midnight',
            interval=1,
            backupCount=365,
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
            backupCount=7,
            encoding='utf-8'
        )
        access_handler.setFormatter(simple_formatter)
        access_logger.addHandler(access_handler)

        # 6. Логгер для мониторинга (только WARNING и выше)
        monitoring_logger = logging.getLogger(f"{self.service_name}.monitoring")
        monitoring_logger.setLevel(logging.WARNING)

        monitoring_handler = logging.handlers.TimedRotatingFileHandler(
            filename=self.monitoring_logs_dir / f"{self.service_name}_monitoring.log",
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        monitoring_handler.setFormatter(simple_formatter)
        monitoring_logger.addHandler(monitoring_handler)

        # Настройка внешних библиотек
        logging.getLogger("uvicorn").setLevel(logging.WARNING)
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("fastapi").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("httpx").setLevel(logging.WARNING)

        # Отключаем шумные библиотеки
        logging.getLogger("watchfiles").setLevel(logging.CRITICAL)
        logging.getLogger("watchfiles.main").setLevel(logging.CRITICAL)

        # Настройка специфичных логгеров
        self._setup_specific_loggers()

        return app_logger

    def _setup_specific_loggers(self):
        """Настройка специфичных логгеров для разных компонентов"""

        # Twitch API - только INFO и выше
        twitch_logger = logging.getLogger('services.twitch_legacy_service')
        twitch_logger.setLevel(logging.INFO)

        # Bot service - INFO и выше
        bot_logger = logging.getLogger('bot_service')
        bot_logger.setLevel(logging.INFO)

        # Monitoring - только WARNING и выше
        monitoring_logger = logging.getLogger('bot_service.monitoring')
        monitoring_logger.setLevel(logging.WARNING)

        # Watchfiles - отключаем полностью
        watchfiles_logger = logging.getLogger('watchfiles')
        watchfiles_logger.setLevel(logging.CRITICAL)

        # Uvicorn - только WARNING и выше
        uvicorn_logger = logging.getLogger('uvicorn')
        uvicorn_logger.setLevel(logging.WARNING)

        # FastAPI - только WARNING и выше
        fastapi_logger = logging.getLogger('fastapi')
        fastapi_logger.setLevel(logging.WARNING)

    def get_audit_logger(self):
        """Получить логгер для аудита"""
        return logging.getLogger(f"{self.service_name}.audit")

    def get_access_logger(self):
        """Получить логгер для доступа"""
        return logging.getLogger(f"{self.service_name}.access")

    def get_monitoring_logger(self):
        """Получить логгер для мониторинга"""
        return logging.getLogger(f"{self.service_name}.monitoring")

# Глобальные экземпляры
bot_logging_config = QuietLoggingConfig("bot_service")
tts_logging_config = QuietLoggingConfig("tts_service")

# Функции для удобного логирования
def log_important(message, level=logging.INFO):
    """Логирует только важные события"""
    logger = logging.getLogger('bot_service')
    logger.log(level, f"[IMPORTANT] {message}")

def log_error(message, exception=None):
    """Логирует ошибки с дополнительной информацией"""
    logger = logging.getLogger('bot_service')
    if exception:
        logger.error(f"[ERROR] {message}: {str(exception)}", exc_info=True)
    else:
        logger.error(f"[ERROR] {message}")

def log_success(message):
    """Логирует успешные операции"""
    logger = logging.getLogger('bot_service')
    logger.info(f"[SUCCESS] {message}")

def log_warning(message):
    """Логирует предупреждения"""
    logger = logging.getLogger('bot_service')
    logger.warning(f"[WARNING] {message}")

def enable_debug_mode():
    """Временно включает DEBUG режим для отладки"""
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)

    # Обновляем консольный обработчик
    for handler in logger.handlers:
        if isinstance(handler, logging.StreamHandler):
            handler.setLevel(logging.DEBUG)
            break

def enable_quiet_mode():
    """Включает тихий режим (только WARNING и выше)"""
    logger = logging.getLogger()
    logger.setLevel(logging.WARNING)

    # Обновляем консольный обработчик
    for handler in logger.handlers:
        if isinstance(handler, logging.StreamHandler):
            handler.setLevel(logging.WARNING)
            break
