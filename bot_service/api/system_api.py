# bot_service/api/system_api.py
"""Основные системные API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.database import get_db, User
from auth.auth import get_current_user
from core.datetime_utils import utcnow_naive
# from monitoring.modern_monitor import modern_monitor  # Удалено - используем enhanced_logger
import logging
import secrets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/system", tags=["system"])

@router.get("/health")
async def health_check():
    """Проверка здоровья системы"""
    return {
        "status": "healthy",
        "timestamp": utcnow_naive().isoformat(),
        "version": "1.0.0"
    }

@router.get("/status")
async def system_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статус системы"""
    try:
        # Базовая статистика
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()

        return {
            "success": True,
            "status": {
                "total_users": total_users,
                "active_users": active_users,
                "uptime": "unknown",  # Можно добавить реальное время работы
                "version": "1.0.0"
            }
        }
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return {"success": False, "error": str(e)}

@router.get("/metrics")
async def get_metrics():
    """Получить метрики Prometheus"""
    try:
        # Используем enhanced_logger вместо modern_monitor
        from utils.enhanced_logger import get_system_metrics
        metrics_summary = get_system_metrics()
        return {
            "success": True,
            "metrics": metrics_summary
        }
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        return {"success": False, "error": str(e)}

@router.get("/metrics/prometheus")
async def get_prometheus_metrics():
    """Получить метрики в формате Prometheus"""
    try:
        # Возвращаем URL для Prometheus
        return {
            "success": True,
            "prometheus_url": "http://localhost:8000/api/metrics",
            "note": "Access Prometheus metrics at the provided URL"
        }
    except Exception as e:
        logger.error(f"Error getting Prometheus URL: {e}")
        return {"success": False, "error": str(e)}

@router.get("/info")
async def system_info():
    """Получить информацию о системе"""
    return {
        "name": "TTS Bot Service",
        "version": "1.0.0",
        "description": "Text-to-Speech Bot Service with Multi-Platform Support",
        "features": [
            "Twitch Integration",
            "VK Live Integration",
            "TTS Synthesis",
            "WebSocket Support",
            "Admin Panel"
        ]
    }

@router.post("/generate-api-key")
async def generate_api_key(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сгенерировать новый API ключ для пользователя"""
    try:
        # Проверяем права доступа
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")

        # Генерируем новый API ключ
        api_key = secrets.token_urlsafe(32)

        # Обновляем API ключ пользователя в БД
        user_obj = db.query(User).filter(User.id == user['id']).first()
        if user_obj:
            user_obj.api_key = api_key
            db.commit()

            logger.info(f"New API key generated for user {user['id']}")
            return {
                "success": True,
                "api_key": api_key,
                "message": "API key generated successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="User not found")

    except Exception as e:
        logger.error(f"Error generating API key: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}

@router.get("/logs")
async def get_system_logs(
    lines: int = 100,
    user: dict = Depends(get_current_user)
):
    """Получить системные логи из файлов"""
    try:
        # Проверяем права доступа
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")

        from pathlib import Path

        # Путь к логам
        logs_dir = Path("logs")

        # Читаем логи из разных файлов (приоритет: ошибки, затем общие логи)
        all_logs = []

        # 1. Читаем логи ошибок (самые важные)
        error_log_file = logs_dir / "errors" / "bot_service_errors.log"
        if error_log_file.exists():
            try:
                with open(error_log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    error_lines = f.readlines()
                    all_logs.extend([f"[ERROR] {line.strip()}" for line in error_lines[-lines//2:] if line.strip()])
            except Exception as e:
                logger.warning(f"Could not read error log file: {e}")

        # 2. Читаем основные логи приложения
        app_log_file = logs_dir / "app" / "bot_service.log"
        if app_log_file.exists():
            try:
                with open(app_log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    app_lines = f.readlines()
                    # Берем последние строки
                    all_logs.extend([line.strip() for line in app_lines[-lines:] if line.strip()])
            except Exception as e:
                logger.warning(f"Could not read app log file: {e}")

        # Сортируем по времени (если есть timestamp) и берем последние N строк
        all_logs.sort(reverse=True)  # Новые сверху
        result_logs = all_logs[:lines]

        # Если логов нет, возвращаем информативное сообщение
        if not result_logs:
            return {
                "success": True,
                "logs": [
                    "INFO - Логи пусты. Логи будут появляться здесь по мере работы системы.",
                    "INFO - Логи сохраняются в папке bot_service/logs/",
                    "INFO - Проверьте файлы: logs/app/bot_service.log и logs/errors/bot_service_errors.log"
                ],
                "total_lines": 3,
                "note": "No logs found yet"
            }

        return {
            "success": True,
            "logs": result_logs,
            "total_lines": len(result_logs),
            "sources": {
                "error_log": str(error_log_file) if error_log_file.exists() else None,
                "app_log": str(app_log_file) if app_log_file.exists() else None
            }
        }
    except Exception as e:
        logger.error(f"Error getting system logs: {e}")
        return {"success": False, "error": str(e)}

@router.post("/restart")
async def restart_system(
    user: dict = Depends(get_current_user)
):
    """Перезапустить систему (заглушка)"""
    try:
        # Проверяем права доступа
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")

        # В реальной системе здесь бы был перезапуск
        logger.warning(f"System restart requested by user {user['id']}")
        return {
            "success": True,
            "message": "Restart command sent (not implemented in development)"
        }
    except Exception as e:
        logger.error(f"Error restarting system: {e}")
        return {"success": False, "error": str(e)}

@router.post("/csp-report")
async def csp_report(request: Request):
    """
    Collect CSP violations from clients
    Used for monitoring and improving security policy
    """
    try:
        body = await request.json()
        logger.warning(f"CSP Violation: {body}")
        return {"success": True, "message": "CSP violation reported"}
    except Exception as e:
        logger.error(f"Error processing CSP report: {e}")
        return {"success": False, "error": str(e)}
