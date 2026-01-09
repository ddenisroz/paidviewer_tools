"""
Admin Support Tickets API.
Clean Architecture: uses SupportTicketRepository for data access.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from auth.auth import get_current_user
from repositories.support_repository import SupportTicketRepository
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _ticket_to_dict(ticket) -> dict:
    """Convert ticket model to dict for response."""
    return {
        "id": ticket.id,
        "user_id": ticket.user_id,
        "user_name": ticket.user_name,
        "user_email": ticket.user_email,
        "subject": ticket.subject,
        "message": ticket.message,
        "status": ticket.status,
        "priority": ticket.priority,
        "admin_notes": ticket.admin_notes,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None
    }


def _response_to_dict(response) -> dict:
    """Convert ticket response model to dict."""
    return {
        "id": response.id,
        "author_id": response.author_id,
        "author_name": response.author_name,
        "message": response.message,
        "is_admin_response": response.is_admin_response,
        "is_read": response.is_read,
        "created_at": response.created_at.isoformat() if response.created_at else None
    }


@router.get("/support/tickets")
async def get_support_tickets(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить тикеты поддержки (только для админов)"""
    try:
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        repo = SupportTicketRepository(db)
        tickets, total = repo.get_non_archived_paginated(status=status, page=page, limit=limit)
        
        return {
            "success": True,
            "tickets": [_ticket_to_dict(t) for t in tickets],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting support tickets: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения тикетов")


@router.get("/support/tickets/{ticket_id}")
async def get_support_ticket_detail(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить деталь тикета с ответами"""
    try:
        repo = SupportTicketRepository(db)
        ticket = repo.get_by_id(ticket_id)
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        # Проверяем права доступа (свой тикет или админ)
        if not user.get('is_admin') and ticket.user_id != user.get('id'):
            raise HTTPException(status_code=403, detail="Нет доступа к этому тикету")
        
        responses = repo.get_responses(ticket_id)
        
        return {
            "success": True,
            "ticket": _ticket_to_dict(ticket),
            "responses": [_response_to_dict(r) for r in responses]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ticket detail: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения тикета")


@router.post("/support/tickets")
async def create_support_ticket(
    subject: str,
    message: str,
    priority: Optional[str] = "medium",
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый тикет поддержки (для аутентифицированных и анонимных пользователей)"""
    try:
        # Валидация
        if not subject or len(subject.strip()) < 3:
            raise HTTPException(status_code=400, detail="Subject должна быть минимум 3 символа")
        
        if not message or len(message.strip()) < 10:
            raise HTTPException(status_code=400, detail="Message должна быть минимум 10 символов")
        
        if priority and priority.lower() not in ["low", "medium", "high", "urgent"]:
            priority = "medium"
        
        repo = SupportTicketRepository(db)
        ticket = repo.create_ticket(
            user_id=user.get('id') if user else None,
            user_name=user.get('username') if user else None,
            subject=subject.strip(),
            message=message.strip(),
            priority=priority.lower()
        )
        
        logger.info(f"[OK] Created support ticket #{ticket.id} from {user.get('username') if user else 'Anonymous'}")
        
        return {
            "success": True,
            "ticket_id": ticket.id,
            "message": "Тикет успешно создан. Мы скоро ответим на ваше обращение."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating support ticket: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания тикета")


@router.patch("/support/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: int,
    status: str,
    admin_notes: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить статус тикета (только для админов)"""
    try:
        if not user.get('is_admin'):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if status.lower() not in ["open", "in_progress", "closed"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        repo = SupportTicketRepository(db)
        ticket = repo.update_status(ticket_id, status, admin_notes)
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        logger.info(f"[OK] Updated ticket #{ticket_id} status to {status}")
        
        return {
            "success": True,
            "message": "Статус тикета обновлен"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating ticket status: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обновления статуса")


@router.post("/support/tickets/{ticket_id}/responses")
async def add_ticket_response(
    ticket_id: int,
    message: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Добавить ответ на тикет"""
    try:
        if not message or len(message.strip()) < 3:
            raise HTTPException(status_code=400, detail="Message должна быть минимум 3 символа")
        
        repo = SupportTicketRepository(db)
        ticket = repo.get_by_id(ticket_id)
        
        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        # Проверяем права доступа
        is_admin = user.get('is_admin', False)
        is_owner = ticket.user_id == user.get('id')
        
        if not (is_admin or is_owner):
            raise HTTPException(status_code=403, detail="Нет доступа к этому тикету")
        
        repo.add_response(
            ticket_id=ticket_id,
            author_id=user.get('id'),
            author_name=user.get('username'),
            message=message.strip(),
            is_admin_response=is_admin
        )
        
        logger.info(f"[OK] Added response to ticket #{ticket_id} from {user.get('username')}")
        
        return {
            "success": True,
            "message": "Ответ добавлен"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding ticket response: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления ответа")


@router.delete("/support/tickets/{ticket_id}")
async def archive_support_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Архивировать тикет (мягкое удаление)"""
    try:
        if not user.get('is_admin'):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        repo = SupportTicketRepository(db)
        success = repo.archive(ticket_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Тикет не найден")
        
        logger.info(f"[OK] Archived ticket #{ticket_id}")
        
        return {
            "success": True,
            "message": "Тикет архивирован"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving ticket: {e}")
        raise HTTPException(status_code=500, detail="Ошибка архивирования тикета")

