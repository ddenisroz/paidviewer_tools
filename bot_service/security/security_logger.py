"""
Система логирования безопасности
"""
import logging
import json
import os
from typing import Dict, Any, Optional
from fastapi import Request
from sqlalchemy.orm import Session
from core.database import SecurityLog
from core.datetime_utils import utcnow_naive

# Настройка логгера безопасности
security_logger = logging.getLogger('security')
security_logger.setLevel(logging.INFO)

# Создаем обработчик для файла логов безопасности
log_dir = os.path.join(os.getcwd(), 'logs', 'security')
os.makedirs(log_dir, exist_ok=True)

security_handler = logging.FileHandler(
    os.path.join(log_dir, 'security.log'),
    encoding='utf-8'
)
security_handler.setLevel(logging.INFO)

# Форматтер для логов безопасности
security_formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
)
security_handler.setFormatter(security_formatter)

security_logger.addHandler(security_handler)

class SecurityLogger:
    """Класс для логирования событий безопасности"""

    @staticmethod
    def log_auth_attempt(
        request: Request,
        username: str,
        platform: str,
        success: bool,
        reason: Optional[str] = None,
        user_id: Optional[int] = None
    ):
        """Логирует попытку аутентификации"""
        event_data = {
            'event_type': 'auth_attempt',
            'username': username,
            'platform': platform,
            'success': success,
            'reason': reason,
            'user_id': user_id,
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'timestamp': utcnow_naive().isoformat()
        }

        level = logging.INFO if success else logging.WARNING
        security_logger.log(level, f"Auth attempt: {json.dumps(event_data)}")

    @staticmethod
    def log_permission_denied(
        request: Request,
        user_id: int,
        resource: str,
        action: str,
        reason: str
    ):
        """Логирует отказ в доступе"""
        event_data = {
            'event_type': 'permission_denied',
            'user_id': user_id,
            'resource': resource,
            'action': action,
            'reason': reason,
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'timestamp': utcnow_naive().isoformat()
        }

        security_logger.warning(f"Permission denied: {json.dumps(event_data)}")

    @staticmethod
    def log_admin_action(
        request: Request,
        admin_user_id: int,
        action: str,
        target_user_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Логирует действия администратора"""
        event_data = {
            'event_type': 'admin_action',
            'admin_user_id': admin_user_id,
            'action': action,
            'target_user_id': target_user_id,
            'details': details or {},
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'timestamp': utcnow_naive().isoformat()
        }

        security_logger.info(f"Admin action: {json.dumps(event_data)}")

    @staticmethod
    def log_data_access(
        request: Request,
        user_id: int,
        resource_type: str,
        resource_id: Optional[int] = None,
        action: str = 'read'
    ):
        """Логирует доступ к данным"""
        event_data = {
            'event_type': 'data_access',
            'user_id': user_id,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'action': action,
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'timestamp': utcnow_naive().isoformat()
        }

        security_logger.info(f"Data access: {json.dumps(event_data)}")

    @staticmethod
    def log_suspicious_activity(
        request: Request,
        user_id: Optional[int],
        activity_type: str,
        description: str,
        severity: str = 'medium'
    ):
        """Логирует подозрительную активность"""
        event_data = {
            'event_type': 'suspicious_activity',
            'user_id': user_id,
            'activity_type': activity_type,
            'description': description,
            'severity': severity,
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'timestamp': utcnow_naive().isoformat()
        }

        level = logging.ERROR if severity == 'high' else logging.WARNING
        security_logger.log(level, f"Suspicious activity: {json.dumps(event_data)}")

    @staticmethod
    def log_csrf_violation(
        request: Request,
        user_id: Optional[int] = None
    ):
        """Логирует нарушение CSRF"""
        event_data = {
            'event_type': 'csrf_violation',
            'user_id': user_id,
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'timestamp': utcnow_naive().isoformat()
        }

        security_logger.warning(f"CSRF violation: {json.dumps(event_data)}")

    @staticmethod
    def log_rate_limit_exceeded(
        request: Request,
        user_id: Optional[int],
        endpoint: str,
        limit: int
    ):
        """Логирует превышение лимита запросов"""
        event_data = {
            'event_type': 'rate_limit_exceeded',
            'user_id': user_id,
            'endpoint': endpoint,
            'limit': limit,
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'timestamp': utcnow_naive().isoformat()
        }

        security_logger.warning(f"Rate limit exceeded: {json.dumps(event_data)}")

    @staticmethod
    def save_to_database(db: Session, event_data: Dict[str, Any]):
        """Сохраняет событие безопасности в базу данных"""
        try:
            security_log = SecurityLog(
                event_type=event_data.get('event_type'),
                user_id=event_data.get('user_id'),
                ip_address=event_data.get('ip_address'),
                user_agent=event_data.get('user_agent'),
                details=event_data,
                created_at=utcnow_naive()
            )
            db.add(security_log)
            db.commit()
        except Exception as e:
            security_logger.error(f"Failed to save security log to database: {e}")

# Глобальный экземпляр логгера безопасности
security_logger_instance = SecurityLogger()
