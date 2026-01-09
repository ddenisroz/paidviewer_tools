# bot_service/api/support_api.py
"""API для системы поддержки.

Clean Architecture: uses SupportTicketRepository for data access.
"""
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional, List

from core.database import get_db, SupportTicket, TicketResponse
from auth.auth import get_current_user
from validators.input_validators import sanitize_input
from core.datetime_utils import utcnow_naive
from repositories.support_repository import SupportTicketRepository
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CreateTicketRequest(BaseModel):
    subject: str
    message: str
    priority: str = "normal"

    @field_validator('subject')
    @classmethod
    def sanitize_subject(cls, v):
        return sanitize_input(v, max_length=100)

    @field_validator('message')
    @classmethod
    def sanitize_message(cls, v):
        return sanitize_input(v, max_length=2000)

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        if v not in ['low', 'normal', 'high', 'critical']:
            raise ValueError("Invalid priority")
        return v


class RespondTicketRequest(BaseModel):
    message: str

    @field_validator('message')
    @classmethod
    def sanitize_message(cls, v):
        return sanitize_input(v, max_length=2000)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def format_ticket(ticket: SupportTicket) -> dict:
    """Format ticket for API response."""
    return {
        'id': ticket.id,
        'user_id': ticket.user_id,
        'subject': ticket.subject,
        'status': ticket.status,
        'priority': ticket.priority,
        'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
        'updated_at': ticket.updated_at.isoformat() if ticket.updated_at else None
    }



# ============================================================================
# ENDPOINTS
# ============================================================================

router = APIRouter(prefix="/api/support", tags=["support"])


@router.get("/tickets")
async def get_support_tickets(
    status: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить тикеты поддержки"""
    try:
        ticket_repo = SupportTicketRepository(db)
        if user.get('is_admin', False):
            tickets = ticket_repo.get_all_tickets(status)
        else:
            tickets = ticket_repo.get_by_user_id(user['id'])
        
        return {"success": True, "tickets": [format_ticket(t) for t in tickets], "total": len(tickets)}
    except Exception as e:
        logger.error(f"Error getting support tickets: {e}")
        return {"success": False, "error": str(e)}


@router.get("/my-tickets")
async def get_my_tickets(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить мои тикеты поддержки"""
    try:
        ticket_repo = SupportTicketRepository(db)
        tickets = ticket_repo.get_by_user_id(user['id'])
        return {"success": True, "tickets": [format_ticket(t) for t in tickets], "total": len(tickets)}
    except Exception as e:
        logger.error(f"Error getting user tickets: {e}")
        return {"success": False, "error": str(e)}


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить конкретный тикет"""
    try:
        ticket_repo = SupportTicketRepository(db)
        ticket = ticket_repo.get(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        if not user.get('is_admin', False) and user['id'] != ticket.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        responses = ticket_repo.get_responses(ticket_id)
        response_data = [
            {'id': r.id, 'user_id': r.user_id, 'message': r.message, 'is_admin': r.is_admin, 
             'created_at': r.created_at.isoformat() if r.created_at else None}
            for r in responses
        ]
        
        ticket_data = format_ticket(ticket)
        ticket_data['description'] = ticket.description
        ticket_data['responses'] = response_data
        
        return {"success": True, "ticket": ticket_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ticket {ticket_id}: {e}")
        return {"success": False, "error": str(e)}


@router.post("/tickets")
async def create_ticket(
    subject: str = Form(...),
    message: str = Form(...),
    priority: str = Form("normal"),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый тикет поддержки"""
    try:
        subject = sanitize_input(subject, max_length=100)
        message = sanitize_input(message, max_length=2000)
        
        if priority not in ['low', 'normal', 'high', 'critical']:
            raise HTTPException(status_code=400, detail="Invalid priority value")
        
        ticket_repo = SupportTicketRepository(db)
        ticket = ticket_repo.create_ticket(
            user_id=user['id'],
            user_name=user.get('username'),
            subject=subject,
            message=message,
            priority=priority
        )
        
        logger.info(f"New support ticket created: {ticket.id} by user {user['id']}")
        return {"success": True, "ticket_id": ticket.id, "message": "Ticket created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating ticket: {e}")
        return {"success": False, "error": str(e)}


@router.post("/tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: int,
    message: str = Form(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ответить на тикет"""
    try:
        message = sanitize_input(message, max_length=2000)
        
        ticket_repo = SupportTicketRepository(db)
        ticket = ticket_repo.get(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        if not user.get('is_admin', False) and user['id'] != ticket.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        ticket_repo.add_response(
            ticket_id=ticket_id,
            author_id=user['id'],
            author_name=user.get('username', ''),
            message=message,
            is_admin_response=user.get('is_admin', False)
        )
        
        # Update ticket status based on response
        if ticket.status == 'closed':
            ticket_repo.update_status(ticket_id, 'reopened')
        elif ticket.status == 'open' and user.get('is_admin', False):
            ticket_repo.update_status(ticket_id, 'in_progress')
        
        logger.info(f"Response added to ticket {ticket_id} by user {user['id']}")
        return {"success": True, "message": "Response added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to ticket {ticket_id}: {e}")
        return {"success": False, "error": str(e)}


@router.post("/tickets/{ticket_id}/close")
async def close_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Закрыть тикет"""
    try:
        ticket_repo = SupportTicketRepository(db)
        ticket = ticket_repo.get(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        if not user.get('is_admin', False) and user['id'] != ticket.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        ticket_repo.update_status(ticket_id, 'closed')
        
        logger.info(f"Ticket {ticket_id} closed by user {user['id']}")
        return {"success": True, "message": "Ticket closed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing ticket {ticket_id}: {e}")
        return {"success": False, "error": str(e)}

