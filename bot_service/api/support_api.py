# bot_service/api/support_api.py
"""API для системы поддержки"""
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core.database import get_db, User, SupportTicket, TicketResponse
from auth.auth import get_current_user
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class CreateTicketRequest(BaseModel):
    subject: str
    message: str
    priority: str = "normal"

class RespondTicketRequest(BaseModel):
    message: str

router = APIRouter(prefix="/api/support", tags=["support"])

@router.get("/tickets")
async def get_support_tickets(
    status: str = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить тикеты поддержки"""
    try:
        query = db.query(SupportTicket)
        
        # Если не админ, показываем только свои тикеты
        if not user.get('is_admin', False):
            query = query.filter(SupportTicket.user_id == user['id'])
        elif status:
            query = query.filter(SupportTicket.status == status)
        
        tickets = query.order_by(SupportTicket.created_at.desc()).all()
        
        ticket_data = []
        for ticket in tickets:
            ticket_data.append({
                'id': ticket.id,
                'user_id': ticket.user_id,
                'subject': ticket.subject,
                'status': ticket.status,
                'priority': ticket.priority,
                'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
                'updated_at': ticket.updated_at.isoformat() if ticket.updated_at else None
            })
        
        return {
            "success": True,
            "tickets": ticket_data,
            "total": len(ticket_data)
        }
    except Exception as e:
        logger.error(f"Error getting support tickets: {e}")
        return {"success": False, "error": str(e)}

@router.get("/my-tickets")
async def get_my_tickets(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить мои тикеты поддержки (только текущего пользователя)"""
    return await _get_my_tickets_impl(user, db)

async def _get_my_tickets_impl(user: dict, db: Session):
    try:
        tickets = db.query(SupportTicket).filter(
            SupportTicket.user_id == user['id']
        ).order_by(SupportTicket.created_at.desc()).all()
        
        ticket_data = []
        for ticket in tickets:
            ticket_data.append({
                'id': ticket.id,
                'user_id': ticket.user_id,
                'subject': ticket.subject,
                'status': ticket.status,
                'priority': ticket.priority,
                'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
                'updated_at': ticket.updated_at.isoformat() if ticket.updated_at else None
            })
        
        return {
            "success": True,
            "tickets": ticket_data,
            "total": len(ticket_data)
        }
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
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Проверяем права доступа
        if not user.get('is_admin', False) and user['id'] != ticket.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Получаем ответы на тикет
        responses = db.query(TicketResponse).filter(
            TicketResponse.ticket_id == ticket_id
        ).order_by(TicketResponse.created_at.asc()).all()
        
        response_data = []
        for response in responses:
            response_data.append({
                'id': response.id,
                'user_id': response.user_id,
                'message': response.message,
                'is_admin': response.is_admin,
                'created_at': response.created_at.isoformat() if response.created_at else None
            })
        
        return {
            "success": True,
            "ticket": {
                'id': ticket.id,
                'user_id': ticket.user_id,
                'subject': ticket.subject,
                'description': ticket.description,
                'status': ticket.status,
                'priority': ticket.priority,
                'created_at': ticket.created_at.isoformat() if ticket.created_at else None,
                'updated_at': ticket.updated_at.isoformat() if ticket.updated_at else None,
                'responses': response_data
            }
        }
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
        # Создаем новый тикет
        ticket = SupportTicket(
            user_id=user['id'],
            subject=subject,
            message=message,  # Изменено с description на message
            status='open',
            priority=priority,
            created_at=datetime.utcnow()
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        logger.info(f"New support ticket created: {ticket.id} by user {user['id']}")
        return {
            "success": True,
            "ticket_id": ticket.id,
            "message": "Ticket created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating ticket: {e}")
        db.rollback()
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
        # Проверяем существование тикета
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Проверяем права доступа
        if not user.get('is_admin', False) and user['id'] != ticket.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Создаем ответ
        response = TicketResponse(
            ticket_id=ticket_id,
            user_id=user['id'],
            message=message,
            is_admin=user.get('is_admin', False),
            created_at=datetime.utcnow()
        )
        
        db.add(response)
        
        # Обновляем статус тикета
        if ticket.status == 'closed':
            ticket.status = 'reopened'
        elif ticket.status == 'open' and user.get('is_admin', False):
            ticket.status = 'in_progress'
        
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Response added to ticket {ticket_id} by user {user['id']}")
        return {"success": True, "message": "Response added successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to ticket {ticket_id}: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}

@router.post("/tickets/{ticket_id}/close")
async def close_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Закрыть тикет"""
    try:
        # Проверяем существование тикета
        ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Проверяем права доступа
        if not user.get('is_admin', False) and user['id'] != ticket.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Закрываем тикет
        ticket.status = 'closed'
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Ticket {ticket_id} closed by user {user['id']}")
        return {"success": True, "message": "Ticket closed successfully"}
        
    except Exception as e:
        logger.error(f"Error closing ticket {ticket_id}: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}
