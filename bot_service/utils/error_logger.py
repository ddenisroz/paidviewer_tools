"""
Enhanced error logging with sensitive data redaction
"""
import logging
import re
from typing import Any, Dict, Optional

from core.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)


class SensitiveDataFilter(logging.Filter):
    """
    Фильтр для удаления чувствительных данных из логов
    """

    # Паттерны для поиска чувствительных данных
    SENSITIVE_PATTERNS = [
        # Токены и ключи
        (r'(token|access_token|refresh_token|api_key|secret|password|pwd)[\s:=]+["\']?([^"\'\s]+)["\']?', r'\1=***REDACTED***'),
        # Bearer токены
        (r'Bearer\s+([A-Za-z0-9\-._~+/]+=*)', r'Bearer ***REDACTED***'),
        # JWT токены
        (r'eyJ[A-Za-z0-9\-._~+/]+=*\.eyJ[A-Za-z0-9\-._~+/]+=*\.[A-Za-z0-9\-._~+/]+=*', r'***JWT_REDACTED***'),
        # Email адреса (частично)
        (r'([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', r'\1@***'),
        # Номера телефонов
        (r'\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}', r'***PHONE***'),
        # IP адреса (частично)
        (r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}', r'\1***'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        """Фильтрует чувствительные данные из сообщения лога"""
        if hasattr(record, 'msg'):
            record.msg = self.redact_sensitive_data(str(record.msg))

        # Фильтруем args если есть
        if hasattr(record, 'args') and record.args:
            if isinstance(record.args, dict):
                record.args = {k: self.redact_sensitive_data(str(v)) for k, v in record.args.items()}
            elif isinstance(record.args, (list, tuple)):
                record.args = tuple(self.redact_sensitive_data(str(arg)) for arg in record.args)

        return True

    def redact_sensitive_data(self, text: str) -> str:
        """Заменяет чувствительные данные на ***REDACTED***"""
        for pattern, replacement in self.SENSITIVE_PATTERNS:
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        return text


class StructuredErrorLogger:
    """
    Структурированное логирование ошибок с контекстом
    """

    def __init__(self, logger_name: str = "bot_service.errors"):
        self.logger = logging.getLogger(logger_name)

        # Добавляем фильтр для удаления чувствительных данных
        sensitive_filter = SensitiveDataFilter()
        self.logger.addFilter(sensitive_filter)

    def log_error(
        self,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[int] = None,
        endpoint: Optional[str] = None,
        severity: str = "ERROR",
    ):
        """
        Логирует ошибку с полным контекстом
        
        Args:
            error: Исключение
            context: Дополнительный контекст
            user_id: ID пользователя
            endpoint: Endpoint где произошла ошибка
            severity: Уровень серьезности (ERROR, CRITICAL, WARNING)
        """
        error_data = {
            "timestamp": utcnow_naive().isoformat(),
            "error_type": type(error).__name__,
            "error_message": str(error),
            "user_id": user_id,
            "endpoint": endpoint,
            "context": context or {},
        }

        # Логируем в зависимости от severity
        log_level = getattr(logging, severity.upper(), logging.ERROR)

        self.logger.log(
            log_level,
            f"Error occurred: {error_data['error_type']}",
            extra=error_data,
            exc_info=True,
        )

    def log_validation_error(
        self,
        errors: list,
        endpoint: str,
        user_id: Optional[int] = None,
    ):
        """
        Логирует ошибки валидации
        """
        error_data = {
            "timestamp": utcnow_naive().isoformat(),
            "error_type": "ValidationError",
            "endpoint": endpoint,
            "user_id": user_id,
            "validation_errors": errors,
        }

        self.logger.warning(
            f"Validation error in {endpoint}",
            extra=error_data,
        )

    def log_api_error(
        self,
        status_code: int,
        endpoint: str,
        method: str,
        error_message: str,
        user_id: Optional[int] = None,
        response_time: Optional[float] = None,
    ):
        """
        Логирует ошибки API
        """
        error_data = {
            "timestamp": utcnow_naive().isoformat(),
            "error_type": "APIError",
            "status_code": status_code,
            "endpoint": endpoint,
            "method": method,
            "error_message": error_message,
            "user_id": user_id,
            "response_time_ms": response_time,
        }

        # Определяем уровень логирования по статус коду
        if status_code >= 500:
            log_level = logging.ERROR
        elif status_code >= 400:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO

        self.logger.log(
            log_level,
            f"API {status_code} {method} {endpoint}",
            extra=error_data,
        )

    def log_database_error(
        self,
        error: Exception,
        operation: str,
        table: Optional[str] = None,
        user_id: Optional[int] = None,
    ):
        """
        Логирует ошибки базы данных
        """
        error_data = {
            "timestamp": utcnow_naive().isoformat(),
            "error_type": "DatabaseError",
            "operation": operation,
            "table": table,
            "error_message": str(error),
            "user_id": user_id,
        }

        self.logger.error(
            f"Database error during {operation}",
            extra=error_data,
            exc_info=True,
        )

    def log_external_api_error(
        self,
        service: str,
        endpoint: str,
        status_code: Optional[int],
        error_message: str,
        user_id: Optional[int] = None,
    ):
        """
        Логирует ошибки внешних API (Twitch, VK, etc.)
        """
        error_data = {
            "timestamp": utcnow_naive().isoformat(),
            "error_type": "ExternalAPIError",
            "service": service,
            "endpoint": endpoint,
            "status_code": status_code,
            "error_message": error_message,
            "user_id": user_id,
        }

        self.logger.error(
            f"External API error: {service} - {error_message}",
            extra=error_data,
        )


# Глобальный экземпляр
error_logger = StructuredErrorLogger()


def log_error_with_context(
    error: Exception,
    context: Optional[Dict[str, Any]] = None,
    **kwargs
):
    """
    Удобная функция для логирования ошибок с контекстом
    
    Usage:
        try:
            # some code
        except Exception as e:
            log_error_with_context(
                e,
                context={"operation": "update_stream"},
                user_id=user_id,
                endpoint="/api/stream/update"
            )
    """
    error_logger.log_error(error, context=context, **kwargs)


def redact_sensitive_data(data: Any) -> Any:
    """
    Удаляет чувствительные данные из любой структуры данных
    
    Args:
        data: Данные для очистки (dict, list, str, etc.)
    
    Returns:
        Очищенные данные
    """
    sensitive_filter = SensitiveDataFilter()

    if isinstance(data, dict):
        return {k: redact_sensitive_data(v) for k, v in data.items()}
    elif isinstance(data, (list, tuple)):
        return [redact_sensitive_data(item) for item in data]
    elif isinstance(data, str):
        return sensitive_filter.redact_sensitive_data(data)
    else:
        return data
