# bot_service/api/system_api.py
"""Р С›РЎРѓР Р…Р С•Р Р†Р Р…РЎвЂ№Р Вµ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР Р…РЎвЂ№Р Вµ API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from core.datetime_utils import utcnow_naive
from repositories.user_repository import UserRepository
import logging
import secrets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health")
async def health_check():
    """Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚Р С”Р В° Р В·Р Т‘Р С•РЎР‚Р С•Р Р†РЎРЉРЎРЏ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№"""
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
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№"""
    try:
        # Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С РЎР‚Р ВµР С—Р С•Р В·Р С‘РЎвЂљР С•РЎР‚Р С‘Р в„– Р Р†Р СР ВµРЎРѓРЎвЂљР С• Р С—РЎР‚РЎРЏР СРЎвЂ№РЎвЂ¦ db.query
        user_repo = UserRepository(db)
        total_users = user_repo.count_all()
        active_users = user_repo.count_active()

        return {
            "success": True,
            "status": {
                "total_users": total_users,
                "active_users": active_users,
                "uptime": "unknown",  # Р СљР С•Р В¶Р Р…Р С• Р Т‘Р С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎР‚Р ВµР В°Р В»РЎРЉР Р…Р С•Р Вµ Р Р†РЎР‚Р ВµР СРЎРЏ РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂ№
                "version": "1.0.0"
            }
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting system status")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/metrics")
async def get_metrics():
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ Р СР ВµРЎвЂљРЎР‚Р С‘Р С”Р С‘ Prometheus"""
    try:
        # Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р ВµР С enhanced_logger Р Р†Р СР ВµРЎРѓРЎвЂљР С• modern_monitor
        from utils.enhanced_logger import get_system_metrics
        metrics_summary = get_system_metrics()
        return {
            "success": True,
            "metrics": metrics_summary
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting metrics")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/metrics/prometheus")
async def get_prometheus_metrics():
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ Р СР ВµРЎвЂљРЎР‚Р С‘Р С”Р С‘ Р Р† РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР Вµ Prometheus"""
    try:
        # Р вЂ™Р С•Р В·Р Р†РЎР‚Р В°РЎвЂ°Р В°Р ВµР С URL Р Т‘Р В»РЎРЏ Prometheus
        return {
            "success": True,
            "prometheus_url": "http://localhost:8000/api/metrics",
            "note": "Access Prometheus metrics at the provided URL"
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting Prometheus URL")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/info")
async def system_info():
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ Р С‘Р Р…РЎвЂћР С•РЎР‚Р СР В°РЎвЂ Р С‘РЎР‹ Р С• РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР Вµ"""
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
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р С—РЎР‚Р В°Р Р†Р В° Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")

        # Р вЂњР ВµР Р…Р ВµРЎР‚Р С‘РЎР‚РЎС“Р ВµР С Р Р…Р С•Р Р†РЎвЂ№Р в„– API Р С”Р В»РЎР‹РЎвЂЎ
        api_key = secrets.token_urlsafe(32)

        # Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С API Р С”Р В»РЎР‹РЎвЂЎ Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ Р Р† Р вЂР вЂќ РЎвЂЎР ВµРЎР‚Р ВµР В· РЎР‚Р ВµР С—Р С•Р В·Р С‘РЎвЂљР С•РЎР‚Р С‘Р в„–
        user_repo = UserRepository(db)
        user_obj = user_repo.get_by_id(user['id'])
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

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error generating API key")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/logs")
async def get_system_logs(
    lines: int = 100,
    user: dict = Depends(get_current_user)
):
    """Р СџР С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР Р…РЎвЂ№Р Вµ Р В»Р С•Р С–Р С‘ Р С‘Р В· РЎвЂћР В°Р в„–Р В»Р С•Р Р†"""
    try:
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р С—РЎР‚Р В°Р Р†Р В° Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")

        from pathlib import Path

        # Р СџРЎС“РЎвЂљРЎРЉ Р С” Р В»Р С•Р С–Р В°Р С
        logs_dir = Path("logs")

        # Р В§Р С‘РЎвЂљР В°Р ВµР С Р В»Р С•Р С–Р С‘ Р С‘Р В· РЎР‚Р В°Р В·Р Р…РЎвЂ№РЎвЂ¦ РЎвЂћР В°Р в„–Р В»Р С•Р Р† (Р С—РЎР‚Р С‘Р С•РЎР‚Р С‘РЎвЂљР ВµРЎвЂљ: Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘, Р В·Р В°РЎвЂљР ВµР С Р С•Р В±РЎвЂ°Р С‘Р Вµ Р В»Р С•Р С–Р С‘)
        all_logs = []

        # 1. Р В§Р С‘РЎвЂљР В°Р ВµР С Р В»Р С•Р С–Р С‘ Р С•РЎв‚¬Р С‘Р В±Р С•Р С” (РЎРѓР В°Р СРЎвЂ№Р Вµ Р Р†Р В°Р В¶Р Р…РЎвЂ№Р Вµ)
        error_log_file = logs_dir / "errors" / "bot_service_errors.log"
        if error_log_file.exists():
            try:
                with open(error_log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    error_lines = f.readlines()
                    all_logs.extend([f"[ERROR] {line.strip()}" for line in error_lines[-lines//2:] if line.strip()])
            except Exception:
                logger.exception("Could not read error log file")

        # 2. Р В§Р С‘РЎвЂљР В°Р ВµР С Р С•РЎРѓР Р…Р С•Р Р†Р Р…РЎвЂ№Р Вµ Р В»Р С•Р С–Р С‘ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘РЎРЏ
        app_log_file = logs_dir / "app" / "bot_service.log"
        if app_log_file.exists():
            try:
                with open(app_log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    app_lines = f.readlines()
                    # Р вЂР ВµРЎР‚Р ВµР С Р С—Р С•РЎРѓР В»Р ВµР Т‘Р Р…Р С‘Р Вµ РЎРѓРЎвЂљРЎР‚Р С•Р С”Р С‘
                    all_logs.extend([line.strip() for line in app_lines[-lines:] if line.strip()])
            except Exception:
                logger.exception("Could not read app log file")

        # Р РЋР С•РЎР‚РЎвЂљР С‘РЎР‚РЎС“Р ВµР С Р С—Р С• Р Р†РЎР‚Р ВµР СР ВµР Р…Р С‘ (Р ВµРЎРѓР В»Р С‘ Р ВµРЎРѓРЎвЂљРЎРЉ timestamp) Р С‘ Р В±Р ВµРЎР‚Р ВµР С Р С—Р С•РЎРѓР В»Р ВµР Т‘Р Р…Р С‘Р Вµ N РЎРѓРЎвЂљРЎР‚Р С•Р С”
        all_logs.sort(reverse=True)  # Новые сверху
        result_logs = all_logs[:lines]

        # Р вЂўРЎРѓР В»Р С‘ Р В»Р С•Р С–Р С•Р Р† Р Р…Р ВµРЎвЂљ, Р Р†Р С•Р В·Р Р†РЎР‚Р В°РЎвЂ°Р В°Р ВµР С Р С‘Р Р…РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР С‘Р Р†Р Р…Р С•Р Вµ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ
        if not result_logs:
            return {
                "success": True,
                "logs": [
                    "INFO - Р вЂєР С•Р С–Р С‘ Р С—РЎС“РЎРѓРЎвЂљРЎвЂ№. Р вЂєР С•Р С–Р С‘ Р В±РЎС“Р Т‘РЎС“РЎвЂљ Р С—Р С•РЎРЏР Р†Р В»РЎРЏРЎвЂљРЎРЉРЎРѓРЎРЏ Р В·Р Т‘Р ВµРЎРѓРЎРЉ Р С—Р С• Р СР ВµРЎР‚Р Вµ РЎР‚Р В°Р В±Р С•РЎвЂљРЎвЂ№ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№.",
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
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error getting system logs")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/restart")
async def restart_system(
    user: dict = Depends(get_current_user)
):
    """Р СџР ВµРЎР‚Р ВµР В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎС“ (Р В·Р В°Р С–Р В»РЎС“РЎв‚¬Р С”Р В°)"""
    try:
        # Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЏР ВµР С Р С—РЎР‚Р В°Р Р†Р В° Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°
        if not (user.get('role') == 'admin' or user.get('is_admin', False)):
            raise HTTPException(status_code=403, detail="Admin access required")

        # Р вЂ™ РЎР‚Р ВµР В°Р В»РЎРЉР Р…Р С•Р в„– РЎРѓР С‘РЎРѓРЎвЂљР ВµР СР Вµ Р В·Р Т‘Р ВµРЎРѓРЎРЉ Р В±РЎвЂ№ Р В±РЎвЂ№Р В» Р С—Р ВµРЎР‚Р ВµР В·Р В°Р С—РЎС“РЎРѓР С”
        logger.warning("System restart requested by user %s", user["id"])
        return {
            "success": True,
            "message": "Restart command sent (not implemented in development)"
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error restarting system")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/csp-report")
async def csp_report(request: Request):
    """
    Collect CSP violations from clients
    Used for monitoring and improving security policy
    """
    try:
        body = await request.json()
        csp = body.get("csp-report") if isinstance(body, dict) else None
        if isinstance(csp, dict):
            logger.warning(
                "CSP violation: document-uri=%s blocked-uri=%s violated-directive=%s",
                csp.get("document-uri"),
                csp.get("blocked-uri"),
                csp.get("violated-directive"),
            )
        else:
            logger.warning("CSP violation report received")
        return {"success": True, "message": "CSP violation reported"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error processing CSP report")
        raise HTTPException(status_code=500, detail="Internal server error")
