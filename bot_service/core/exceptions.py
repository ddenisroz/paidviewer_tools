# core/exceptions.py
"""
Кастомные исключения для бизнес-логики.

Принципы:
- Каждое исключение объясняет ЧТО сломалось
- Содержит контекст (ids, параметры)
- Наследуется от базового AppException
"""
from typing import Any, Optional


class AppException(Exception):
    """Базовое исключение приложения."""
    
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    
    def __init__(
        self, 
        message: str, 
        details: Optional[dict[str, Any]] = None,
        cause: Optional[Exception] = None
    ):
        self.message = message
        self.details = details or {}
        self.cause = cause
        super().__init__(message)
    
    def to_dict(self) -> dict[str, Any]:
        """Сериализация для JSON ответа."""
        result = {
            "error_code": self.error_code,
            "message": self.message,
        }
        if self.details:
            result["details"] = self.details
        return result


# === Authentication & Authorization ===

class AuthenticationError(AppException):
    """Ошибка аутентификации."""
    status_code = 401
    error_code = "AUTHENTICATION_ERROR"


class AuthorizationError(AppException):
    """Ошибка авторизации (недостаточно прав)."""
    status_code = 403
    error_code = "AUTHORIZATION_ERROR"


class TokenExpiredError(AuthenticationError):
    """Токен истёк."""
    error_code = "TOKEN_EXPIRED"


class InvalidTokenError(AuthenticationError):
    """Невалидный токен."""
    error_code = "INVALID_TOKEN"


class SessionExpiredError(AuthenticationError):
    """Сессия истекла."""
    error_code = "SESSION_EXPIRED"


# === Resource Errors ===

class NotFoundError(AppException):
    """Ресурс не найден."""
    status_code = 404
    error_code = "NOT_FOUND"
    
    def __init__(self, resource: str, identifier: Any, **kwargs):
        message = f"{resource} не найден: {identifier}"
        super().__init__(message, details={"resource": resource, "id": identifier}, **kwargs)


class AlreadyExistsError(AppException):
    """Ресурс уже существует."""
    status_code = 409
    error_code = "ALREADY_EXISTS"
    
    def __init__(self, resource: str, identifier: Any, **kwargs):
        message = f"{resource} уже существует: {identifier}"
        super().__init__(message, details={"resource": resource, "id": identifier}, **kwargs)


# === Validation Errors ===

class ValidationError(AppException):
    """Ошибка валидации данных."""
    status_code = 422
    error_code = "VALIDATION_ERROR"


class InvalidInputError(ValidationError):
    """Невалидные входные данные."""
    error_code = "INVALID_INPUT"
    
    def __init__(self, field: str, reason: str, **kwargs):
        message = f"Невалидное значение поля '{field}': {reason}"
        super().__init__(message, details={"field": field, "reason": reason}, **kwargs)


# === Platform Errors ===

class PlatformError(AppException):
    """Ошибка платформы (Twitch, VK)."""
    status_code = 502
    error_code = "PLATFORM_ERROR"
    
    def __init__(self, platform: str, message: str, **kwargs):
        super().__init__(f"[{platform.upper()}] {message}", details={"platform": platform}, **kwargs)


class PlatformConnectionError(PlatformError):
    """Ошибка подключения к платформе."""
    error_code = "PLATFORM_CONNECTION_ERROR"


class PlatformAPIError(PlatformError):
    """Ошибка API платформы."""
    error_code = "PLATFORM_API_ERROR"


# === Bot Errors ===

class BotError(AppException):
    """Ошибка бота."""
    status_code = 500
    error_code = "BOT_ERROR"


class BotNotConnectedError(BotError):
    """Бот не подключен."""
    status_code = 503
    error_code = "BOT_NOT_CONNECTED"
    
    def __init__(self, platform: str, **kwargs):
        message = f"Бот {platform} не подключен"
        super().__init__(message, details={"platform": platform}, **kwargs)


class BotAlreadyConnectedError(BotError):
    """Бот уже подключен."""
    status_code = 409
    error_code = "BOT_ALREADY_CONNECTED"


# === TTS Errors ===

class TTSError(AppException):
    """Ошибка TTS."""
    status_code = 500
    error_code = "TTS_ERROR"


class TTSServiceUnavailableError(TTSError):
    """TTS сервис недоступен."""
    status_code = 503
    error_code = "TTS_SERVICE_UNAVAILABLE"


class TTSVoiceNotFoundError(TTSError):
    """Голос не найден."""
    status_code = 404
    error_code = "TTS_VOICE_NOT_FOUND"


# === Database Errors ===

class DatabaseError(AppException):
    """Ошибка базы данных."""
    status_code = 500
    error_code = "DATABASE_ERROR"


class DatabaseConnectionError(DatabaseError):
    """Ошибка подключения к БД."""
    error_code = "DATABASE_CONNECTION_ERROR"


# === Rate Limiting ===

class RateLimitError(AppException):
    """Превышен лимит запросов."""
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"
    
    def __init__(self, retry_after: Optional[int] = None, **kwargs):
        message = "Превышен лимит запросов"
        details = {}
        if retry_after:
            details["retry_after"] = retry_after
            message += f", повторите через {retry_after} сек"
        super().__init__(message, details=details, **kwargs)


# === External Service Errors ===

class ExternalServiceError(AppException):
    """Ошибка внешнего сервиса."""
    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"
    
    def __init__(self, service: str, message: str, **kwargs):
        super().__init__(f"[{service}] {message}", details={"service": service}, **kwargs)
