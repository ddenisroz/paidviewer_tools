"""
Стандартизированные API ответы для унификации форматов
Решает проблему непоследовательных форматов ответов (dict vs JSONResponse)
"""

from typing import Any, Optional, Dict
from fastapi.responses import JSONResponse
from fastapi import status


class StandardResponse:
    """
    Класс для создания стандартизированных API ответов
    
    Все ответы имеют единый формат:
    {
        "success": True/False,
        "data": {...},           # Опционально, только для success=True
        "message": "...",         # Опционально, человеко-читаемое сообщение
        "error": {                # Только для success=False
            "code": "ERROR_CODE",
            "message": "...",
            "details": {...}
        }
    }
    """
    
    @staticmethod
    def success(
        data: Optional[Any] = None,
        message: Optional[str] = None,
        status_code: int = status.HTTP_200_OK
    ) -> JSONResponse:
        """
        Успешный ответ
        
        Args:
            data: Данные для возврата
            message: Опциональное сообщение (например, "Настройки успешно сохранены")
            status_code: HTTP статус код (default: 200)
        
        Returns:
            JSONResponse с стандартным форматом
            
        Example:
            return StandardResponse.success(
                data={"tts_enabled": True},
                message="TTS успешно включен"
            )
        """
        content = {
            "success": True
        }
        
        if data is not None:
            content["data"] = data
            
        if message:
            content["message"] = message
            
        return JSONResponse(
            status_code=status_code,
            content=content
        )
    
    @staticmethod
    def error(
        message: str,
        code: str = "UNKNOWN_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ) -> JSONResponse:
        """
        Ответ с ошибкой
        
        Args:
            message: Человеко-читаемое сообщение об ошибке
            code: Машинно-читаемый код ошибки (например, "TTS_NOT_AVAILABLE")
            status_code: HTTP статус код (default: 500)
            details: Дополнительные детали ошибки
        
        Returns:
            JSONResponse с стандартным форматом ошибки
            
        Example:
            return StandardResponse.error(
                message="Не удалось включить TTS",
                code="TTS_ENABLE_FAILED",
                status_code=400,
                details={"reason": "Service not available"}
            )
        """
        error_obj = {
            "code": code,
            "message": message
        }
        
        if details:
            error_obj["details"] = details
            
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "error": error_obj
            }
        )
    
    @staticmethod
    def created(
        data: Any,
        message: Optional[str] = None,
        resource_id: Optional[Any] = None
    ) -> JSONResponse:
        """
        Ответ для создания ресурса (201 Created)
        
        Args:
            data: Созданный ресурс
            message: Опциональное сообщение
            resource_id: ID созданного ресурса
        
        Returns:
            JSONResponse со статусом 201
            
        Example:
            return StandardResponse.created(
                data=ticket_dict,
                message="Тикет успешно создан",
                resource_id=ticket.id
            )
        """
        response_data = data
        if resource_id is not None and isinstance(data, dict):
            response_data = {**data, "id": resource_id}
            
        return StandardResponse.success(
            data=response_data,
            message=message or "Resource created successfully",
            status_code=status.HTTP_201_CREATED
        )
    
    @staticmethod
    def no_content(message: Optional[str] = None) -> JSONResponse:
        """
        Ответ без контента (204 No Content)
        Обычно используется для DELETE запросов
        
        Args:
            message: Опциональное сообщение
        
        Returns:
            JSONResponse со статусом 204
            
        Example:
            return StandardResponse.no_content("Ресурс успешно удалён")
        """
        content = {"success": True}
        if message:
            content["message"] = message
            
        return JSONResponse(
            status_code=status.HTTP_204_NO_CONTENT,
            content=content
        )
    
    @staticmethod
    def bad_request(
        message: str,
        code: str = "BAD_REQUEST",
        details: Optional[Dict[str, Any]] = None
    ) -> JSONResponse:
        """
        Ошибка валидации (400 Bad Request)
        
        Example:
            return StandardResponse.bad_request(
                message="Неверные параметры запроса",
                code="INVALID_PARAMETERS",
                details={"field": "email", "error": "Invalid format"}
            )
        """
        return StandardResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details
        )
    
    @staticmethod
    def unauthorized(
        message: str = "Необходима авторизация",
        code: str = "UNAUTHORIZED"
    ) -> JSONResponse:
        """
        Ошибка авторизации (401 Unauthorized)
        
        Example:
            return StandardResponse.unauthorized(
                message="Токен истёк",
                code="TOKEN_EXPIRED"
            )
        """
        return StandardResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_401_UNAUTHORIZED
        )
    
    @staticmethod
    def forbidden(
        message: str = "Доступ запрещён",
        code: str = "FORBIDDEN"
    ) -> JSONResponse:
        """
        Ошибка прав доступа (403 Forbidden)
        
        Example:
            return StandardResponse.forbidden(
                message="Недостаточно прав",
                code="INSUFFICIENT_PERMISSIONS"
            )
        """
        return StandardResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    @staticmethod
    def not_found(
        message: str = "Ресурс не найден",
        code: str = "NOT_FOUND",
        resource_type: Optional[str] = None
    ) -> JSONResponse:
        """
        Ресурс не найден (404 Not Found)
        
        Example:
            return StandardResponse.not_found(
                message="Пользователь не найден",
                code="USER_NOT_FOUND",
                resource_type="User"
            )
        """
        details = {"resource_type": resource_type} if resource_type else None
        return StandardResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details
        )
    
    @staticmethod
    def conflict(
        message: str,
        code: str = "CONFLICT",
        details: Optional[Dict[str, Any]] = None
    ) -> JSONResponse:
        """
        Конфликт (409 Conflict)
        Например, ресурс уже существует
        
        Example:
            return StandardResponse.conflict(
                message="Пользователь с таким email уже существует",
                code="USER_ALREADY_EXISTS"
            )
        """
        return StandardResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_409_CONFLICT,
            details=details
        )
    
    @staticmethod
    def too_many_requests(
        message: str = "Слишком много запросов",
        code: str = "RATE_LIMIT_EXCEEDED",
        retry_after: Optional[int] = None
    ) -> JSONResponse:
        """
        Rate limit превышен (429 Too Many Requests)
        
        Args:
            retry_after: Секунды до следующей попытки
        
        Example:
            return StandardResponse.too_many_requests(
                message="Подождите 60 секунд перед следующей попыткой",
                retry_after=60
            )
        """
        details = {"retry_after_seconds": retry_after} if retry_after else None
        response = StandardResponse.error(
            message=message,
            code=code,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details
        )
        
        if retry_after:
            response.headers["Retry-After"] = str(retry_after)
            
        return response


# ========================================
# Error Codes Reference
# ========================================
class ErrorCodes:
    """
    Централизованные коды ошибок для всего приложения
    Используй эти константы вместо хардкода строк
    """
    
    # Auth
    UNAUTHORIZED = "UNAUTHORIZED"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    
    # TTS
    TTS_NOT_AVAILABLE = "TTS_NOT_AVAILABLE"
    TTS_NOT_WHITELISTED = "TTS_NOT_WHITELISTED"
    TTS_ENABLE_FAILED = "TTS_ENABLE_FAILED"
    TTS_VOICE_NOT_FOUND = "TTS_VOICE_NOT_FOUND"
    
    # Commands
    COMMAND_NOT_FOUND = "COMMAND_NOT_FOUND"
    COMMAND_LIMIT_EXCEEDED = "COMMAND_LIMIT_EXCEEDED"
    INVALID_COMMAND_NAME = "INVALID_COMMAND_NAME"
    
    # General
    BAD_REQUEST = "BAD_REQUEST"
    NOT_FOUND = "NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"

