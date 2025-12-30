"""
API для отчетов об ошибках от frontend
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.database import get_db
from auth.auth import get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/errors", tags=["errors"])


class FrontendErrorReport(BaseModel):
    """Модель для отчета об ошибке от frontend"""
    type: str = Field(..., description="Тип ошибки (react_error, route_error, feature_error, etc.)")
    message: str = Field(..., description="Сообщение об ошибке")
    stack: Optional[str] = Field(None, description="Stack trace")
    componentStack: Optional[str] = Field(None, description="React component stack")
    url: str = Field(..., description="URL страницы где произошла ошибка")
    userAgent: Optional[str] = Field(None, description="User agent браузера")
    timestamp: str = Field(..., description="Timestamp ошибки (ISO format)")
    route: Optional[str] = Field(None, description="Название роута")
    feature: Optional[str] = Field(None, description="Название фичи")


@router.post("/report")
async def report_frontend_error(
    error: FrontendErrorReport,
    request: Request,
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Принимает отчеты об ошибках от frontend
    Логирует их для дальнейшего анализа
    """
    user_id = current_user.get("id") if current_user else None
    user_name = current_user.get("username") if current_user else "anonymous"

    # Логируем ошибку с полным контекстом
    # NOTE: 'message' is a reserved field in LogRecord, use 'error_message' instead
    logger.error(
        f"Frontend error: {error.type} - {error.message}",
        extra={
            "error_type": error.type,
            "error_message": error.message,
            "url": error.url,
            "route": error.route,
            "feature": error.feature,
            "user_id": user_id,
            "user_name": user_name,
            "user_agent": error.userAgent,
            "client_ip": request.client.host if request.client else None,
            "timestamp": error.timestamp,
            "stack": error.stack,
            "component_stack": error.componentStack,
        },
    )

    return {
        "success": True,
        "message": "Error report received",
    }


@router.get("/stats")
async def get_error_stats(
    current_user: dict = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Получить статистику ошибок (для админов)
    
    Note: Для полной реализации требуется создать таблицу ErrorLog в базе данных.
    Сейчас ошибки логируются в файл logs/bot_service.log через structlog.
    """
    # Ошибки логируются через structlog в logs/bot_service.log
    # Для статистики можно парсить лог-файл или создать таблицу ErrorLog
    return {
        "total_errors": 0,
        "errors_by_type": {},
        "recent_errors": [],
        "message": "Error logging is active. Errors are stored in logs/bot_service.log"
    }
