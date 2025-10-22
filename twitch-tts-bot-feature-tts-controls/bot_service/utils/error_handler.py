"""
Унифицированная обработка ошибок для bot_service
"""
import logging
from typing import Optional, Dict, Any, Union
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from constants import ErrorMessages, HTTP_STATUS, Platform
import traceback

logger = logging.getLogger(__name__)

class ServiceError(Exception):
    """Базовое исключение для ошибок сервиса"""
    def __init__(self, message: str, code: str = "UNKNOWN_ERROR", details: Optional[Dict] = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)

class AuthError(ServiceError):
    """Ошибки авторизации"""
    pass

class BotError(ServiceError):
    """Ошибки ботов"""
    pass

class TTSError(ServiceError):
    """Ошибки TTS"""
    pass

class ValidationError(ServiceError):
    """Ошибки валидации"""
    pass

class ConfigurationError(ServiceError):
    """Ошибки конфигурации"""
    pass

class ErrorHandler:
    """Централизованный обработчик ошибок"""
    
    @staticmethod
    def handle_oauth_error(error: str, error_description: str = None, platform: str = None) -> HTTPException:
        """
        Обработка ошибок OAuth
        
        Args:
            error: Код ошибки от OAuth провайдера
            error_description: Описание ошибки
            platform: Платформа (twitch, vk, etc.)
            
        Returns:
            HTTPException с соответствующим статусом и сообщением
        """
        platform_name = platform.title() if platform else "OAuth"
        
        if error_description:
            message = f"{platform_name} authorization failed: {error} - {error_description}"
        else:
            message = f"{platform_name} authorization failed: {error}"
            
        logger.error(f"OAuth error for {platform}: {error} - {error_description}")
        
        return HTTPException(
            status_code=HTTP_STATUS.BAD_REQUEST,
            detail=message
        )
    
    @staticmethod
    def handle_missing_code_error(platform: str = None) -> HTTPException:
        """
        Обработка ошибки отсутствия authorization code
        
        Args:
            platform: Платформа
            
        Returns:
            HTTPException
        """
        platform_name = platform.title() if platform else "OAuth provider"
        message = f"No authorization code received from {platform_name}. Please try again."
        
        logger.error(f"Missing authorization code for {platform}")
        
        return HTTPException(
            status_code=HTTP_STATUS.BAD_REQUEST,
            detail=message
        )
    
    @staticmethod
    def handle_configuration_error(missing_vars: list, platform: str = None) -> HTTPException:
        """
        Обработка ошибок конфигурации
        
        Args:
            missing_vars: Список отсутствующих переменных
            platform: Платформа
            
        Returns:
            HTTPException
        """
        platform_name = platform.title() if platform else "Service"
        message = f"{platform_name} integration is not configured."
        
        # Логируем подробности для отладки
        vars_status = {var: '✓' if var not in missing_vars else '✗' for var in missing_vars}
        logger.error(f"{platform_name} credentials not configured. Variables: {vars_status}")
        
        return HTTPException(
            status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR,
            detail=message
        )
    
    @staticmethod
    def handle_api_error(operation: str, platform: str = None, details: str = None) -> HTTPException:
        """
        Обработка ошибок API
        
        Args:
            operation: Операция которая вызвала ошибку
            platform: Платформа
            details: Дополнительные детали
            
        Returns:
            HTTPException
        """
        platform_name = platform.title() if platform else "API"
        message = f"Failed to {operation}"
        
        if platform:
            message += f" from {platform_name}"
            
        if details:
            logger.error(f"API error: {message}. Details: {details}")
        else:
            logger.error(f"API error: {message}")
        
        return HTTPException(
            status_code=HTTP_STATUS.BAD_REQUEST,
            detail=f"{message}."
        )
    
    @staticmethod
    def handle_bot_error(operation: str, channel: str = None, platform: str = None) -> HTTPException:
        """
        Обработка ошибок ботов
        
        Args:
            operation: Операция (connect, disconnect, etc.)
            channel: Канал
            platform: Платформа
            
        Returns:
            HTTPException
        """
        message = f"Failed to {operation} bot"
        
        if channel:
            message += f" to channel {channel}"
            
        if platform:
            message += f" on {platform.title()}"
        
        logger.error(f"Bot error: {message}")
        
        return HTTPException(
            status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR,
            detail=message
        )
    
    @staticmethod
    def handle_validation_error(field: str, value: Any = None, rule: str = None) -> HTTPException:
        """
        Обработка ошибок валидации
        
        Args:
            field: Поле которое не прошло валидацию
            value: Значение поля
            rule: Правило валидации
            
        Returns:
            HTTPException
        """
        message = f"Validation failed for field '{field}'"
        
        if rule:
            message += f": {rule}"
            
        if value:
            logger.error(f"Validation error: {message}. Value: {value}")
        else:
            logger.error(f"Validation error: {message}")
        
        return HTTPException(
            status_code=HTTP_STATUS.BAD_REQUEST,
            detail=message
        )
    
    @staticmethod
    def handle_database_error(operation: str, details: str = None) -> HTTPException:
        """
        Обработка ошибок базы данных
        
        Args:
            operation: Операция БД
            details: Дополнительные детали
            
        Returns:
            HTTPException
        """
        message = f"Database error during {operation}"
        
        if details:
            logger.error(f"{message}: {details}")
        else:
            logger.error(message)
        
        return HTTPException(
            status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR,
            detail=ErrorMessages.INTERNAL_ERROR
        )
    
    @staticmethod
    def handle_unauthorized_error(reason: str = None) -> HTTPException:
        """
        Обработка ошибок авторизации
        
        Args:
            reason: Причина отказа в доступе
            
        Returns:
            HTTPException
        """
        message = "Unauthorized access"
        
        if reason:
            message += f": {reason}"
            logger.warning(f"Unauthorized access attempt: {reason}")
        else:
            logger.warning("Unauthorized access attempt")
        
        return HTTPException(
            status_code=HTTP_STATUS.UNAUTHORIZED,
            detail=message
        )
    
    @staticmethod
    def handle_not_found_error(resource: str, identifier: str = None) -> HTTPException:
        """
        Обработка ошибок "не найдено"
        
        Args:
            resource: Тип ресурса
            identifier: Идентификатор ресурса
            
        Returns:
            HTTPException
        """
        message = f"{resource.title()} not found"
        
        if identifier:
            message += f": {identifier}"
            logger.warning(f"{resource} not found: {identifier}")
        else:
            logger.warning(f"{resource} not found")
        
        return HTTPException(
            status_code=HTTP_STATUS.NOT_FOUND,
            detail=message
        )
    
    @staticmethod
    def handle_generic_error(
        error: Exception, 
        operation: str = None, 
        context: Dict[str, Any] = None
    ) -> HTTPException:
        """
        Обработка общих ошибок
        
        Args:
            error: Исключение
            operation: Операция которая вызвала ошибку
            context: Контекст ошибки
            
        Returns:
            HTTPException
        """
        error_msg = str(error)
        operation_msg = f" during {operation}" if operation else ""
        
        # Логируем полную информацию об ошибке
        logger.error(
            f"Unexpected error{operation_msg}: {error_msg}",
            extra={
                "error_type": type(error).__name__,
                "context": context or {},
                "traceback": traceback.format_exc()
            }
        )
        
        # Возвращаем общее сообщение пользователю
        return HTTPException(
            status_code=HTTP_STATUS.INTERNAL_SERVER_ERROR,
            detail=ErrorMessages.INTERNAL_ERROR
        )
    
    @staticmethod
    def create_error_response(
        error: Union[HTTPException, Exception], 
        request: Optional[Request] = None
    ) -> JSONResponse:
        """
        Создание стандартного ответа об ошибке
        
        Args:
            error: Ошибка
            request: FastAPI Request (опционально)
            
        Returns:
            JSONResponse с информацией об ошибке
        """
        if isinstance(error, HTTPException):
            status_code = error.status_code
            detail = error.detail
        else:
            status_code = HTTP_STATUS.INTERNAL_SERVER_ERROR
            detail = ErrorMessages.INTERNAL_ERROR
            
        response_data = {
            "error": True,
            "message": detail,
            "status_code": status_code
        }
        
        # Добавляем дополнительную информацию в режиме разработки
        if hasattr(error, 'details'):
            response_data["details"] = error.details
            
        return JSONResponse(
            status_code=status_code,
            content=response_data
        )

# Утилитарные функции для быстрого использования
def oauth_error(error: str, error_description: str = None, platform: str = None) -> HTTPException:
    """Быстрое создание OAuth ошибки"""
    return ErrorHandler.handle_oauth_error(error, error_description, platform)

def missing_code_error(platform: str = None) -> HTTPException:
    """Быстрое создание ошибки отсутствия кода"""
    return ErrorHandler.handle_missing_code_error(platform)

def config_error(missing_vars: list, platform: str = None) -> HTTPException:
    """Быстрое создание ошибки конфигурации"""
    return ErrorHandler.handle_configuration_error(missing_vars, platform)

def api_error(operation: str, platform: str = None, details: str = None) -> HTTPException:
    """Быстрое создание API ошибки"""
    return ErrorHandler.handle_api_error(operation, platform, details)

def bot_error(operation: str, channel: str = None, platform: str = None) -> HTTPException:
    """Быстрое создание ошибки бота"""
    return ErrorHandler.handle_bot_error(operation, channel, platform)

def validation_error(field: str, value: Any = None, rule: str = None) -> HTTPException:
    """Быстрое создание ошибки валидации"""
    return ErrorHandler.handle_validation_error(field, value, rule)

def unauthorized_error(reason: str = None) -> HTTPException:
    """Быстрое создание ошибки авторизации"""
    return ErrorHandler.handle_unauthorized_error(reason)

def not_found_error(resource: str, identifier: str = None) -> HTTPException:
    """Быстрое создание ошибки "не найдено"""
    return ErrorHandler.handle_not_found_error(resource, identifier)
