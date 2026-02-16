"""
Централизованные обработчики исключений для FastAPI.

Обрабатывает:
- AppException и наследники (бизнес-ошибки)
- HTTPException (FastAPI)
- RequestValidationError (Pydantic)
- SQLAlchemyError (БД)
- Exception (все остальное)
"""
import logging
from core.datetime_utils import utcnow_naive
from typing import Union

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from core.exceptions import AppException
from utils.error_logger import error_logger

logger = logging.getLogger(__name__)


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Глобальный обработчик для всех необработанных исключений
    Предотвращает падение приложения и логирует ошибки
    """
    # Получаем информацию о пользователе если доступна
    user_id = getattr(request.state, "user_id", None)

    # Используем структурированное логирование
    error_logger.log_error(
        exc,
        context={
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "client_host": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "content_type": request.headers.get("content-type"),
            # Add safe headers snapshot (excluding sensitive auth)
            "headers_snapshot": {
                k: v for k, v in request.headers.items() 
                if k.lower() not in ('authorization', 'cookie', 'x-api-key')
            }
        },
        user_id=user_id,
        endpoint=request.url.path,
        severity="CRITICAL",
    )

    # В production не показываем детали ошибки
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Внутренняя ошибка сервера",
            "timestamp": utcnow_naive().isoformat(),
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Обработчик для HTTPException
    Логирует и возвращает структурированный ответ
    """
    user_id = getattr(request.state, "user_id", None)

    # Логируем только если это не ожидаемые ошибки (401, 403, 404)
    if exc.status_code not in [401, 403, 404]:
        logger.warning(
            f"HTTP {exc.status_code} in {request.method} {request.url.path}: {exc.detail}",
            extra={
                "user_id": user_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": exc.status_code,
                "timestamp": utcnow_naive().isoformat(),
            },
        )

    # Do not expose internal exception details on 5xx responses.
    response_detail = exc.detail
    if exc.status_code >= 500:
        response_detail = "Внутренняя ошибка сервера"

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": response_detail,
            "timestamp": utcnow_naive().isoformat(),
        },
    )


async def validation_exception_handler(
    request: Request, exc: Union[RequestValidationError, ValidationError]
) -> JSONResponse:
    """
    Обработчик для ошибок валидации Pydantic
    Возвращает детальную информацию о полях с ошибками
    """
    user_id = getattr(request.state, "user_id", None)

    # Форматируем ошибки валидации
    errors = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"][1:])  # Пропускаем 'body'
        errors.append({
            "field": field_path,
            "message": error["msg"],
            "type": error["type"],
        })

    # Используем структурированное логирование
    error_logger.log_validation_error(
        errors=errors,
        endpoint=request.url.path,
        user_id=user_id,
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Ошибка валидации данных",
            "errors": errors,
            "timestamp": utcnow_naive().isoformat(),
        },
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Обработчик для ошибок базы данных
    """
    user_id = getattr(request.state, "user_id", None)

    # Используем структурированное логирование
    error_logger.log_database_error(
        exc,
        operation=f"{request.method} {request.url.path}",
        user_id=user_id,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Ошибка базы данных",
            "timestamp": utcnow_naive().isoformat(),
        },
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """
    Обработчик для бизнес-исключений AppException.
    Возвращает структурированный ответ с error_code и details.
    """
    user_id = getattr(request.state, "user_id", None)

    # Логируем ошибки 5xx
    if exc.status_code >= 500:
        error_logger.log_error(
            exc,
            context={
                "method": request.method,
                "path": request.url.path,
                "error_code": exc.error_code,
                "details": exc.details,
            },
            user_id=user_id,
            endpoint=request.url.path,
            severity="ERROR",
        )
    else:
        logger.info(
            f"[{exc.error_code}] {request.method} {request.url.path}: {exc.message}",
            extra={
                "user_id": user_id,
                "error_code": exc.error_code,
                "status_code": exc.status_code,
            },
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            **exc.to_dict(),
            "timestamp": utcnow_naive().isoformat(),
        },
    )


def setup_exception_handlers(app):
    """
    Регистрирует все обработчики исключений в FastAPI приложении
    
    Usage:
        from core.exception_handlers import setup_exception_handlers
        
        app = FastAPI()
        setup_exception_handlers(app)
    """
    # Глобальный обработчик для всех необработанных исключений
    app.add_exception_handler(Exception, global_exception_handler)

    # Обработчик для HTTPException
    app.add_exception_handler(HTTPException, http_exception_handler)

    # Обработчик для ошибок валидации
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)

    # Обработчик для ошибок базы данных
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)

    # Обработчик для бизнес-исключений
    app.add_exception_handler(AppException, app_exception_handler)

    logger.info("[OK] Exception handlers registered")
