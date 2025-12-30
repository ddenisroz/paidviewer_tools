# models/support.py
"""
Модели системы поддержки: тикеты и ответы.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text
)
from core.datetime_utils import utcnow_naive
from models.base import Base


class SupportTicket(Base):
    """Модель тикетов поддержки"""
    __tablename__ = "support_tickets"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    user_name = Column(String, nullable=True)
    user_email = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default="open")
    priority = Column(String, default="medium")
    admin_notes = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
    closed_at = Column(DateTime, nullable=True)


class TicketResponse(Base):
    """Модель ответов на тикеты"""
    __tablename__ = "ticket_responses"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey('support_tickets.id'), nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    author_name = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_admin_response = Column(Boolean, default=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
