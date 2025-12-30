# models/security.py
"""
Модели безопасности и логирования.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
)
from core.datetime_utils import utcnow_naive
from models.base import Base


class SecurityLog(Base):
    """Логи безопасности"""
    __tablename__ = 'security_logs'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive, index=True)


class SystemLog(Base):
    """Логи действий в системе (история действий администраторов)"""
    __tablename__ = 'system_logs'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    action_type = Column(String, nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    target_resource = Column(String, nullable=True)
    description = Column(String, nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    status = Column(String, default='success')
    error_message = Column(String, nullable=True)
    timestamp = Column(DateTime, default=utcnow_naive, index=True)

